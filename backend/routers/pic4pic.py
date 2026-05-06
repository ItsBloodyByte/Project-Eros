"""Pic4Pic — secure 1:1 photo exchange inside a chat.

Flow
====
1. **Initiate** (`POST /api/pic4pic/initiate`): User A sends a photo for a
   specific match. The photo runs through the regular image moderation
   pipeline (NSFW score + face detection + label safety). On accept, the
   exchange row is stored with `status="pending"` and a 24 h TTL. A system
   message is posted into the chat informing User B that there is a sealed
   photo waiting for them.
2. **Respond** (`POST /api/pic4pic/respond`): User B uploads their photo.
   Same moderation pipeline. If the photo is rejected (e.g. blank/too-low
   NSFW score, blocked label, mime mismatch), the exchange remains pending
   and B can retry. On a valid response the exchange flips to `completed`,
   two reciprocal `kind=pic4pic` system messages are posted (each with the
   *partner's* photo), and the original sealed previews are discarded.
3. **Cancel** (`POST /api/pic4pic/cancel`): Either side may cancel a pending
   exchange; both photos are deleted from MongoDB.

Until the exchange is completed neither side ever receives the other side's
raw photo. Only metadata (status, sender, expiry) is exposed via
`GET /api/pic4pic/match/{match_id}` for the in-chat banner.

Validation rules for "valid photo":
  - mime must pass `_reject_if_bad_image_mime` (rejects gifs/svgs)
  - moderation must NOT mark the photo as blocked
  - the photo must contain a face OR NSFW signal — this catches
    bots that send 1×1 transparent pixels or stock memes.
"""

import uuid
import logging
from typing import Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from server import (
    api_router,
    db,
    now_utc,
    _require_user,
    _match_or_403,
    _post_system_message,
    _reject_if_bad_image_mime,
    _audit,
    moderate_image,
    compress_image_data_url,
    public_user_from_doc,
    serialize_doc,
)
from honeypot import is_honeypot, is_shadow_banned, trigger_honeypot, record_honeypot_flag

logger = logging.getLogger("app.routers.pic4pic")

# Soft-TTL for a pending exchange. After this the row is treated as expired
# and cannot be answered any more. We don't auto-delete (keeps an audit
# trail of expired exchanges) but reject `respond` calls past this line.
_EXPIRY_HOURS = 24


class Pic4PicInitiate(BaseModel):
    match_id: str
    data_url: str


class Pic4PicRespond(BaseModel):
    exchange_id: str
    data_url: str


def _is_strong_photo(mod: dict) -> bool:
    """Decide whether the moderation output looks like a real photo.

    Bots love sending blank/transparent images. A proper photo will trigger
    *something* in the moderation pipeline: either a face, a noticeable NSFW
    score, or at least one descriptive label.
    """
    if mod.get("blocked"):
        return False
    if mod.get("has_face"):
        return True
    if (mod.get("nsfw_score") or 0) >= 0.10:
        return True
    if mod.get("labels"):
        return True
    return False


def _public_exchange(doc: dict, viewer_id: str) -> dict:
    """Sanitised view of the exchange — never leaks the partner's photo
    until the exchange is completed.
    """
    out = {
        "id": doc.get("id"),
        "match_id": doc.get("match_id"),
        "initiator_id": doc.get("initiator_id"),
        "recipient_id": doc.get("recipient_id"),
        "status": doc.get("status"),
        "created_at": doc.get("created_at"),
        "completed_at": doc.get("completed_at"),
        "expires_at": doc.get("expires_at"),
        "your_role": "initiator" if doc.get("initiator_id") == viewer_id else "recipient",
    }
    if doc.get("status") == "completed":
        # Each side sees the partner's photo
        if viewer_id == doc.get("initiator_id"):
            out["partner_photo"] = doc.get("recipient_photo")
        else:
            out["partner_photo"] = doc.get("initiator_photo")
    elif doc.get("status") == "pending":
        # Tell the recipient that a sealed photo is waiting; tell the
        # initiator that it's been delivered. No image bytes either way.
        if viewer_id == doc.get("recipient_id"):
            out["sealed_for_you"] = True
        else:
            out["sealed_by_you"] = True
    return out


