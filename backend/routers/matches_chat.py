"""Match list + messaging (/matches, /messages).

Extracted from `server.py` during the router refactor (Phase 11.3).
All helpers (DB queries, moderation pipeline, premium checks,
geospatial math) stay in `server.py`; this module only imports what
it needs and registers route handlers on the shared `api_router`.
"""

import os
import uuid
import json
import re
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Query, Request

from server import (
    MessageFirstRequest,
    SendMessageRequest,
    _audit,
    _is_premium,
    _match_or_403,
    _reject_if_bad_image_mime,
    _require_user,
    api_router,
    contains_link_like,
    db,
    moderate_image,
    now_utc,
    public_user_from_doc,
    serialize_doc,
    ws_manager,
)

logger = logging.getLogger("app.routers.matches_chat")


# ---------- Unmatch & Block ----------
@api_router.post("/matches/{match_id}/unmatch")
async def unmatch(match_id: str, user=Depends(_require_user)):
    m = await db.matches.find_one({"id": match_id})
    if not m or user["id"] not in (m.get("user_a"), m.get("user_b")):
        raise HTTPException(404, "Match not found")
    other_id = m["user_b"] if m["user_a"] == user["id"] else m["user_a"]
    # Remove mutual likes & match & messages
    await db.likes.delete_many({
        "$or": [
            {"from_user": user["id"], "to_user": other_id},
            {"from_user": other_id, "to_user": user["id"]},
        ]
    })
    await db.matches.delete_one({"id": match_id})
    await db.messages.delete_many({"match_id": match_id})
    await _audit(user["id"], "unmatch", other_id, {"match_id": match_id})
    return {"ok": True}


@api_router.get("/matches")
async def list_matches(user=Depends(_require_user)):
    cursor = db.matches.find(
        {"$or": [{"user_a": user["id"]}, {"user_b": user["id"]}]}
    ).sort([("locked", -1), ("last_message_at", -1), ("created_at", -1)])
    matches = await cursor.to_list(length=200)
    out = []
    for m in matches:
        other_id = m["user_b"] if m["user_a"] == user["id"] else m["user_a"]
        other = await db.users.find_one({"id": other_id})
        if not other or other.get("banned"):
            continue
        pub = public_user_from_doc(other, viewer_location=(user.get("location") or {}).get("coordinates"), list_mode=True)
        pub["is_system"] = bool(other.get("is_system"))
        # unread count
        unread = await db.messages.count_documents(
            {"match_id": m["id"], "sender_id": {"$ne": user["id"]}, "read_by": {"$ne": user["id"]}}
        )
        out.append(
            {
                "id": m["id"],
                "user": pub,
                "created_at": m["created_at"],
                "last_message_at": m.get("last_message_at"),
                "unread_count": unread,
                "locked": bool(m.get("locked")),
                "locked_reason": m.get("locked_reason"),
                "system_match": bool(m.get("system_match")),
            }
        )
    return {"matches": out}


@api_router.get("/matches/{match_id}/messages")
async def list_messages(match_id: str, user=Depends(_require_user), limit: int = 100):
    m = await _match_or_403(match_id, user["id"])
    # cleanup self-destruct expired
    now_iso = now_utc().isoformat()
    await db.messages.delete_many(
        {"match_id": match_id, "self_destruct_at": {"$lte": now_iso}}
    )
    cursor = db.messages.find({"match_id": match_id}).sort("created_at", 1).limit(limit)
    items = await cursor.to_list(length=limit)
    # Build a compact lookup of sender profiles for the frontend to render per-message identity (couple chats)
    sender_ids = list({i.get("sender_id") for i in items if i.get("sender_id")})
    profiles: Dict = {}
    if sender_ids:
        async for u in db.users.find({"id": {"$in": sender_ids}}, {"id": 1, "display_name": 1, "photos": 1}):
            primary_photo = None
            for p in (u.get("photos") or []):
                if p.get("is_primary"):
                    primary_photo = p.get("data"); break
            if not primary_photo and u.get("photos"):
                primary_photo = u["photos"][0].get("data")
            profiles[u["id"]] = {
                "id": u["id"],
                "display_name": u.get("display_name"),
                "avatar": primary_photo,
            }
    # mark as read — read_by covers caller AND their partner (shared inbox)
    my_read_ids = [user["id"]]
    if user.get("partner_user_id"):
        my_read_ids.append(user["partner_user_id"])
    await db.messages.update_many(
        {"match_id": match_id, "sender_id": {"$nin": my_read_ids}, "read_by": {"$nin": my_read_ids}},
        {"$addToSet": {"read_by": user["id"]}},
    )
    # Couple meta so the OTHER side can render "Anna & Ben" in the chat header
    couple_meta: Dict = {}
    for label in ["user_a", "user_b"]:
        uid = m.get(label)
        if not uid:
            continue
        u = await db.users.find_one({"id": uid})
        if not u:
            continue
        ppl = [profiles.get(uid) or {
            "id": uid,
            "display_name": u.get("display_name"),
            "avatar": next((p.get("data") for p in (u.get("photos") or []) if p.get("is_primary")), (u.get("photos") or [{}])[0].get("data") if u.get("photos") else None),
        }]
        if u.get("partner_user_id"):
            pu = await db.users.find_one({"id": u["partner_user_id"]})
            if pu:
                ppl.append({
                    "id": pu["id"],
                    "display_name": pu.get("display_name"),
                    "avatar": next((p.get("data") for p in (pu.get("photos") or []) if p.get("is_primary")), (pu.get("photos") or [{}])[0].get("data") if pu.get("photos") else None),
                })
        couple_meta[label] = {"primary_id": uid, "people": ppl, "is_couple": len(ppl) > 1}
    return {"messages": serialize_doc(items), "senders": profiles, "couple_meta": couple_meta}


