"""Couples routes.

Covers both linked couples (two logins tethered via `couple_id`) and the
`PATCH /me/persona-b` endpoint for duo (single-login) accounts.

Helpers (`_normalize_persona_b`, `_persona_b_public`, `_get_or_create_match`,
`_post_system_message`, `public_user_from_doc`) stay in `server.py`.
"""

import uuid
import logging

from fastapi import Depends, HTTPException

from server import (
    api_router,
    db,
    now_utc,
    _require_user,
    _audit,
    _get_or_create_match,
    _post_system_message,
    _normalize_persona_b,
    _persona_b_public,
    public_user_from_doc,
    serialize_doc,
    admin_ws_manager,
)

logger = logging.getLogger("app.routers.couples")


@api_router.post("/couples/invite")
async def couple_invite(payload: dict, user=Depends(_require_user)):
    """Invite another Eros account to become your linked partner.

    Primary flow: caller passes `user_id` (the profile they are looking at).
    Legacy flow: `email` is still accepted but deprecated — the UI no longer
    exposes it. The invitee receives an in-app notification AND a chat system
    message with Accept / Decline buttons, mirroring the acquaintance flow.
    """
    if user.get("account_type") == "duo":
        raise HTTPException(400, "Duo-Accounts können keinen zweiten Partner verknüpfen.")
    if user.get("partner_user_id"):
        raise HTTPException(400, "Du bist bereits mit einem Partner verknüpft.")
    payload = payload or {}
    target = None
    if payload.get("user_id"):
        target = await db.users.find_one({"id": str(payload["user_id"])})
    elif payload.get("email"):
        target = await db.users.find_one({"email": str(payload["email"]).strip().lower()})
    else:
        raise HTTPException(400, "user_id oder email erforderlich")
    if not target:
        raise HTTPException(404, "Kein Konto mit diesen Daten gefunden")
    if target["id"] == user["id"]:
        raise HTTPException(400, "Du kannst dich nicht selbst einladen")
    if target.get("banned"):
        raise HTTPException(400, "Das Zielkonto ist nicht verfügbar")
    if target.get("account_type") == "duo":
        raise HTTPException(400, "Das Zielkonto ist bereits ein Paar-Account")
    if target.get("partner_user_id"):
        raise HTTPException(400, "Das Zielkonto ist bereits verknüpft")
    # Respect the invitee's opt-out flag.
    if (target.get("privacy") or {}).get("allow_couple_invites") is False:
        raise HTTPException(403, "Diese:r Nutzer:in hat Partner-Einladungen deaktiviert.")
    # Prevent duplicate pending invites (in either direction).
    existing = await db.couple_invites.find_one({
        "status": "pending",
        "$or": [
            {"from_user_id": user["id"], "to_user_id": target["id"]},
            {"from_user_id": target["id"], "to_user_id": user["id"]},
        ],
    })
    if existing:
        return {"ok": True, "already_pending": True, "invite_id": existing["id"]}
    invite_id = str(uuid.uuid4())
    invite = {
        "id": invite_id,
        "from_user_id": user["id"],
        "to_user_id": target["id"],
        "from_display_name": user.get("display_name"),
        "to_display_name": target.get("display_name"),
        "status": "pending",
        "created_at": now_utc().isoformat(),
        "resolved_at": None,
    }
    # Post the invite as a system chat message (Accept/Decline buttons live there).
    try:
        match_id = await _get_or_create_match(user["id"], target["id"])
        requester_name = user.get("display_name") or "Jemand"
        text = f"{requester_name} möchte dich als Partner:in verknüpfen."
        msg = await _post_system_message(
            match_id, user, text,
            extra={
                "kind": "couple_invite",
                "couple_invite_id": invite_id,
                "couple_invite_from_id": user["id"],
                "couple_invite_to_id": target["id"],
                "couple_invite_status": "pending",
            },
        )
        invite["message_id"] = msg["id"]
        invite["match_id"] = match_id
    except Exception as ex:
        logger.warning("couple_invite system message failed: %s", ex)
    await db.couple_invites.insert_one(invite)
    await _audit(user["id"], "couple_invite_sent", target["id"], {"invite_id": invite_id})
    try:
        await admin_ws_manager.broadcast({"type": "couple_invite", "invite_id": invite_id, "channel": "couples"})
    except Exception:
        pass
    return {"ok": True, "invite_id": invite_id}