@api_router.post("/pic4pic/initiate")
async def pic4pic_initiate(body: Pic4PicInitiate, user=Depends(_require_user)):
    if is_shadow_banned(user):
        # Shadow-banned senders see fake success — same convention as messages.
        return {"ok": True, "id": str(uuid.uuid4()), "status": "pending"}
    m = await _match_or_403(body.match_id, user["id"])
    other_id = m["user_b"] if m["user_a"] == user["id"] else m["user_a"]
    other = await db.users.find_one({"id": other_id})
    if not other:
        raise HTTPException(404, "Partner not found")
    # Honeypot trip-wire (treat as a message-like interaction)
    if is_honeypot(other) and user.get("role") not in {"admin","moderator","superadmin","content_reviewer","support"}:
        await trigger_honeypot(db, user, other, "pic4pic", {"match_id": body.match_id})
        await record_honeypot_flag(db, user["id"], other["id"], "pic4pic")
        return {"ok": True, "id": str(uuid.uuid4()), "status": "pending"}
    # Block multiple concurrent pending exchanges per match — keeps UX simple
    existing = await db.pic4pic_exchanges.find_one({
        "match_id": body.match_id, "status": "pending",
    })
    if existing:
        raise HTTPException(409, "Es läuft bereits ein offener Bildertausch in diesem Chat.")
    # Validate + moderate the initiator's photo
    if not body.data_url.startswith("data:image/"):
        raise HTTPException(400, "Ungültige Bilddatei.")
    _reject_if_bad_image_mime(body.data_url)
    compressed, _ = compress_image_data_url(body.data_url)
    mod = await moderate_image(compressed, session_tag=f"pic4pic-init-{body.match_id}")
    if mod.get("blocked"):
        raise HTTPException(400, "Dieses Bild kann nicht für den Tausch verwendet werden.")
    if not _is_strong_photo(mod):
        raise HTTPException(400, "Bitte ein echtes Foto verwenden — leere oder Stock-Bilder sind nicht zulässig.")
    now_iso = now_utc().isoformat()
    expires_iso = (now_utc().replace(microsecond=0) +
                   __import__("datetime").timedelta(hours=_EXPIRY_HOURS)).isoformat()
    exchange = {
        "id": str(uuid.uuid4()),
        "match_id": body.match_id,
        "initiator_id": user["id"],
        "recipient_id": other_id,
        "initiator_photo": compressed,
        "initiator_moderation": {"nsfw_score": mod.get("nsfw_score"), "has_face": mod.get("has_face")},
        "recipient_photo": None,
        "recipient_moderation": None,
        "status": "pending",
        "created_at": now_iso,
        "expires_at": expires_iso,
    }
    await db.pic4pic_exchanges.insert_one(exchange)
    # Banner system message in the chat — does NOT contain the photo bytes,
    # only the exchange id so the client can render the sealed-state UI.
    try:
        await _post_system_message(
            body.match_id, user,
            f"📨 {user.get('display_name') or 'Eine:r'} hat ein Foto für einen sicheren Tausch hinterlegt. "
            "Sende ein eigenes Foto, um beide gleichzeitig sichtbar zu machen.",
            extra={"kind": "pic4pic", "pic4pic_id": exchange["id"], "pic4pic_status": "pending"},
        )
    except Exception as ex:
        logger.warning("pic4pic banner message failed: %s", ex)
    await _audit(user["id"], "pic4pic_initiate", exchange["id"], {"match_id": body.match_id})
    return {"ok": True, "exchange": _public_exchange(exchange, user["id"])}