@api_router.post("/messages")
async def send_message(body: SendMessageRequest, user=Depends(_require_user)):
    m = await _match_or_403(body.match_id, user["id"])
    # Broadcast / system-locked matches are read-only for non-staff users
    if m.get("locked"):
        if user.get("role") not in {"admin", "superadmin"}:
            raise HTTPException(403, "Dieser Chat ist eine offizielle Eros-Mitteilung — du kannst darauf nicht antworten.")
    if not body.text and not body.media_data_url:
        raise HTTPException(400, "Message must have text or media")
    if body.text and contains_link_like(body.text):
        raise HTTPException(400, "Links sind im Chat nicht erlaubt.")
    nsfw_score = None
    if body.media_data_url:
        if not body.media_data_url.startswith("data:image/"):
            raise HTTPException(400, "Only image media supported in MVP")
        _reject_if_bad_image_mime(body.media_data_url)
        mod = await moderate_image(body.media_data_url, session_tag="msg-media")
        nsfw_score = mod["nsfw_score"]
    msg = {
        "id": str(uuid.uuid4()),
        "match_id": body.match_id,
        "sender_id": user["id"],
        "text": body.text,
        "media_data_url": body.media_data_url,
        "nsfw_score": nsfw_score,
        "self_destruct_at": (
            (now_utc() + timedelta(seconds=body.self_destruct_seconds)).isoformat()
            if body.self_destruct_seconds else None
        ),
        "read_by": [user["id"]],
        "created_at": now_utc().isoformat(),
    }
    await db.messages.insert_one(msg)
    await db.matches.update_one({"id": body.match_id}, {"$set": {"last_message_at": msg["created_at"]}})
    # Determine the "other" party — accounting for couples on either side
    match_ids = {m.get("user_a"), m.get("user_b")}
    my_ids = {user["id"]}
    if user.get("partner_user_id"):
        my_ids.add(user["partner_user_id"])
    other_id = next(iter(match_ids - my_ids), None) or (m["user_b"] if m["user_a"] == user["id"] else m["user_a"])
    other = await db.users.find_one({"id": other_id}) if other_id else None
    recipients = [user["id"], other_id]
    if user.get("partner_user_id"):
        recipients.append(user["partner_user_id"])
    if other and other.get("partner_user_id"):
        recipients.append(other["partner_user_id"])
    recipients = [r for r in recipients if r]
    # Sender profile snapshot so the counterpart's UI can show "Anna:" / "Ben:"
    primary_photo = next((p.get("data") for p in (user.get("photos") or []) if p.get("is_primary")), None)
    if not primary_photo and user.get("photos"):
        primary_photo = user["photos"][0].get("data")
    sender_snapshot = {
        "id": user["id"],
        "display_name": user.get("display_name"),
        "avatar": primary_photo,
    }
    await ws_manager.broadcast(body.match_id, {
        "type": "message",
        "message": serialize_doc(msg),
        "sender": sender_snapshot,
        "for_users": recipients,
    })
    return {**serialize_doc(msg), "sender": sender_snapshot}


@api_router.post("/messages/first")
async def message_first(body: MessageFirstRequest, user=Depends(_require_user)):
    """Premium-only: send a first message without requiring a match.
    Creates or reuses an "intro" match-like channel."""
    if not _is_premium(user):
        raise HTTPException(402, "Premium required to message first")
    if body.text and contains_link_like(body.text):
        raise HTTPException(400, "Links sind im Chat nicht erlaubt.")
    target = await db.users.find_one({"id": body.target_user_id})
    if not target or target.get("banned"):
        raise HTTPException(404, "User not found")
    # create a match_id if not existing
    existing = await db.matches.find_one(
        {"$or": [
            {"user_a": user["id"], "user_b": body.target_user_id},
            {"user_a": body.target_user_id, "user_b": user["id"]},
        ]}
    )
    if existing:
        match_id = existing["id"]
    else:
        match_id = str(uuid.uuid4())
        await db.matches.insert_one({
            "id": match_id,
            "user_a": user["id"],
            "user_b": body.target_user_id,
            "created_at": now_utc().isoformat(),
            "last_message_at": now_utc().isoformat(),
            "premium_intro": True,
        })
        # also record a like from premium user
        try:
            await db.likes.insert_one({
                "id": str(uuid.uuid4()),
                "from_user": user["id"],
                "to_user": body.target_user_id,
                "created_at": now_utc().isoformat(),
            })
        except Exception:
            pass
    msg = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "sender_id": user["id"],
        "text": body.text,
        "media_data_url": None,
        "nsfw_score": None,
        "self_destruct_at": None,
        "read_by": [user["id"]],
        "created_at": now_utc().isoformat(),
        "is_premium_intro": True,
    }
    await db.messages.insert_one(msg)
    await db.matches.update_one({"id": match_id}, {"$set": {"last_message_at": msg["created_at"]}})
    await _audit(user["id"], "message_first", target=body.target_user_id)
    return {"match_id": match_id, "message": serialize_doc(msg)}


