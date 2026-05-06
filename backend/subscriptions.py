"""Subscriptions — new entitlement model (Kapitel 15.7).

Replaces the legacy single timestamp `users.premium_expires_at` with a full
`subscriptions` collection that tracks billing cycles, pause windows,
cancellation while keeping the period running, and historical pricing.

The entitlement helper `is_user_premium` is the single point of truth for
"can this user use premium features right now?". All other code (the legacy
`_is_user_premium` in server.py, /api/me serializer, etc.) must defer to it.

Migration policy:
  - On first read after deploy, any user with `premium_expires_at` in the
    future gets a `subscriptions` row with tier=premium synthesised from
    the legacy field. The legacy field stays in place during phase 15.1
    so older code paths keep working until 15.5 cleanup.
  - New writes go ONLY to `subscriptions`. Legacy writes are no longer
    accepted from new code.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import uuid4

from monetization import BILLING_CYCLES, PAUSE_MAX_DAYS

logger = logging.getLogger("app.subscriptions")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
async def get_active_subscription(db, user_id: str) -> Optional[dict]:
    """Return the most recent non-expired subscription for a user.

    A subscription is active when `subscription_active_until > now` and the
    user hasn't paused beyond its current window.
    """
    now_iso = _iso(_now())
    sub = await db.subscriptions.find_one(
        {"user_id": user_id, "subscription_active_until": {"$gt": now_iso}},
        sort=[("subscription_active_until", -1)],
    )
    if sub:
        sub.pop("_id", None)
    return sub


async def is_user_premium(db, user_id: str) -> bool:
    """True iff the user has an active premium entitlement right now.

    Honours pause windows: a paused subscription is *not* premium between
    `paused_at` and `paused_until`.
    """
    sub = await get_active_subscription(db, user_id)
    if not sub:
        return False
    if sub.get("tier") != "premium":
        return False
    paused_until = sub.get("paused_until")
    if paused_until and paused_until > _iso(_now()):
        return False
    return True


async def create_subscription(db, *, user_id: str, billing_cycle: str,
                              payment_provider: str = "stripe",
                              external_subscription_id: Optional[str] = None,
                              discount_type: Optional[str] = None,
                              gift_from_user_id: Optional[str] = None,
                              starts_at: Optional[datetime] = None,
                              price_eur_cents_override: Optional[int] = None) -> dict:
    """Create a fresh subscription row for the given billing cycle.

    Pricing is taken from `BILLING_CYCLES` unless explicitly overridden
    (e.g. promo discounts). The end-of-period timestamp is calculated from
    `duration_days`.
    """
    if billing_cycle not in BILLING_CYCLES:
        raise ValueError(f"Unknown billing_cycle: {billing_cycle}")
    cycle = BILLING_CYCLES[billing_cycle]
    starts_at = starts_at or _now()
    period_end = starts_at + timedelta(days=int(cycle["duration_days"]))
    price = int(price_eur_cents_override) if price_eur_cents_override is not None else int(cycle["price_eur_cents"])

    row = {
        "id": str(uuid4()),
        "user_id": user_id,
        "tier": "premium",
        "billing_cycle": billing_cycle,
        "price_eur_cents": price,
        "discount_type": discount_type,
        "started_at": _iso(starts_at),
        "current_period_start": _iso(starts_at),
        "current_period_end": _iso(period_end),
        "subscription_active_until": _iso(period_end),
        "cancelled_at": None,
        "paused_at": None,
        "paused_until": None,
        "payment_provider": payment_provider,
        "external_subscription_id": external_subscription_id,
        "gift_from_user_id": gift_from_user_id,
        "auto_renew": billing_cycle != "gift",
        "created_at": _iso(_now()),
    }
    await db.subscriptions.insert_one(row)
    # Mirror onto user doc for cheap reads (kept in sync on cancel/pause too)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "premium_expires_at": _iso(period_end),
            "subscription_id": row["id"],
            "subscription_tier": "premium",
            "subscription_billing_cycle": billing_cycle,
        }},
    )
    return row


async def cancel_subscription(db, user_id: str) -> Optional[dict]:
    """Mark a subscription as cancelled while keeping benefits active.

    Per Kapitel 15.4 anti-dark-pattern guarantee: cancellation must NOT
    immediately remove premium features. We simply flag the row so it
    won't auto-renew at the end of the current period.
    """
    sub = await get_active_subscription(db, user_id)
    if not sub:
        return None
    await db.subscriptions.update_one(
        {"id": sub["id"]},
        {"$set": {"cancelled_at": _iso(_now()), "auto_renew": False}},
    )
    sub["cancelled_at"] = _iso(_now())
    sub["auto_renew"] = False
    return sub


async def pause_subscription(db, user_id: str, days: int) -> Optional[dict]:
    """Freeze the subscription for up to PAUSE_MAX_DAYS.

    The user keeps the existing `subscription_active_until` (no time lost),
    but premium-gated features are inactive while the pause runs. Internally
    the entitlement check returns False whenever `paused_until > now`.
    """
    days = max(1, min(int(days), PAUSE_MAX_DAYS))
    sub = await get_active_subscription(db, user_id)
    if not sub:
        return None
    paused_at = _now()
    paused_until = paused_at + timedelta(days=days)
    # Extend the period end so the user isn't shorted by the pause
    new_active_until = datetime.fromisoformat(sub["subscription_active_until"]) + timedelta(days=days)
    await db.subscriptions.update_one(
        {"id": sub["id"]},
        {"$set": {
            "paused_at": _iso(paused_at),
            "paused_until": _iso(paused_until),
            "subscription_active_until": _iso(new_active_until),
        }},
    )
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"premium_expires_at": _iso(new_active_until)}},
    )
    return await get_active_subscription(db, user_id)


async def resume_subscription(db, user_id: str) -> Optional[dict]:
    sub = await get_active_subscription(db, user_id)
    if not sub:
        return None
    if not sub.get("paused_until"):
        return sub
    # Compute remaining pause that we forfeit (so user can't double-extend)
    now = _now()
    paused_until_dt = datetime.fromisoformat(sub["paused_until"])
    remaining = (paused_until_dt - now).total_seconds()
    new_active_until_dt = datetime.fromisoformat(sub["subscription_active_until"])
    if remaining > 0:
        new_active_until_dt = new_active_until_dt - timedelta(seconds=remaining)
    await db.subscriptions.update_one(
        {"id": sub["id"]},
        {"$set": {
            "paused_at": None,
            "paused_until": None,
            "subscription_active_until": _iso(new_active_until_dt),
        }},
    )
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"premium_expires_at": _iso(new_active_until_dt)}},
    )
    return await get_active_subscription(db, user_id)


# ---------------------------------------------------------------------------
# Migration from legacy single-timestamp model
# ---------------------------------------------------------------------------
async def migrate_legacy_premium(db) -> int:
    """Create subscription rows for users that only have legacy data.

    Idempotent — guarded by a `settings` flag so it runs at most once
    successfully.
    """
    flag = await db.settings.find_one({"key": "migration_subscriptions_v1"})
    if flag:
        return 0
    now_iso = _iso(_now())
    migrated = 0
    cursor = db.users.find(
        {"premium_expires_at": {"$gt": now_iso}, "subscription_id": {"$exists": False}},
        {"id": 1, "premium_expires_at": 1, "premium_billing_cycle": 1},
    )
    async for user in cursor:
        try:
            cycle = user.get("premium_billing_cycle") or "monthly"
            if cycle not in BILLING_CYCLES:
                cycle = "monthly"
            cycle_cfg = BILLING_CYCLES[cycle]
            ends_at_iso = user["premium_expires_at"]
            ends_at = datetime.fromisoformat(ends_at_iso) if isinstance(ends_at_iso, str) else ends_at_iso
            started_at = ends_at - timedelta(days=int(cycle_cfg["duration_days"]))
            row = {
                "id": str(uuid4()),
                "user_id": user["id"],
                "tier": "premium",
                "billing_cycle": cycle,
                "price_eur_cents": int(cycle_cfg["price_eur_cents"]),
                "discount_type": "legacy_migration",
                "started_at": _iso(started_at),
                "current_period_start": _iso(started_at),
                "current_period_end": _iso(ends_at),
                "subscription_active_until": _iso(ends_at),
                "cancelled_at": None,
                "paused_at": None,
                "paused_until": None,
                "payment_provider": "legacy",
                "external_subscription_id": None,
                "gift_from_user_id": None,
                "auto_renew": False,    # don't auto-charge migrated rows
                "created_at": now_iso,
            }
            await db.subscriptions.insert_one(row)
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {
                    "subscription_id": row["id"],
                    "subscription_tier": "premium",
                    "subscription_billing_cycle": cycle,
                }},
            )
            migrated += 1
        except Exception as ex:
            logger.warning("subscription migration failed for user %s: %s",
                           user.get("id"), ex)
    await db.settings.insert_one({
        "key": "migration_subscriptions_v1",
        "applied_at": now_iso,
        "modified_count": migrated,
    })
    if migrated:
        logger.info("Subscription migration: created %s rows from legacy data.", migrated)
    return migrated


async def ensure_indexes(db) -> None:
    try:
        await db.subscriptions.create_index([("user_id", 1), ("subscription_active_until", -1)])
        await db.subscriptions.create_index([("external_subscription_id", 1)])
        await db.subscriptions.create_index([("tier", 1)])
    except Exception as ex:
        logger.warning("subscriptions index creation failed: %s", ex)