@api_router.post("/pic4pic/respond")
async def pic4pic_respond(body: Pic4PicRespond, user=Depends(_require_user)):
    if is_shadow_banned(user):
        return {"ok": True, "status": "completed"}
    ex = await db.pic4pic_exchanges.find_one({"id": body.exchange_id})
    if not ex:
        raise HTTPException(404, "Tausch nicht gefunden.")
    if ex["recipient_id"] != user["id"]:
        raise HTTPException(403, "Dieser Tausch ist nicht für dich.")
    if ex["status"] != "pending":
        raise HTTPException(400, f"Tausch ist {ex['status']} und kann nicht beantwortet werden.")
    if ex.get("expires_at") and ex["expires_at"] < now_utc().isoformat():
        await db.pic4pic_exchanges.update_one(
            {"id": ex["id"]},
            {"$set": {"status": "expired", "initiator_photo": None}},
        )
        raise HTTPException(410, "Tausch ist abgelaufen.")
    if not body.data_url.startswith("data:image/"):
        raise HTTPException(400, "Ungültige Bilddatei.")
    _reject_if_bad_image_mime(body.data_url)
    compressed, _ = compress_image_data_url(body.data_url)
    mod = await moderate_image(compressed, session_tag=f"pic4pic-resp-{ex['id']}")
    if mod.get("blocked"):
        raise HTTPException(400, "Dieses Bild kann nicht für den Tausch verwendet werden.")
    if not _is_strong_photo(mod):
        raise HTTPException(400, "Bitte ein echtes Foto verwenden — leere oder Stock-Bilder sind nicht zulässig.")
    now_iso = now_utc().isoformat()
    await db.pic4pic_exchanges.update_one(
        {"id": ex["id"]},
        {"$set": {
            "recipient_photo": compressed,
            "recipient_moderation": {"nsfw_score": mod.get("nsfw_score"), "has_face": mod.get("has_face")},
            "status": "completed",
            "completed_at": now_iso,
        }},
    )
    # Post one delivery message per side so each party sees the partner's photo
    # in the chat history. We also flip the original banner message to
    # "completed" so the UI hides the "waiting" state.
    try:
        initiator = await db.users.find_one({"id": ex["initiator_id"]})
        # Update banner
        await db.messages.update_many(
            {"match_id": ex["match_id"], "pic4pic_id": ex["id"]},
            {"$set": {"pic4pic_status": "completed"}},
        )
        await _post_system_message(
            ex["match_id"], user,
            f"🔓 {user.get('display_name')} hat geantwortet — beide Fotos sind jetzt sichtbar.",
            extra={"kind": "pic4pic_completed", "pic4pic_id": ex["id"]},
        )
        # Inline the swapped photos as ordinary chat media so they appear in
        # the timeline. Each is sent under the *original* sender's account.
        if initiator:
            await _post_system_message(
                ex["match_id"], initiator, text="",
                extra={"kind": "pic4pic_photo", "pic4pic_id": ex["id"], "side": "initiator",
                       "media_data_url": ex["initiator_photo"]},
            )
        await _post_system_message(
            ex["match_id"], user, text="",
            extra={"kind": "pic4pic_photo", "pic4pic_id": ex["id"], "side": "recipient",
                   "media_data_url": compressed},
        )
    except Exception as ex2:
        logger.warning("pic4pic post-completion message failed: %s", ex2)
    await _audit(user["id"], "pic4pic_completed", ex["id"], {"match_id": ex["match_id"]})
    final = await db.pic4pic_exchanges.find_one({"id": ex["id"]})
    return {"ok": True, "exchange": _public_exchange(final, user["id"])}


@api_router.post("/pic4pic/cancel")
async def pic4pic_cancel(body: dict, user=Depends(_require_user)):
    ex_id = (body or {}).get("exchange_id")
    if not ex_id:
        raise HTTPException(400, "exchange_id erforderlich")
    ex = await db.pic4pic_exchanges.find_one({"id": ex_id})
    if not ex:
        raise HTTPException(404, "Tausch nicht gefunden.")
    if user["id"] not in (ex["initiator_id"], ex["recipient_id"]):
        raise HTTPException(403, "Du bist nicht Teil dieses Tausches.")
    if ex["status"] != "pending":
        return {"ok": True, "noop": True}
    await db.pic4pic_exchanges.update_one(
        {"id": ex_id},
        {"$set": {"status": "cancelled", "cancelled_by": user["id"],
                   "cancelled_at": now_utc().isoformat(),
                   "initiator_photo": None, "recipient_photo": None}},
    )
    try:
        await db.messages.update_many(
            {"match_id": ex["match_id"], "pic4pic_id": ex_id},
            {"$set": {"pic4pic_status": "cancelled"}},
        )
        await _post_system_message(
            ex["match_id"], user,
            f"❌ {user.get('display_name') or 'Eine:r'} hat den Bildertausch abgebrochen.",
            extra={"kind": "pic4pic_cancelled", "pic4pic_id": ex_id},
        )
    except Exception:
        pass
    await _audit(user["id"], "pic4pic_cancel", ex_id)
    return {"ok": True}


@api_router.get("/pic4pic/match/{match_id}")
async def pic4pic_for_match(match_id: str, user=Depends(_require_user)):
    """Return the most recent exchange for this match (any state) so the
    chat client can render the right UI (waiting / sealed / completed).
    Auth is via match-membership, not by exchange id directly.
    """
    await _match_or_403(match_id, user["id"])
    ex = await db.pic4pic_exchanges.find_one(
        {"match_id": match_id},
        sort=[("created_at", -1)],
    )
    return {"exchange": _public_exchange(ex, user["id"]) if ex else None}