@api_router.get("/couples/invites")
async def couple_list_invites(user=Depends(_require_user)):
    """Returns all invites involving the caller (incoming + outgoing)."""
    incoming = await db.couple_invites.find({"to_user_id": user["id"], "status": "pending"}).sort("created_at", -1).to_list(length=50)
    outgoing = await db.couple_invites.find({"from_user_id": user["id"], "status": "pending"}).sort("created_at", -1).to_list(length=50)
    return {"incoming": serialize_doc(incoming), "outgoing": serialize_doc(outgoing)}


@api_router.post("/couples/invites/{invite_id}/accept")
async def couple_accept(invite_id: str, user=Depends(_require_user)):
    invite = await db.couple_invites.find_one({"id": invite_id})
    if not invite or invite.get("to_user_id") != user["id"]:
        raise HTTPException(404, "Einladung nicht gefunden")
    if invite.get("status") != "pending":
        raise HTTPException(400, "Einladung ist nicht mehr offen")
    if user.get("account_type") == "duo" or user.get("partner_user_id"):
        raise HTTPException(400, "Du bist bereits verknüpft/Paar-Account")
    initiator = await db.users.find_one({"id": invite["from_user_id"]})
    if not initiator or initiator.get("banned") or initiator.get("partner_user_id") or initiator.get("account_type") == "duo":
        await db.couple_invites.update_one({"id": invite_id}, {"$set": {"status": "declined", "resolved_at": now_utc().isoformat(), "reason": "initiator_unavailable"}})
        raise HTTPException(400, "Einladung ungültig (Initiator nicht mehr verfügbar)")
    couple_id = str(uuid.uuid4())
    now_iso = now_utc().isoformat()
    await db.couples.insert_one({
        "id": couple_id,
        "user_a_id": initiator["id"],
        "user_b_id": user["id"],
        "initiator_id": initiator["id"],
        "status": "linked",
        "created_at": now_iso,
        "linked_at": now_iso,
    })
    # Update both users
    await db.users.update_one({"id": initiator["id"]}, {"$set": {"couple_id": couple_id, "partner_user_id": user["id"]}})
    await db.users.update_one({"id": user["id"]}, {"$set": {"couple_id": couple_id, "partner_user_id": initiator["id"]}})
    # Close any outstanding invites on either side
    await db.couple_invites.update_many(
        {"$or": [{"from_user_id": initiator["id"]}, {"to_user_id": initiator["id"]},
                  {"from_user_id": user["id"]}, {"to_user_id": user["id"]}],
         "status": "pending"},
        {"$set": {"status": "superseded", "resolved_at": now_iso}},
    )
    await db.couple_invites.update_one({"id": invite_id}, {"$set": {"status": "accepted", "resolved_at": now_iso, "couple_id": couple_id}})
    # Mirror the status change into the original chat system message, so the
    # Accept/Decline buttons disappear on both ends.
    if invite.get("message_id") and invite.get("match_id"):
        try:
            await db.messages.update_one(
                {"id": invite["message_id"]},
                {"$set": {"couple_invite_status": "accepted"}},
            )
        except Exception:
            pass
    await _audit(user["id"], "couple_linked", couple_id, {"initiator": initiator["id"], "partner": user["id"]})
    return {"ok": True, "couple_id": couple_id}


