"""Sparks spending endpoints (Phase 15.2).

Each endpoint follows the same shape:
  1. Validate target / state.
  2. Try to spend the configured Sparks amount with `sparks.spend_sparks`.
     If the helper returns None we know the user can't afford it and we
     return HTTP 402 with a clear German message.
  3. Apply the effect (set boost expiry, mark like as super, etc.).
  4. Audit-log the spend and return the relevant state to the caller.

The Sparks ledger remains the single source of truth — no code path here
ever decrements `sparks_balance` directly.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

import sparks as sparks_lib
from monetization import SPARKS_SPEND, BOOST_DURATION_MINUTES
from server import (
    api_router,
    db,
    now_utc,
    _require_user,
    _is_user_premium,
    _audit,
    public_user_from_doc,
)

logger = logging.getLogger("app.routers.sparks_spend")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _iso(dt: datetime) -> str:
    return dt.isoformat()


async def _spend_or_402(user_id: str, key: str, *, related_id: Optional[str] = None,
                       note: Optional[str] = None) -> dict:
    """Wrap `spend_sparks` so every endpoint returns a uniform 402 on failure."""
    cost = int(SPARKS_SPEND[key])
    row = await sparks_lib.spend_sparks(
        db, user_id, key, amount=cost, related_id=related_id, note=note,
    )
    if not row:
        raise HTTPException(402, f"Nicht genug Sparks. Benötigt: {cost}.")
    return row


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------
class _TargetUserBody(BaseModel):
    target_user_id: str = Field(..., min_length=10)


class _MatchIdBody(BaseModel):
    match_id: str = Field(..., min_length=10)


class _UnlockRequestBody(BaseModel):
    album_id: str = Field(..., min_length=10)


# ---------------------------------------------------------------------------
# Boost (30 sparks → 1h gallery boost)
# ---------------------------------------------------------------------------
@api_router.post("/sparks/spend/boost")
async def spend_boost(user=Depends(_require_user)):
    """Spend 30 Sparks for a one-hour gallery boost.

    Per Kapitel 15.6 the boost is a *time-limited* sichtbarkeits-bonus
    (15 % weighting, max ~2-3 positions). This endpoint is intentionally
    open to Free users — Premium gets 3 boosts per month included via a
    separate flow in Phase 15.3.
    """
    now = now_utc()
    current = user.get("boost_expires_at")
    if current and current > _iso(now):
        raise HTTPException(409, "Du hast bereits einen aktiven Boost.")
    new_exp = now + timedelta(minutes=BOOST_DURATION_MINUTES)
    boost_id = str(uuid.uuid4())
    row = await _spend_or_402(user["id"], "boost_1h", related_id=boost_id,
                              note="Profil-Boost (1h)")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"boost_expires_at": _iso(new_exp)}},
    )
    await db.boosts.insert_one({
        "id": boost_id,
        "user_id": user["id"],
        "started_at": _iso(now),
        "ends_at": _iso(new_exp),
        "source": "sparks_purchase",
        "sparks_ledger_id": row["id"],
        "views_during_boost": 0,
        "likes_during_boost": 0,
    })
    await _audit(user["id"], "sparks_spend_boost", boost_id, {"sparks": SPARKS_SPEND["boost_1h"]})
    return {
        "ok": True,
        "boost_id": boost_id,
        "boost_expires_at": _iso(new_exp),
        "sparks_balance": row["balance_after"],
    }


# ---------------------------------------------------------------------------
# Super-Like / "Sehr interessiert"-Signal (10 sparks)
# ---------------------------------------------------------------------------
@api_router.post("/sparks/spend/super-like")
async def spend_super_like(body: _TargetUserBody, user=Depends(_require_user)):
    """Pay 10 Sparks to send a highlighted "Sehr interessiert"-Signal.

    Distinct from the legacy `POST /likes/super` Premium endpoint:
      - Available to Free users (concept §15.3).
      - Hard-rate-limited to 1 super-like per (sender, target) per 24h to
        prevent spam — extra spends within the window are refunded
        immediately (no debit, no extra signal).
    """
    target_id = body.target_user_id
    if target_id == user["id"]:
        raise HTTPException(400, "Du kannst dich nicht selbst markieren.")
    target = await db.users.find_one({"id": target_id})
    if not target or target.get("banned"):
        raise HTTPException(404, "User nicht gefunden")

    now_iso = _iso(now_utc())
    cutoff = _iso(now_utc() - timedelta(hours=24))
    existing = await db.likes.find_one({"from_user": user["id"], "to_user": target_id})
    if existing and existing.get("super_at") and existing["super_at"] > cutoff:
        raise HTTPException(429, "Du hast diesen Profil schon kürzlich markiert.")

    row = await _spend_or_402(user["id"], "very_interested_signal",
                              related_id=target_id, note="„Sehr interessiert“-Signal")

    if existing:
        await db.likes.update_one(
            {"_id": existing["_id"]},
            {"$set": {"super": True, "super_at": now_iso, "super_source": "sparks"}},
        )
    else:
        await db.likes.insert_one({
            "id": str(uuid.uuid4()),
            "from_user": user["id"],
            "to_user": target_id,
            "created_at": now_iso,
            "super": True,
            "super_at": now_iso,
            "super_source": "sparks",
        })
    await _audit(user["id"], "sparks_spend_super_like", target_id,
                 {"sparks": SPARKS_SPEND["very_interested_signal"]})
    return {"ok": True, "sparks_balance": row["balance_after"]}


# ---------------------------------------------------------------------------
# Profile highlight (15 sparks → 24h)
# ---------------------------------------------------------------------------
@api_router.post("/sparks/spend/highlight")
async def spend_highlight(user=Depends(_require_user)):
    """Visually highlight your card in the gallery for 24h.

    Stored as `profile_highlight_until` on the user doc; the discover
    serializer surfaces this as `is_highlighted` so the frontend can render
    a subtle border/badge without leaking the timestamp.
    """
    now = now_utc()
    current = user.get("profile_highlight_until")
    if current and current > _iso(now):
        raise HTTPException(409, "Dein Profil ist bereits hervorgehoben.")
    new_exp = now + timedelta(hours=24)
    row = await _spend_or_402(user["id"], "profile_highlight_24h",
                              note="Profil-Highlight (24h)")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"profile_highlight_until": _iso(new_exp)}},
    )
    await _audit(user["id"], "sparks_spend_highlight", None,
                 {"sparks": SPARKS_SPEND["profile_highlight_24h"]})
    return {
        "ok": True,
        "highlight_until": _iso(new_exp),
        "sparks_balance": row["balance_after"],
    }


# ---------------------------------------------------------------------------
# Gift Premium Week (80 sparks)
# ---------------------------------------------------------------------------
@api_router.post("/sparks/spend/gift-premium-week")
async def spend_gift_premium_week(body: _TargetUserBody, user=Depends(_require_user)):
    """Gift the recipient 7 days of Premium for 80 Sparks.

    Extends `subscription_active_until` (in either the new subscriptions
    collection or the legacy `premium_expires_at` field) by 7 days from
    *the larger of now or the existing expiry*, so a user who already has
    Premium gets the week stacked on top instead of overwritten.
    """
    target_id = body.target_user_id
    if target_id == user["id"]:
        raise HTTPException(400, "Du kannst dich nicht selbst beschenken.")
    target = await db.users.find_one({"id": target_id})
    if not target or target.get("banned"):
        raise HTTPException(404, "User nicht gefunden")

    now = now_utc()
    base_iso = max(target.get("premium_expires_at") or _iso(now), _iso(now))
    base_dt = datetime.fromisoformat(base_iso)
    new_exp = base_dt + timedelta(days=7)

    row = await _spend_or_402(user["id"], "gift_premium_week",
                              related_id=target_id,
                              note=f"Premium-Geschenk (7 Tage) → {target.get('display_name') or target_id}")

    # Mirror onto user doc + create a lightweight subscription row.
    await db.users.update_one(
        {"id": target_id},
        {"$set": {
            "premium_expires_at": _iso(new_exp),
            "subscription_tier": "premium",
        }},
    )
    sub_id = str(uuid.uuid4())
    await db.subscriptions.insert_one({
        "id": sub_id,
        "user_id": target_id,
        "tier": "premium",
        "billing_cycle": "gift",
        "price_eur_cents": 0,
        "discount_type": "sparks_gift",
        "started_at": _iso(now),
        "current_period_start": _iso(now),
        "current_period_end": _iso(new_exp),
        "subscription_active_until": _iso(new_exp),
        "cancelled_at": None,
        "paused_at": None,
        "paused_until": None,
        "payment_provider": "sparks",
        "external_subscription_id": None,
        "gift_from_user_id": user["id"],
        "auto_renew": False,
        "created_at": _iso(now),
    })
    await _audit(user["id"], "sparks_spend_gift_premium_week", target_id,
                 {"sparks": SPARKS_SPEND["gift_premium_week"], "subscription_id": sub_id})
    return {
        "ok": True,
        "recipient": {"id": target_id, "premium_until": _iso(new_exp)},
        "sparks_balance": row["balance_after"],
    }


# ---------------------------------------------------------------------------
# Extra unlock request (8 sparks → +1 quota)
# ---------------------------------------------------------------------------
@api_router.post("/sparks/spend/extra-unlock-request")
async def spend_extra_unlock_request(body: _UnlockRequestBody, user=Depends(_require_user)):
    """Add a single bonus unlock request to the user's monthly quota.

    Implementation: increments `extra_unlock_request_credits` on the user
    doc. The album-unlock endpoint consumes one of these credits before
    consulting the Free monthly quota, effectively letting Free users
    overshoot the 5/month cap.
    """
    row = await _spend_or_402(user["id"], "extra_unlock_request",
                              related_id=body.album_id,
                              note="Extra Album-Unlock-Anfrage")
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"extra_unlock_request_credits": 1}},
    )
    await _audit(user["id"], "sparks_spend_extra_unlock_request", body.album_id,
                 {"sparks": SPARKS_SPEND["extra_unlock_request"]})
    return {"ok": True, "credit_granted": 1, "sparks_balance": row["balance_after"]}


# ---------------------------------------------------------------------------
# AI Chat-starter (3 sparks)
# ---------------------------------------------------------------------------
@api_router.post("/sparks/spend/chat-starter")
async def spend_chat_starter(body: _MatchIdBody, user=Depends(_require_user)):
    """Generate three AI-suggested conversation openers based on both profiles.

    Charges 3 Sparks regardless of whether the user uses the suggestions —
    the LLM call is what costs us money. Failures (LLM offline, timeout)
    refund automatically by skipping the spend until the call succeeds.
    """
    match = await db.matches.find_one({"id": body.match_id})
    if not match or user["id"] not in (match.get("user_a"), match.get("user_b")):
        raise HTTPException(404, "Match nicht gefunden")
    other_id = match["user_b"] if match["user_a"] == user["id"] else match["user_a"]
    other = await db.users.find_one({"id": other_id})
    if not other:
        raise HTTPException(404, "Match-Partner nicht gefunden")

    suggestions = await _generate_chat_starters(user, other)
    if not suggestions:
        raise HTTPException(503, "AI-Vorschläge gerade nicht verfügbar — keine Sparks abgebucht.")

    row = await _spend_or_402(user["id"], "ai_chat_starter",
                              related_id=body.match_id,
                              note="KI-Gesprächseinstiege")
    await _audit(user["id"], "sparks_spend_chat_starter", body.match_id,
                 {"sparks": SPARKS_SPEND["ai_chat_starter"], "count": len(suggestions)})
    return {"ok": True, "starters": suggestions, "sparks_balance": row["balance_after"]}


async def _generate_chat_starters(me: dict, other: dict) -> list[str]:
    """Use the Emergent LLM to produce 3 short, friendly openers.

    Defensive: returns [] on any failure so the caller can surface a
    503 instead of charging Sparks for nothing. The prompt is intentionally
    bounded — we never include sensitive demographic data.
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        import os
        key = os.environ.get("EMERGENT_LLM_KEY", "")
        if not key:
            return []

        def _capsule(u: dict) -> str:
            parts = [u.get("display_name") or "Mensch"]
            if u.get("age"):
                parts.append(f"{u['age']} J.")
            if u.get("city"):
                parts.append(u["city"])
            for tag_field in ("interests", "kinks"):
                tags = (u.get(tag_field) or [])[:5]
                if tags:
                    parts.append(", ".join(str(t) for t in tags))
            bio = (u.get("about") or u.get("bio") or "").strip()
            if bio:
                parts.append("Bio: " + bio[:240])
            return " · ".join(parts)

        system = (
            "Du hilfst einer Person, einen freundlichen, neugierigen Chat-"
            "Einstieg zu schreiben. Antworten: ausschließlich JSON-Array mit "
            "genau 3 deutschen Sätzen, jeder zwischen 60 und 140 Zeichen. "
            "Keine Anrede, keine Anführungszeichen im Satz, keine Emojis."
        )
        user_msg = (
            "Profil A (ich): " + _capsule(me) + "\n"
            "Profil B (Match): " + _capsule(other) + "\n"
            "Aufgabe: drei knackige, persönliche Einstiege auf Basis der gemeinsamen "
            "Interessen oder eines Detail aus B's Bio. Keine Belanglosigkeiten."
        )
        chat = LlmChat(api_key=key, session_id=f"chat-starter-{me['id']}-{other['id']}",
                       system_message=system).with_model("gemini", "gemini-2.5-flash")
        resp = await chat.send_message(UserMessage(text=user_msg))
        text = (resp or "").strip()
        # Cheap JSON extraction — model may wrap with ```json ... ```
        if "```" in text:
            text = text.split("```")[1].lstrip("json").lstrip("\n")
        if "[" in text:
            text = text[text.index("["):]
        if "]" in text:
            text = text[: text.rindex("]") + 1]
        import json
        items = json.loads(text)
        if not isinstance(items, list):
            return []
        return [str(s).strip() for s in items if isinstance(s, str) and s.strip()][:3]
    except Exception as ex:
        logger.warning("chat-starter LLM failed: %s", ex)
        return []
