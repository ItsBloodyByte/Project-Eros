"""Sparks endpoints (Phase 15.1).

User-facing:
  - GET  /api/me/sparks               — current balance
  - GET  /api/me/sparks/ledger        — paginated ledger newest-first

Admin:
  - GET  /api/admin/sparks/{user_id}                  — balance + recent rows
  - POST /api/admin/sparks/{user_id}/adjust           — manual credit/debit
                                                          (audit-logged)

The actual ledger logic lives in `/app/backend/sparks.py`. This router is a
thin transport layer so the helper module can be reused from non-HTTP code
(scheduled jobs, migrations, webhooks).
"""

from typing import Optional
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

import sparks as sparks_lib
from monetization import SPARKS_EARN, SPARKS_SPEND, SPARKS_PACKAGES
from server import api_router, db, _require_user, _require_role, _audit


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class _AdjustBody(BaseModel):
    amount: int = Field(..., description="Positive = credit, Negative = debit. Non-zero.")
    note: Optional[str] = Field(default=None, max_length=240)


@api_router.get("/me/sparks")
async def me_sparks(user=Depends(_require_user)):
    """Current Sparks balance + earning/spending tables for the UI."""
    balance = await sparks_lib.get_balance(db, user["id"])
    return {
        "balance": balance,
        "rates_earn": SPARKS_EARN,
        "rates_spend": SPARKS_SPEND,
        "packages": SPARKS_PACKAGES,
    }


@api_router.get("/me/sparks/ledger")
async def me_sparks_ledger(
    user=Depends(_require_user),
    limit: int = 50,
    before: Optional[str] = None,
):
    """Paginated ledger newest-first.

    Pass `before=<created_at>` from the last row to fetch older entries.
    """
    limit = max(1, min(int(limit), 200))
    rows = await sparks_lib.list_ledger(db, user["id"], limit=limit, before=before)
    return {"rows": rows, "next_cursor": rows[-1]["created_at"] if rows else None}


@api_router.get("/admin/sparks/stats")
async def admin_sparks_stats(user=Depends(_require_user)):
    """Global Sparks economy aggregates for the Admin Sparks dashboard.

    Returns counts that let an operator see the health of the virtual
    currency at a glance:
      - total_minted: sum of all positive ledger amounts (sparks ever awarded)
      - total_burned: absolute sum of all negative amounts (sparks ever spent)
      - active_balance: minted - burned (must equal sum of users.sparks_balance)
      - users_with_balance: distinct users currently holding > 0 sparks
      - tx_24h / tx_7d: ledger inserts in the last 24h / 7d
      - top_earn / top_spend: most common transaction_type buckets
    """
    await _require_role(user, ["admin", "superadmin", "support"])
    pipeline_amounts = [
        {"$group": {
            "_id": None,
            "total_minted": {"$sum": {"$cond": [{"$gt": ["$amount", 0]}, "$amount", 0]}},
            "total_burned": {"$sum": {"$cond": [{"$lt": ["$amount", 0]}, {"$abs": "$amount"}, 0]}},
            "rows": {"$sum": 1},
        }}
    ]
    agg = await db.sparks_ledger.aggregate(pipeline_amounts).to_list(length=1)
    base = agg[0] if agg else {"total_minted": 0, "total_burned": 0, "rows": 0}

    now_iso = _now_iso()
    cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    cutoff_7d  = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    tx_24h = await db.sparks_ledger.count_documents({"created_at": {"$gte": cutoff_24h}})
    tx_7d  = await db.sparks_ledger.count_documents({"created_at": {"$gte": cutoff_7d}})

    users_with_balance = await db.users.count_documents({"sparks_balance": {"$gt": 0}})

    top_earn_pipeline = [
        {"$match": {"amount": {"$gt": 0}}},
        {"$group": {"_id": "$transaction_type", "count": {"$sum": 1}, "amount": {"$sum": "$amount"}}},
        {"$sort": {"amount": -1}},
        {"$limit": 6},
    ]
    top_spend_pipeline = [
        {"$match": {"amount": {"$lt": 0}}},
        {"$group": {"_id": "$transaction_type", "count": {"$sum": 1}, "amount": {"$sum": {"$abs": "$amount"}}}},
        {"$sort": {"amount": -1}},
        {"$limit": 6},
    ]
    top_earn = [
        {"transaction_type": r["_id"], "count": r["count"], "amount": r["amount"]}
        for r in await db.sparks_ledger.aggregate(top_earn_pipeline).to_list(length=10)
    ]
    top_spend = [
        {"transaction_type": r["_id"], "count": r["count"], "amount": r["amount"]}
        for r in await db.sparks_ledger.aggregate(top_spend_pipeline).to_list(length=10)
    ]

    minted = int(base.get("total_minted") or 0)
    burned = int(base.get("total_burned") or 0)
    return {
        "total_minted": minted,
        "total_burned": burned,
        "active_balance": minted - burned,
        "ledger_rows": int(base.get("rows") or 0),
        "users_with_balance": users_with_balance,
        "tx_24h": tx_24h,
        "tx_7d": tx_7d,
        "top_earn": top_earn,
        "top_spend": top_spend,
        "as_of": now_iso,
    }