@api_router.post("/couples/invites/{invite_id}/decline")
async def couple_decline(invite_id: str, user=Depends(_require_user)):
    invite = await db.couple_invites.find_one({"id": invite_id})
    if not invite or invite.get("to_user_id") != user["id"]:
        raise HTTPException(404, "Einladung nicht gefunden")
    if invite.get("status") != "pending":
        raise HTTPException(400, "Einladung ist nicht mehr offen")
    await db.couple_invites.update_one({"id": invite_id}, {"$set": {"status": "declined", "resolved_at": now_utc().isoformat()}})
    if invite.get("message_id"):
        try:
            await db.messages.update_one(
                {"id": invite["message_id"]},
                {"$set": {"couple_invite_status": "declined"}},
            )
        except Exception:
            pass
    await _audit(user["id"], "couple_invite_declined", invite_id)
    return {"ok": True}


@api_router.delete("/couples/invites/{invite_id}")
async def couple_revoke(invite_id: str, user=Depends(_require_user)):
    """Initiator cancels their own pending invite."""
    invite = await db.couple_invites.find_one({"id": invite_id})
    if not invite or invite.get("from_user_id") != user["id"]:
        raise HTTPException(404, "Einladung nicht gefunden")
    if invite.get("status") != "pending":
        raise HTTPException(400, "Einladung ist nicht mehr offen")
    await db.couple_invites.update_one({"id": invite_id}, {"$set": {"status": "revoked", "resolved_at": now_utc().isoformat()}})
    if invite.get("message_id"):
        try:
            await db.messages.update_one(
                {"id": invite["message_id"]},
                {"$set": {"couple_invite_status": "revoked"}},
            )
        except Exception:
            pass
    return {"ok": True}


@api_router.post("/couples/unlink")
async def couple_unlink(user=Depends(_require_user)):
    """Unilateral unlink: current user dissolves the couple. Partner is also unlinked.

    Matches/Chats remain intact; they stay on the account that originally initiated each like.
    """
    couple_id = user.get("couple_id")
    if not couple_id:
        raise HTTPException(400, "Du bist aktuell nicht verknüpft")
    couple = await db.couples.find_one({"id": couple_id})
    partner_id = user.get("partner_user_id")
    now_iso = now_utc().isoformat()
    await db.users.update_one({"id": user["id"]}, {"$unset": {"couple_id": "", "partner_user_id": ""}})
    if partner_id:
        await db.users.update_one({"id": partner_id}, {"$unset": {"couple_id": "", "partner_user_id": ""}})
    if couple:
        await db.couples.update_one(
            {"id": couple_id},
            {"$set": {"status": "broken", "broken_at": now_iso, "broken_by": user["id"]}},
        )
    await _audit(user["id"], "couple_unlink", couple_id, {"partner": partner_id})
    return {"ok": True}


@api_router.get("/couples/me")
async def couple_me(user=Depends(_require_user)):
    """Return the caller's couple info (partner user snapshot + persona_b if duo account)."""
    out = {
        "account_type": user.get("account_type") or "single",
        "couple_id": user.get("couple_id"),
        "partner": None,
        "persona_b": _persona_b_public(user.get("persona_b")) if user.get("account_type") == "duo" else None,
    }
    if user.get("partner_user_id"):
        p = await db.users.find_one({"id": user["partner_user_id"]})
        if p:
            out["partner"] = public_user_from_doc(p)
    return out


@api_router.patch("/me/persona-b")
async def update_persona_b(payload: dict, user=Depends(_require_user)):
    """Update persona_b for a duo account (single-account couple)."""
    if user.get("account_type") != "duo":
        raise HTTPException(400, "Dein Konto ist kein Paar-Account")
    clean = _normalize_persona_b(payload or {})
    if not clean:
        raise HTTPException(400, "Keine gültigen Felder übermittelt")
    current = user.get("persona_b") or {}
    merged = {**current, **clean}
    await db.users.update_one({"id": user["id"]}, {"$set": {"persona_b": merged}})
    return {"ok": True, "persona_b": _persona_b_public(merged)}
