"""Payments maintenance — stale-transaction cleanup + ops endpoints.

Background worker that runs every `STALE_SCAN_INTERVAL_S` seconds and marks
`payment_transactions` rows that have been stuck in `payment_status="initiated"`
or `status="initiated"` for longer than `STALE_AFTER_MINUTES` as `expired`.

Why this matters
================
A user clicks "Buy", we insert an `initiated` row, redirect them to the
provider, and then they may simply close the tab. Without a sweeper, those
rows pile up forever. They also confuse the admin "Open transactions" view
and make fraud triage harder. By marking them `expired` after an hour we
keep the backlog drained without ever touching successful captures.

Safety properties
-----------------
- Only updates rows that are *strictly* in `initiated` state.
- Never reverts a paid/failed/refunded row.
- Bounded batch size per scan (avoid runaway long write).
- Audit-logged so admins can trace ops actions.

Webhook strict-mode warning
---------------------------
On startup we log a single WARNING when `strict_webhook_verification` is
disabled and at least one payment provider is live. This is the documented
pre-prod default, but we want it to be visible in production logs so
operators can tighten the screw before launch.
"""

import asyncio
import logging
from datetime import timedelta
from typing import Optional

from fastapi import Depends, HTTPException

from server import (
    api_router,
    app,
    db,
    now_utc,
    _require_user,
    _require_role,
    _get_payment_config,
    _live_providers,
    _audit,
)

logger = logging.getLogger("app.routers.payments_maintenance")

# Tunables
STALE_AFTER_MINUTES = 60          # mark `initiated` older than 1h as expired
STALE_SCAN_INTERVAL_S = 15 * 60   # rescan every 15 minutes
STALE_BATCH_LIMIT = 200           # cap per scan, then yield

_BG_TASK: Optional[asyncio.Task] = None


def _stale_cutoff_iso() -> str:
    return (now_utc() - timedelta(minutes=STALE_AFTER_MINUTES)).isoformat()


async def _scan_once() -> int:
    """Mark stale `initiated` payment transactions as `expired`.

    Returns the number of rows updated. Called from both the background task
    and the manual admin endpoint.
    """
    cutoff = _stale_cutoff_iso()
    # Both shapes appear historically: `payment_status` (Stripe path) and
    # `status` (PayPal/Klarna path). We update both with one Mongo command
    # by using `$or` on the match.
    query = {
        "$or": [
            {"payment_status": "initiated", "created_at": {"$lt": cutoff}},
            {"status": "initiated", "created_at": {"$lt": cutoff}},
        ]
    }
    cursor = db.payment_transactions.find(query, {"id": 1, "_id": 1})
    updated = 0
    batch_ids = []
    async for row in cursor:
        batch_ids.append(row["_id"])
        if len(batch_ids) >= STALE_BATCH_LIMIT:
            break
    if not batch_ids:
        return 0
    res = await db.payment_transactions.update_many(
        {"_id": {"$in": batch_ids}},
        {"$set": {
            "payment_status": "expired",
            "status": "expired",
            "expired_at": now_utc().isoformat(),
            "expired_reason": f"no_capture_within_{STALE_AFTER_MINUTES}_minutes",
        }},
    )
    updated = getattr(res, "modified_count", 0) or 0
    if updated:
        logger.info("Payments cleanup: marked %s stale transactions as expired.", updated)
    return updated


async def _stale_loop():
    """Long-running coroutine that runs `_scan_once` on an interval.

    Sleeps first so service startup isn't blocked by a stale scan; on
    failure logs and continues — never crashes the worker.
    """
    while True:
        try:
            await asyncio.sleep(STALE_SCAN_INTERVAL_S)
            await _scan_once()
        except asyncio.CancelledError:
            raise
        except Exception as ex:  # pragma: no cover — defensive
            logger.warning("Stale payments scan failed: %s", ex)


async def _emit_strict_mode_warning() -> None:
    """Single-shot WARNING when webhook strict mode is OFF in production.

    We don't want to spam logs, so this only fires once per process start.
    """
    try:
        cfg = await _get_payment_config()
    except Exception:
        return
    strict = bool(cfg.get("strict_webhook_verification", False))
    live = _live_providers(cfg) or {}
    has_live = any(bool(v) for v in live.values())
    if has_live and not strict:
        logger.warning(
            "[payments] strict_webhook_verification is OFF while live providers are configured (%s). "
            "Switch it on under Admin → Payments before going to production.",
            ", ".join(k for k, v in live.items() if v) or "none",
        )


@app.on_event("startup")
async def _start_payment_maintenance():
    """Boot the stale-transaction sweeper and emit warnings."""
    global _BG_TASK
    if _BG_TASK is None or _BG_TASK.done():
        _BG_TASK = asyncio.create_task(_stale_loop(), name="payments-stale-sweeper")
        logger.info("Payments stale-transaction sweeper started (interval=%ss).", STALE_SCAN_INTERVAL_S)
    await _emit_strict_mode_warning()


@app.on_event("shutdown")
async def _stop_payment_maintenance():
    global _BG_TASK
    if _BG_TASK and not _BG_TASK.done():
        _BG_TASK.cancel()
        try:
            await _BG_TASK
        except (asyncio.CancelledError, Exception):
            pass


# ---------- Admin endpoints --------------------------------------------------
@api_router.post("/admin/payments/cleanup-stale")
async def admin_cleanup_stale(user=Depends(_require_user)):
    """Manually run the stale-payment sweep (admin-only).

    Useful in production right after a config change or when an operator
    notices an unusually long backlog of `initiated` rows. Idempotent —
    calling it back-to-back is safe and cheap.
    """
    await _require_role(user, ["admin", "superadmin"])
    updated = await _scan_once()
    await _audit(user["id"], "payments_cleanup_stale", "manual",
                 {"updated": updated, "stale_after_minutes": STALE_AFTER_MINUTES})
    return {"ok": True, "updated": updated, "stale_after_minutes": STALE_AFTER_MINUTES}


@api_router.get("/admin/payments/stale-stats")
async def admin_stale_stats(user=Depends(_require_user)):
    """Return how many transactions are currently in each status bucket.

    Powers a small ops dashboard tile so admins can spot spikes in
    `initiated` (= abandoned checkouts) or `expired` (= sweeper output).
    """
    await _require_role(user, ["admin", "superadmin", "support"])
    buckets = {}
    pipeline = [
        {"$group": {"_id": {"$ifNull": ["$status", "$payment_status"]}, "n": {"$sum": 1}}},
    ]
    async for row in db.payment_transactions.aggregate(pipeline):
        buckets[str(row.get("_id") or "unknown")] = int(row.get("n") or 0)
    cutoff = _stale_cutoff_iso()
    stale_pending = await db.payment_transactions.count_documents({
        "$or": [
            {"payment_status": "initiated", "created_at": {"$lt": cutoff}},
            {"status": "initiated", "created_at": {"$lt": cutoff}},
        ]
    })
    return {
        "buckets": buckets,
        "stale_pending_to_sweep": stale_pending,
        "stale_after_minutes": STALE_AFTER_MINUTES,
        "scan_interval_seconds": STALE_SCAN_INTERVAL_S,
    }