@api_router.get("/admin/sparks/recent")
async def admin_sparks_recent(
    limit: int = 50,
    transaction_type: Optional[str] = None,
    user=Depends(_require_user),
):
    """Recent ledger rows across ALL users (newest-first) — moderation view.

    Optional `transaction_type` filter narrows to e.g. `boost`, `daily_login`.
    Each row is enriched with the owning user's email + display_name so the
    admin can recognise activity patterns without secondary lookups.
    """
    await _require_role(user, ["admin", "superadmin", "support"])
    limit = max(1, min(int(limit), 200))
    q = {}
    if transaction_type:
        q["transaction_type"] = transaction_type
    rows = await db.sparks_ledger.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(length=limit)
    user_ids = list({r.get("user_id") for r in rows if r.get("user_id")})
    user_map = {}
    if user_ids:
        async for u in db.users.find({"id": {"$in": user_ids}}, {"id": 1, "email": 1, "display_name": 1}):
            user_map[u["id"]] = {"email": u.get("email"), "display_name": u.get("display_name")}
    enriched = []
    for r in rows:
        meta = user_map.get(r.get("user_id"), {})
        enriched.append({**r, "user_email": meta.get("email"), "user_display_name": meta.get("display_name")})
    return {"rows": enriched}


@api_router.get("/admin/sparks/{user_id}")
async def admin_sparks_view(user_id: str, user=Depends(_require_user)):
    """Inspect any user's Sparks state — used by support/admin tools."""
    await _require_role(user, ["admin", "superadmin", "support"])
    target = await db.users.find_one({"id": user_id}, {"id": 1, "email": 1, "display_name": 1})
    if not target:
        raise HTTPException(404, "User not found")
    balance = await sparks_lib.get_balance(db, user_id)
    rows = await sparks_lib.list_ledger(db, user_id, limit=50)
    return {
        "user": {"id": target["id"], "email": target.get("email"), "display_name": target.get("display_name")},
        "balance": balance,
        "ledger": rows,
    }


@api_router.post("/admin/sparks/{user_id}/adjust")
async def admin_sparks_adjust(
    user_id: str,
    body: _AdjustBody,
    user=Depends(_require_user),
):
    """Credit/debit Sparks manually.

    Used for refunds (prorata as Sparks per Kapitel 15.4 fairness clause)
    and for support resolutions. Always emits an audit entry so the change
    is explainable.

    Refuses to overdraw — admins must use a smaller debit if the user has
    less than the requested amount.
    """
    await _require_role(user, ["admin", "superadmin"])
    if body.amount == 0:
        raise HTTPException(400, "amount must be non-zero")
    target = await db.users.find_one({"id": user_id}, {"id": 1})
    if not target:
        raise HTTPException(404, "User not found")
    note = (body.note or "").strip() or "Manuelle Anpassung durch Admin"
    if body.amount > 0:
        row = await sparks_lib.award_sparks(
            db, user_id, "admin_adjustment",
            amount=body.amount, note=note, related_id=user["id"],
        )
    else:
        row = await sparks_lib.spend_sparks(
            db, user_id, "admin_adjustment",
            amount=abs(body.amount), note=note, related_id=user["id"],
        )
        if not row:
            raise HTTPException(400, "User has insufficient Sparks balance for this debit")
    await _audit(user["id"], "sparks_admin_adjust", user_id,
                 {"amount": body.amount, "note": note, "balance_after": row.get("balance_after")})
    return {"ok": True, "row": row}
