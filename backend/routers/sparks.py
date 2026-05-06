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

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

import sparks as sparks_lib
from monetization import SPARKS_EARN, SPARKS_SPEND, SPARKS_PACKAGES
from server import api_router, db, _require_user, _require_role, _audit


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
