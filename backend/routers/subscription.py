"""Subscription management endpoints (Phase 15.3).

User-facing:
  - GET    /api/me/subscription                  — current entitlement snapshot
  - POST   /api/me/subscription/cancel           — soft-cancel (keeps benefits)
  - POST   /api/me/subscription/pause            — freeze up to 90 days
  - POST   /api/me/subscription/resume           — un-freeze early
  - POST   /api/me/subscription/redeem-gift      — redeem a gift code

The fairness guarantees of Kapitel 15.4 are enforced here:
  • Cancel never removes benefits before the period ends.
  • Pause shifts `subscription_active_until` forward so the user keeps their
    full paid time after resuming.
  • Resume cuts the unused pause time so users can't double-extend by
    pause-resuming repeatedly.
"""

from __future__ import annotations

from typing import Optional
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

import subscriptions as sub_lib
from monetization import PAUSE_MAX_DAYS, BILLING_CYCLES
from server import api_router, db, _require_user, _audit


class _PauseBody(BaseModel):
    days: int = Field(..., ge=1, le=PAUSE_MAX_DAYS)


class _GiftRedeemBody(BaseModel):
    code: str = Field(..., min_length=6, max_length=64)


@api_router.get("/me/subscription")
async def my_subscription(user=Depends(_require_user)):
    """Snapshot of the user's current entitlement.

    Returns enough state for the UI to render the Account page without
    needing a second call: the cycle, the active-until timestamp, the
    pause window (if any), and whether `auto_renew` is on. Free users
    get a tier='free' echo so the same component handles both states.
    """
    sub = await sub_lib.get_active_subscription(db, user["id"])
    if not sub:
        return {
            "tier": "free",
            "billing_cycle": None,
            "subscription_active_until": None,
            "paused_until": None,
            "cancelled_at": None,
            "auto_renew": False,
            "is_paused": False,
        }
    is_paused = bool(sub.get("paused_until"))
    return {
        "id": sub["id"],
        "tier": sub.get("tier"),
        "billing_cycle": sub.get("billing_cycle"),
        "subscription_active_until": sub.get("subscription_active_until"),
        "current_period_end": sub.get("current_period_end"),
        "paused_at": sub.get("paused_at"),
        "paused_until": sub.get("paused_until"),
        "cancelled_at": sub.get("cancelled_at"),
        "auto_renew": bool(sub.get("auto_renew")),
        "payment_provider": sub.get("payment_provider"),
        "is_paused": is_paused,
        "is_gift": bool(sub.get("gift_from_user_id")),
    }


@api_router.post("/me/subscription/cancel")
async def cancel_subscription(user=Depends(_require_user)):
    """Soft-cancel the active subscription.

    Implements Kapitel 15.4: cancel does NOT immediately revoke benefits.
    The `subscription_active_until` field stays the same, so premium
    features remain available until that timestamp; only `auto_renew` is
    flipped off so the next billing cycle isn't initiated.
    """
    sub = await sub_lib.cancel_subscription(db, user["id"])
    if not sub:
        raise HTTPException(404, "Kein aktives Abo gefunden.")
    await _audit(user["id"], "subscription_cancel", sub["id"],
                 {"active_until": sub.get("subscription_active_until")})
    return {
        "ok": True,
        "subscription_active_until": sub.get("subscription_active_until"),
        "cancelled_at": sub.get("cancelled_at"),
    }


@api_router.post("/me/subscription/pause")
async def pause_subscription(body: _PauseBody, user=Depends(_require_user)):
    """Freeze the subscription for 1–90 days without losing paid time.

    The active-until timestamp is extended by the same number of days that
    the pause runs, so the user gets the full benefit of their paid period
    after resuming. Premium gating returns False during the pause window.
    """
    sub = await sub_lib.pause_subscription(db, user["id"], body.days)
    if not sub:
        raise HTTPException(404, "Kein pausierbares Abo gefunden.")
    await _audit(user["id"], "subscription_pause", sub["id"],
                 {"days": body.days, "paused_until": sub.get("paused_until")})
    return {
        "ok": True,
        "paused_until": sub.get("paused_until"),
        "subscription_active_until": sub.get("subscription_active_until"),
    }


@api_router.post("/me/subscription/resume")
async def resume_subscription(user=Depends(_require_user)):
    """Lift an active pause early.

    Subtracts the unused pause-window from the active-until timestamp so
    users can't double-extend by repeatedly pause-resuming the same
    subscription within the same period.
    """
    sub = await sub_lib.resume_subscription(db, user["id"])
    if not sub:
        raise HTTPException(404, "Kein pausiertes Abo gefunden.")
    await _audit(user["id"], "subscription_resume", sub["id"],
                 {"active_until": sub.get("subscription_active_until")})
    return {
        "ok": True,
        "paused_until": None,
        "subscription_active_until": sub.get("subscription_active_until"),
    }


# ---------------------------------------------------------------------------
# Gift redemption (Phase 15.3)
# ---------------------------------------------------------------------------
@api_router.post("/me/subscription/redeem-gift")
async def redeem_gift(body: _GiftRedeemBody, user=Depends(_require_user)):
    """Redeem a gift code generated by another user / promotional batch.

    Gift codes live in `db.gift_codes` with shape:
       { code, billing_cycle (default 'gift'), days, redeemed_by, redeemed_at }

    Single-use: as soon as the document has `redeemed_by` it can't be reused.
    """
    code = body.code.strip().upper()
    gift = await db.gift_codes.find_one({"code": code})
    if not gift:
        raise HTTPException(404, "Code nicht gefunden.")
    if gift.get("redeemed_by"):
        raise HTTPException(409, "Code wurde bereits eingelöst.")
    days = int(gift.get("days") or BILLING_CYCLES["gift"]["duration_days"])
    cycle = gift.get("billing_cycle") or "gift"

    sub = await sub_lib.create_subscription(
        db,
        user_id=user["id"],
        billing_cycle=cycle,
        payment_provider="gift",
        external_subscription_id=code,
        discount_type="gift_code",
        gift_from_user_id=gift.get("from_user_id"),
        price_eur_cents_override=0,
    )
    await db.gift_codes.update_one(
        {"code": code},
        {"$set": {
            "redeemed_by": user["id"],
            "redeemed_at": sub["created_at"],
            "subscription_id": sub["id"],
        }},
    )
    await _audit(user["id"], "gift_code_redeemed", code,
                 {"days": days, "subscription_id": sub["id"]})
    return {
        "ok": True,
        "subscription_id": sub["id"],
        "subscription_active_until": sub.get("subscription_active_until"),
    }
