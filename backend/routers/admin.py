"""Admin-only route handlers.

Extracted from `server.py` during the router refactor (Phase 11.2).
Every handler lives under `/api/admin/...` and shares the same auth pattern
(`_require_user` + `_require_role`). All business helpers/DB queries stay
in `server.py` for now; this module only imports what it needs.
"""

import os
import uuid
import json
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Query, Request

# Wide import from server — these names all live there today.
from server import (
    ADMIN_NOTIFICATION_CHANNELS,
    AIConfigUpdate,
    AI_CONFIG_KEY,
    ALLOWED_BULK_ACTIONS,
    ALLOWED_PROMO_KINDS,
    AdminBanRequest,
    AdminReviewIdRequest,
    AdminSetRoleRequest,
    AdminUserUpdate,
    DEFAULT_PACKAGES,
    DEFAULT_ROLE_CHANNELS,
    EROS_SYSTEM_USER_ID,
    PAYMENT_CONFIG_KEY,
    PaymentConfigUpdate,
    StripeCheckout,
    _ADMIN_EDITABLE_FIELDS,
    _apply_entitlement,
    _apply_successful_payment,
    _audit,
    _broadcast_signature,
    _fanout_broadcast_as_chat,
    _get_payment_config,
    _get_platform_config,
    _klarna_api_base,
    _mark_webhook_processed,
    _mask,
    _mask_provider_keys,
    _optional_user,
    _paypal_access_token,
    _promo_public,
    _public_broadcast,
    _record_webhook_event,
    _require_role,
    _require_user,
    _resolve_user_channels,
    _role_channels,
    admin_ws_manager,
    api_router,
    app,
    db,
    logger,
    notify_admins,
    now_utc,
    parse_dt,
    public_user_from_doc,
    serialize_doc,
)

# The extracted route bodies reference `logger` which in server.py is the
# module-level logger. We keep that binding by aliasing after the import.
_admin_logger = logging.getLogger("app.routers.admin")


@api_router.get("/admin/notifications")
async def list_admin_notifications(user=Depends(_require_user), limit: int = 50):
    await _require_role(user, ["admin", "moderator", "superadmin", "content_reviewer"])
    resolved = await _resolve_user_channels(user)
    q: Dict = {"type": {"$in": resolved}} if resolved else {"type": {"$in": ["__never__"]}}
    items = await db.admin_notifications.find(q).sort("created_at", -1).limit(min(limit, 200)).to_list(length=limit)
    stored = user.get("admin_notification_channels")
    return {
        "notifications": serialize_doc(items),
        "subscribed_channels": stored,
        "effective_channels": resolved,
        "source": "user" if stored is not None else "team",
        "available_channels": ADMIN_NOTIFICATION_CHANNELS,
    }


@api_router.get("/admin/notifications/channels")
async def get_notification_channels(user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin", "content_reviewer"])
    stored = user.get("admin_notification_channels")
    resolved = await _resolve_user_channels(user)
    team_channels = await _role_channels(user.get("role") or "user")
    return {
        "channels": stored if stored is not None else resolved,
        "effective_channels": resolved,
        "all_subscribed": stored is None,
        "source": "user" if stored is not None else "team",
        "team_channels": team_channels,
        "available_channels": ADMIN_NOTIFICATION_CHANNELS,
    }


@api_router.post("/admin/notifications/channels")
async def set_notification_channels(payload: dict, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin", "content_reviewer"])
    payload = payload or {}
    if payload.get("all_subscribed") or payload.get("use_team_default"):
        await db.users.update_one({"id": user["id"]}, {"$unset": {"admin_notification_channels": ""}})
        team = await _role_channels(user.get("role") or "user")
        return {
            "channels": team,
            "effective_channels": team,
            "all_subscribed": True,
            "source": "team",
            "team_channels": team,
            "available_channels": ADMIN_NOTIFICATION_CHANNELS,
        }
    raw = payload.get("channels") or []
    if not isinstance(raw, list):
        raise HTTPException(400, "channels must be a list")
    cleaned = [c for c in raw if c in ADMIN_NOTIFICATION_CHANNELS]
    await db.users.update_one({"id": user["id"]}, {"$set": {"admin_notification_channels": cleaned}})
    return {
        "channels": cleaned,
        "effective_channels": cleaned,
        "all_subscribed": False,
        "source": "user",
        "team_channels": await _role_channels(user.get("role") or "user"),
        "available_channels": ADMIN_NOTIFICATION_CHANNELS,
    }


# ---- Team (role-based) channel assignment — superadmin ----
@api_router.get("/admin/role-channels")
async def get_role_channels(user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    roles = ["support", "content_reviewer", "moderator", "admin", "superadmin"]
    out = {}
    for r in roles:
        out[r] = {
            "role": r,
            "channels": await _role_channels(r),
            "default": DEFAULT_ROLE_CHANNELS.get(r, ADMIN_NOTIFICATION_CHANNELS),
            "overridden": bool(await db.role_channel_assignments.find_one({"role": r})),
        }
    return {"roles": out, "available_channels": ADMIN_NOTIFICATION_CHANNELS}


@api_router.post("/admin/role-channels/{role}")
async def set_role_channels(role: str, payload: dict, user=Depends(_require_user)):
    await _require_role(user, ["superadmin"])
    if role not in {"support", "content_reviewer", "moderator", "admin", "superadmin"}:
        raise HTTPException(400, "Invalid role")
    payload = payload or {}
    if payload.get("reset"):
        await db.role_channel_assignments.delete_one({"role": role})
        return {"role": role, "channels": DEFAULT_ROLE_CHANNELS.get(role, ADMIN_NOTIFICATION_CHANNELS), "overridden": False}
    raw = payload.get("channels") or []
    if not isinstance(raw, list):
        raise HTTPException(400, "channels must be a list")
    cleaned = [c for c in raw if c in ADMIN_NOTIFICATION_CHANNELS]
    await db.role_channel_assignments.update_one(
        {"role": role},
        {"$set": {"role": role, "channels": cleaned, "updated_at": now_utc().isoformat(), "updated_by": user["id"]}},
        upsert=True,
    )
    await _audit(user["id"], "role_channels_set", role, {"channels": cleaned})
    return {"role": role, "channels": cleaned, "overridden": True}


@api_router.get("/admin/broadcasts/segments/options")
async def broadcast_segment_options(user=Depends(_require_user)):
    """Return available cities & interests currently present in the user base (for the composer)."""
    await _require_role(user, ["admin", "superadmin"])
    cities = await db.users.distinct("location.city", {"is_system": {"$ne": True}, "banned": {"$ne": True}})
    cities = sorted([c for c in cities if c])
    interests = await db.users.distinct("interests", {"is_system": {"$ne": True}, "banned": {"$ne": True}})
    interests = sorted([i for i in interests if i])
    genders = await db.users.distinct("gender_identity", {"is_system": {"$ne": True}, "banned": {"$ne": True}})
    genders = sorted([g for g in genders if g])
    return {"cities": cities, "interests": interests, "genders": genders}


@api_router.post("/admin/broadcasts/segments/preview")
async def broadcast_segment_preview(payload: dict, user=Depends(_require_user)):
    """Count of users a given audience + segment filter would reach, before sending."""
    await _require_role(user, ["admin", "superadmin"])
    payload = payload or {}
    audience = payload.get("audience") or "all"
    q: Dict = {"id": {"$ne": EROS_SYSTEM_USER_ID}, "banned": {"$ne": True}, "is_system": {"$ne": True}}
    if audience == "premium":
        q["premium_expires_at"] = {"$gt": now_utc().isoformat()}
    elif audience == "verified":
        q["id_verified"] = True
    elif audience == "staff":
        q["role"] = {"$in": ["admin", "moderator", "superadmin", "content_reviewer", "support"]}
    elif audience == "segment":
        if payload.get("cities"):
            q["location.city"] = {"$in": payload["cities"]}
        if payload.get("interests"):
            q["interests"] = {"$in": payload["interests"]}
        if payload.get("genders"):
            q["gender_identity"] = {"$in": payload["genders"]}
        age_q: Dict = {}
        if payload.get("age_min") not in (None, ""):
            age_q["$gte"] = int(payload["age_min"])
        if payload.get("age_max") not in (None, ""):
            age_q["$lte"] = int(payload["age_max"])
        if age_q:
            q["age"] = age_q
    count = await db.users.count_documents(q)
    total = await db.users.count_documents({"is_system": {"$ne": True}, "banned": {"$ne": True}})
    return {"count": count, "total": total}


@api_router.post("/admin/broadcasts")
async def create_broadcast(payload: dict, user=Depends(_require_user)):
    """Create an authentic platform broadcast. Severity: info|warning|urgent. Audience: all|premium|verified|staff."""
    await _require_role(user, ["admin", "superadmin"])
    payload = payload or {}
    title = (payload.get("title") or "").strip()
    body = (payload.get("body") or "").strip()
    if not title or not body:
        raise HTTPException(400, "Titel und Inhalt sind erforderlich")
    if len(title) > 160 or len(body) > 5000:
        raise HTTPException(400, "Titel max 160, Inhalt max 5000 Zeichen")
    severity = payload.get("severity") or "info"
    if severity not in {"info", "warning", "urgent"}:
        raise HTTPException(400, "Ungültige Severity")
    audience = payload.get("audience") or "all"
    if audience not in {"all", "premium", "verified", "staff", "segment"}:
        raise HTTPException(400, "Ungültige Zielgruppe")
    # Optional segment filters (only used when audience == "segment")
    segment_cities = payload.get("cities") or []
    segment_interests = payload.get("interests") or []
    segment_genders = payload.get("genders") or []
    segment_age_min = payload.get("age_min")
    segment_age_max = payload.get("age_max")
    if audience == "segment" and not any([segment_cities, segment_interests, segment_genders, segment_age_min, segment_age_max]):
        raise HTTPException(400, "Segment-Broadcasts benötigen mindestens ein Filterkriterium")
    expires_at = None
    if payload.get("expires_at"):
        try:
            expires_at = datetime.fromisoformat(str(payload["expires_at"])).isoformat()
        except Exception:
            raise HTTPException(400, "expires_at ungültig")
    doc = {
        "id": str(uuid.uuid4()),
        "title": title,
        "body": body,
        "severity": severity,
        "audience": audience,
        "segment": {
            "cities": segment_cities,
            "interests": segment_interests,
            "genders": segment_genders,
            "age_min": segment_age_min,
            "age_max": segment_age_max,
        } if audience == "segment" else None,
        "pinned": bool(payload.get("pinned")),
        "expires_at": expires_at,
        "created_by": user["id"],
        "created_at": now_utc().isoformat(),
    }
    doc["signature"] = _broadcast_signature(doc)
    await db.broadcasts.insert_one(doc)
    # Fan-out as locked system chat messages from the official Eros profile
    try:
        delivered = await _fanout_broadcast_as_chat(doc)
    except Exception as ex:
        logger.warning("broadcast fanout failed: %s", ex)
        delivered = 0
    await _audit(user["id"], "broadcast_created", doc["id"], {"audience": audience, "severity": severity, "delivered": delivered})
    try:
        await notify_admins({
            "type": "broadcast_sent", "broadcast_id": doc["id"], "severity": severity,
            "audience": audience, "title": title, "at": doc["created_at"],
        })
    except Exception:
        pass
    return await _public_broadcast(doc)


@api_router.get("/admin/broadcasts")
async def list_admin_broadcasts(user=Depends(_require_user), limit: int = 100):
    await _require_role(user, ["admin", "superadmin", "moderator", "content_reviewer", "support"])
    items = await db.broadcasts.find({}).sort("created_at", -1).limit(min(limit, 200)).to_list(length=limit)
    return {"broadcasts": [await _public_broadcast(d) for d in items]}


@api_router.delete("/admin/broadcasts/{bid}")
async def delete_broadcast(bid: str, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    await db.broadcasts.delete_one({"id": bid})
    await db.broadcast_reads.delete_many({"broadcast_id": bid})
    await _audit(user["id"], "broadcast_deleted", bid)
    return {"ok": True}


@api_router.post("/admin/notifications/{nid}/ack")
async def ack_admin_notification(nid: str, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin", "content_reviewer"])
    await db.admin_notifications.update_one({"id": nid}, {"$addToSet": {"read_by": user["id"]}})
    return {"ok": True}


@api_router.post("/admin/notifications/ack_all")
async def ack_all_admin_notifications(user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin", "content_reviewer"])
    await db.admin_notifications.update_many({"read_by": {"$ne": user["id"]}}, {"$addToSet": {"read_by": user["id"]}})
    return {"ok": True}


@api_router.get("/admin/reports")
async def admin_list_reports(user=Depends(_require_user), status: Optional[str] = None):
    await _require_role(user, ["admin", "moderator", "superadmin"])
    q: Dict = {}
    if status:
        q["status"] = status
    cursor = db.reports.find(q).sort("created_at", -1)
    items = await cursor.to_list(length=500)
    return {"reports": serialize_doc(items)}


@api_router.get("/admin/reports/{report_id}")
async def admin_report_detail(report_id: str, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin"])
    rep = await db.reports.find_one({"id": report_id})
    if not rep:
        raise HTTPException(404, "Report not found")

    async def _user_summary(uid: Optional[str]):
        if not uid:
            return None
        u = await db.users.find_one({"id": uid}, {"password_hash": 0})
        if not u:
            return None
        return {
            "id": u.get("id"),
            "display_name": u.get("display_name"),
            "email": u.get("email"),
            "role": u.get("role", "user"),
            "banned": bool(u.get("banned")),
            "shadow_restricted": bool(u.get("shadow_restricted")),
            "id_verified": bool(u.get("id_verified")),
            "age": u.get("age"),
            "primary_photo": next((p.get("data") for p in (u.get("photos") or []) if p.get("is_primary")),
                                  ((u.get("photos") or [{}])[0].get("data") if u.get("photos") else None)),
        }

    async def _user_media(uid: Optional[str]):
        if not uid:
            return {"photos": [], "videos": []}
        u = await db.users.find_one({"id": uid}, {"photos": 1, "videos": 1})
        if not u:
            return {"photos": [], "videos": []}
        photos = [
            {
                "id": p.get("id"),
                "data": p.get("data"),
                "nsfw_score": p.get("nsfw_score"),
                "has_face": p.get("has_face"),
                "is_primary": bool(p.get("is_primary")),
                "retention_until": p.get("retention_until"),
                "retention_reason": p.get("retention_reason"),
            } for p in (u.get("photos") or [])
        ]
        videos = [
            {
                "id": v.get("id"),
                "data": v.get("data"),
                "moderation_status": v.get("moderation_status"),
            } for v in (u.get("videos") or [])
        ]
        return {"photos": photos, "videos": videos}

    async def _load_match_thread(match_id: str, highlight_message_id: Optional[str] = None):
        m = await db.matches.find_one({"id": match_id})
        if not m:
            return None
        msgs = await db.messages.find({"match_id": match_id}).sort("created_at", 1).to_list(length=2000)
        participants = {}
        for uid in [m.get("user_a"), m.get("user_b")]:
            if uid:
                participants[uid] = await _user_summary(uid)
        return {
            "match": {
                "id": m.get("id"),
                "user_a": m.get("user_a"),
                "user_b": m.get("user_b"),
                "created_at": m.get("created_at"),
                "last_message_at": m.get("last_message_at"),
            },
            "participants": participants,
            "messages": [
                {
                    "id": msg.get("id"),
                    "sender_id": msg.get("sender_id"),
                    "text": msg.get("text"),
                    "media_url": msg.get("media_url"),
                    "media_type": msg.get("media_type"),
                    "created_at": msg.get("created_at"),
                    "read_at": msg.get("read_at"),
                    "highlighted": msg.get("id") == highlight_message_id,
                } for msg in msgs
            ],
            "message_count": len(msgs),
        }

    reporter = await _user_summary(rep.get("reporter_id"))
    reported = None
    target_context: Dict = {}
    chat_thread = None

    if rep.get("target_type") == "user":
        reported = await _user_summary(rep.get("target_id"))
        # Find any matches between reporter and target (past or present) — chats may have been deleted/unmatched
        if rep.get("reporter_id") and rep.get("target_id"):
            match_doc = await db.matches.find_one({
                "$or": [
                    {"user_a": rep["reporter_id"], "user_b": rep["target_id"]},
                    {"user_a": rep["target_id"], "user_b": rep["reporter_id"]},
                ]
            })
            if match_doc:
                chat_thread = await _load_match_thread(match_doc["id"])
            else:
                # Check orphaned messages (e.g. after unmatch) between the two users
                orphan_count = await db.messages.count_documents({
                    "$or": [
                        {"sender_id": rep["reporter_id"]},
                        {"sender_id": rep["target_id"]},
                    ]
                })
                target_context["no_active_match"] = True
                target_context["orphan_messages_hint"] = orphan_count > 0
    elif rep.get("target_type") == "photo":
        owner = await db.users.find_one({"photos.id": rep.get("target_id")}, {"password_hash": 0})
        if owner:
            reported = await _user_summary(owner.get("id"))
            photo = next((p for p in (owner.get("photos") or []) if p.get("id") == rep.get("target_id")), None)
            if photo:
                target_context["photo"] = {
                    "id": photo.get("id"),
                    "data": photo.get("data"),
                    "nsfw_score": photo.get("nsfw_score"),
                    "has_face": photo.get("has_face"),
                }
    elif rep.get("target_type") == "message":
        msg = await db.messages.find_one({"id": rep.get("target_id")})
        if msg:
            target_context["message"] = {
                "id": msg.get("id"),
                "text": msg.get("text"),
                "created_at": msg.get("created_at"),
                "sender_id": msg.get("sender_id"),
                "match_id": msg.get("match_id"),
            }
            reported = await _user_summary(msg.get("sender_id"))
            if msg.get("match_id"):
                chat_thread = await _load_match_thread(msg["match_id"], highlight_message_id=msg.get("id"))
    elif rep.get("target_type") == "album":
        album = await db.albums.find_one({"id": rep.get("target_id")})
        if album:
            reported = await _user_summary(album.get("owner_id"))
            target_context["album"] = {
                "id": album.get("id"),
                "title": album.get("title"),
                "description": album.get("description"),
                "is_nsfw": bool(album.get("is_nsfw")),
                "photo_count": len(album.get("photos") or []),
                "photos": [
                    {"id": p.get("id"), "data": p.get("data"),
                     "nsfw_score": p.get("nsfw_score"), "has_face": p.get("has_face")}
                    for p in (album.get("photos") or [])[:12]
                ],
            }

    # Histories
    reporter_history_count = 0
    if rep.get("reporter_id"):
        reporter_history_count = await db.reports.count_documents({"reporter_id": rep["reporter_id"]})
    target_report_count = 0
    recent_reports_against_target: List = []
    if rep.get("target_id"):
        target_report_count = await db.reports.count_documents({"target_id": rep["target_id"]})
        # Grab the last 10 reports against target for context
        other = await db.reports.find({"target_id": rep["target_id"], "id": {"$ne": rep["id"]}})\
            .sort("created_at", -1).limit(10).to_list(length=10)
        recent_reports_against_target = [
            {
                "id": r.get("id"),
                "reason": r.get("reason"),
                "detail": r.get("detail"),
                "status": r.get("status"),
                "target_type": r.get("target_type"),
                "created_at": r.get("created_at"),
                "reporter_id": r.get("reporter_id"),
            } for r in other
        ]

    # Reported user's open/resolved counts
    reported_stats = None
    if reported:
        open_r = await db.reports.count_documents({"target_id": reported["id"], "status": {"$in": ["open", "reviewing"]}})
        resolved_r = await db.reports.count_documents({"target_id": reported["id"], "status": "resolved"})
        reported_stats = {"open": open_r, "resolved": resolved_r}

    # Reported user's media (photos + videos) — always surfaced for context
    reported_media = None
    if reported:
        reported_media = await _user_media(reported["id"])

    # Reporter's primary/public photos as additional context (helpful when reporter claims stalking etc.)
    reporter_media = None
    if reporter:
        reporter_media = await _user_media(reporter["id"])

    return {
        "report": serialize_doc(rep),
        "reporter": reporter,
        "reported": reported,
        "reported_stats": reported_stats,
        "reported_media": reported_media,
        "reporter_media": reporter_media,
        "target_context": target_context,
        "chat_thread": chat_thread,
        "reporter_history_count": reporter_history_count,
        "target_report_count": target_report_count,
        "recent_reports_against_target": recent_reports_against_target,
    }


@api_router.post("/admin/reports/{report_id}/status")
async def admin_update_report(report_id: str, payload: dict, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin"])
    new_status = payload.get("status")
    if new_status not in {"open", "reviewing", "resolved", "rejected"}:
        raise HTTPException(400, "Invalid status")
    await db.reports.update_one({"id": report_id}, {"$set": {"status": new_status}})
    await _audit(user["id"], "report_status_update", report_id, {"status": new_status})
    return {"ok": True}


@api_router.post("/admin/ban")
async def admin_ban(body: AdminBanRequest, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    await db.users.update_one({"id": body.user_id}, {"$set": {"banned": True, "ban_reason": body.reason}})
    await _audit(user["id"], "ban_user", body.user_id, {"reason": body.reason})
    return {"ok": True}


@api_router.post("/admin/unban/{user_id}")
async def admin_unban(user_id: str, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    await db.users.update_one({"id": user_id}, {"$set": {"banned": False}, "$unset": {"ban_reason": ""}})
    await _audit(user["id"], "unban_user", user_id)
    return {"ok": True}



@api_router.post("/admin/users/bulk")
async def admin_users_bulk(payload: dict, user=Depends(_require_user)):
    """Apply a moderation action to many users in one call.

    Body: { user_ids: [str], action: str, reason?: str }
    Actions: ban | unban | hide | unhide | shadow | unshadow |
             require_id_verification | clear_id_requirement
    """
    await _require_role(user, ["admin", "superadmin"])
    payload = payload or {}
    user_ids = payload.get("user_ids") or []
    action = (payload.get("action") or "").strip()
    reason = (payload.get("reason") or "").strip() or None
    if not isinstance(user_ids, list) or not user_ids:
        raise HTTPException(400, "user_ids (Liste) erforderlich")
    if action not in ALLOWED_BULK_ACTIONS:
        raise HTTPException(400, f"Ungültige Action. Erlaubt: {sorted(ALLOWED_BULK_ACTIONS)}")
    # Hard-guard: never touch the system user or the caller themselves
    protected = {EROS_SYSTEM_USER_ID, user["id"]}
    ids = [uid for uid in user_ids if isinstance(uid, str) and uid and uid not in protected]
    if not ids:
        return {"ok": True, "matched": 0, "modified": 0, "skipped": len(user_ids)}

    # Also protect other superadmins from being mass-banned by non-superadmins
    if user.get("role") != "superadmin" and action in {"ban", "hide", "shadow"}:
        supers = await db.users.find({"id": {"$in": ids}, "role": "superadmin"}, {"id": 1}).to_list(length=None)
        super_ids = {s["id"] for s in supers}
        ids = [i for i in ids if i not in super_ids]
        if not ids:
            raise HTTPException(403, "Keine zulässigen Zielkonten (Superadmins geschützt)")

    q = {"id": {"$in": ids}}
    update_set: Dict = {}
    update_unset: Dict = {}

    if action == "ban":
        update_set["banned"] = True
        if reason:
            update_set["ban_reason"] = reason
    elif action == "unban":
        update_set["banned"] = False
        update_unset["ban_reason"] = ""
    elif action == "hide":
        update_set["privacy.hidden_mode"] = True
    elif action == "unhide":
        update_set["privacy.hidden_mode"] = False
    elif action == "shadow":
        update_set["shadow_restricted"] = True
        if reason:
            update_set["shadow_reason"] = reason
    elif action == "unshadow":
        update_set["shadow_restricted"] = False
        update_unset["shadow_reason"] = ""
    elif action == "require_id_verification":
        update_set["requires_id_verification"] = True
    elif action == "clear_id_requirement":
        update_set["requires_id_verification"] = False

    mongo_update: Dict = {}
    if update_set:
        mongo_update["$set"] = update_set
    if update_unset:
        mongo_update["$unset"] = update_unset
    if not mongo_update:
        return {"ok": True, "matched": 0, "modified": 0, "skipped": len(user_ids)}

    res = await db.users.update_many(q, mongo_update)
    await _audit(
        user["id"],
        f"bulk_{action}",
        None,
        {"user_ids": ids, "count": len(ids), "reason": reason, "modified": res.modified_count},
    )
    return {
        "ok": True,
        "matched": res.matched_count,
        "modified": res.modified_count,
        "skipped": len(user_ids) - len(ids),
        "action": action,
    }


@api_router.get("/admin/users")
async def admin_list_users(user=Depends(_require_user), q: Optional[str] = None,
                           include_hidden: bool = True, include_banned: bool = True):
    await _require_role(user, ["admin", "moderator", "support", "content_reviewer", "superadmin"])
    query: Dict = {}
    if q:
        query["$or"] = [{"email": {"$regex": q, "$options": "i"}},
                         {"display_name": {"$regex": q, "$options": "i"}}]
    if not include_banned:
        query["banned"] = {"$ne": True}
    cursor = db.users.find(query, {"password_hash": 0}).limit(500)
    items = await cursor.to_list(length=500)
    return {"users": serialize_doc(items)}


@api_router.get("/admin/users/{user_id}")
async def admin_get_user(user_id: str, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin"])
    u = await db.users.find_one({"id": user_id}, {"password_hash": 0})
    if not u:
        raise HTTPException(404, "User not found")
    return {"user": serialize_doc(u)}


@api_router.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, payload: dict, user=Depends(_require_user)):
    """Admin-only: override any user field. Bypasses regular immutability (e.g. age)."""
    await _require_role(user, ["admin", "superadmin"])
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    clean: Dict = {}
    unset: Dict = {}
    _nullable_literal_fields = {"gender_identity", "pronouns", "orientation", "smoking", "drinking", "diet", "sti_status", "cup_size", "body_type", "ethnicity", "id_verification_status"}
    for k, v in (payload or {}).items():
        if k not in _ADMIN_EDITABLE_FIELDS:
            continue
        if v is None or (isinstance(v, str) and v == "" and k in _nullable_literal_fields):
            unset[k] = ""
        else:
            clean[k] = v
    # Normalize email lower-case & uniqueness
    if "email" in clean and clean["email"]:
        clean["email"] = str(clean["email"]).lower().strip()
        dup = await db.users.find_one({"email": clean["email"], "id": {"$ne": user_id}})
        if dup:
            raise HTTPException(409, "Email already in use")
    # Derive penis_category from length if provided
    if "penis_length_cm" in clean:
        try:
            length = float(clean["penis_length_cm"])
            if length < 12:
                clean["penis_category"] = "small"
            elif length < 15:
                clean["penis_category"] = "average"
            elif length < 18:
                clean["penis_category"] = "large"
            else:
                clean["penis_category"] = "xlarge"
        except Exception:
            pass
    update_ops: Dict = {}
    if clean:
        update_ops["$set"] = clean
    if unset:
        update_ops["$unset"] = unset
    if update_ops:
        await db.users.update_one({"id": user_id}, update_ops)
    await _audit(user["id"], "admin_update_user", user_id, {"fields": list(clean.keys()) + [f"-{k}" for k in unset.keys()]})
    fresh = await db.users.find_one({"id": user_id}, {"password_hash": 0})
    return {"user": serialize_doc(fresh)}


@api_router.post("/admin/users/{user_id}/premium")
async def admin_set_premium(user_id: str, payload: dict, user=Depends(_require_user)):
    """Admin-only: grant/extend/revoke premium and boost by ISO date or day offset."""
    await _require_role(user, ["admin", "superadmin"])
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    action = (payload or {}).get("action", "grant")  # grant | extend | revoke
    days = int((payload or {}).get("days", 0) or 0)
    boost_minutes = int((payload or {}).get("boost_minutes", 0) or 0)
    now = now_utc()
    ops_set: Dict = {}
    ops_unset: Dict = {}
    if action == "revoke":
        ops_unset["premium_expires_at"] = ""
        ops_unset["boost_expires_at"] = ""
    else:
        # grant or extend
        from datetime import timedelta
        base = now
        if action == "extend":
            try:
                cur = target.get("premium_expires_at")
                if cur and cur > now.isoformat():
                    base = datetime.fromisoformat(cur)
            except Exception:
                base = now
        if days > 0:
            ops_set["premium_expires_at"] = (base + timedelta(days=days)).isoformat()
        if boost_minutes > 0:
            boost_base = now
            if action == "extend":
                try:
                    cur = target.get("boost_expires_at")
                    if cur and cur > now.isoformat():
                        boost_base = datetime.fromisoformat(cur)
                except Exception:
                    boost_base = now
            ops_set["boost_expires_at"] = (boost_base + timedelta(minutes=boost_minutes)).isoformat()
    update_ops: Dict = {}
    if ops_set: update_ops["$set"] = ops_set
    if ops_unset: update_ops["$unset"] = ops_unset
    if update_ops:
        await db.users.update_one({"id": user_id}, update_ops)
    await _audit(user["id"], "admin_set_premium", user_id, {"action": action, "days": days, "boost_minutes": boost_minutes})
    fresh = await db.users.find_one({"id": user_id}, {"password_hash": 0})
    return {
        "ok": True,
        "premium_expires_at": fresh.get("premium_expires_at"),
        "boost_expires_at": fresh.get("boost_expires_at"),
    }


@api_router.post("/admin/users/{user_id}/role")
async def admin_set_role(user_id: str, payload: dict, user=Depends(_require_user)):
    """Superadmin-only: change a user's role."""
    await _require_role(user, ["admin", "superadmin"])
    new_role = (payload or {}).get("role")
    if new_role not in {"user", "support", "content_reviewer", "moderator", "admin", "superadmin"}:
        raise HTTPException(400, "Invalid role")
    if new_role == "superadmin" and user.get("role") != "superadmin":
        raise HTTPException(403, "Only superadmins can assign superadmin role")
    await db.users.update_one({"id": user_id}, {"$set": {"role": new_role}})
    await _audit(user["id"], "admin_set_role", user_id, {"role": new_role})
    return {"ok": True}


@api_router.delete("/admin/users/{user_id}/photos/{photo_id}")
async def admin_delete_photo(user_id: str, photo_id: str, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin"])
    await db.users.update_one({"id": user_id}, {"$pull": {"photos": {"id": photo_id}}})
    await _audit(user["id"], "admin_delete_photo", user_id, {"photo_id": photo_id})
    return {"ok": True}


@api_router.post("/admin/users/{user_id}/photos/{photo_id}/retention")
async def admin_set_photo_retention(user_id: str, photo_id: str, payload: dict, user=Depends(_require_user)):
    """Moderator: set or clear a per-photo retention lock.

    Body: {"days": 30}  -> lock for 30 days from now
          {"days": 0}   -> clear lock
          {"until": "2026-12-31T00:00:00+00:00"} -> lock until explicit timestamp
    """
    await _require_role(user, ["admin", "moderator", "superadmin"])
    target = await db.users.find_one({"id": user_id}, {"photos": 1})
    if not target:
        raise HTTPException(404, "User not found")
    photo = next((p for p in (target.get("photos") or []) if p.get("id") == photo_id), None)
    if not photo:
        raise HTTPException(404, "Photo not found")

    until: Optional[str] = None
    payload = payload or {}
    if payload.get("until"):
        try:
            until = datetime.fromisoformat(str(payload["until"])).isoformat()
        except Exception:
            raise HTTPException(400, "Invalid 'until' timestamp")
    elif "days" in payload:
        days = int(payload.get("days") or 0)
        if days > 0:
            until = (now_utc() + timedelta(days=days)).isoformat()
    if until is None:
        # clear
        await db.users.update_one(
            {"id": user_id, "photos.id": photo_id},
            {"$unset": {
                "photos.$.retention_until": "",
                "photos.$.retention_reason": "",
                "photos.$.retention_set_by": "",
                "photos.$.retention_set_at": "",
            }},
        )
        await _audit(user["id"], "photo_retention_cleared", user_id, {"photo_id": photo_id})
        return {"ok": True, "retention_until": None}

    reason = str(payload.get("reason") or "").strip()[:200] or "Moderations-Aufbewahrung"
    await db.users.update_one(
        {"id": user_id, "photos.id": photo_id},
        {"$set": {
            "photos.$.retention_until": until,
            "photos.$.retention_reason": reason,
            "photos.$.retention_set_by": user["id"],
            "photos.$.retention_set_at": now_utc().isoformat(),
        }},
    )
    await _audit(user["id"], "photo_retention_set", user_id, {"photo_id": photo_id, "until": until, "reason": reason})
    try:
        await notify_admins({
            "type": "photo_retention_set",
            "by": user["id"],
            "target_user_id": user_id,
            "photo_id": photo_id,
            "until": until,
            "reason": reason,
            "at": now_utc().isoformat(),
        })
    except Exception:
        pass
    return {"ok": True, "retention_until": until, "retention_reason": reason}


@api_router.get("/admin/matches")
async def admin_list_matches(user=Depends(_require_user), user_id: Optional[str] = None):
    await _require_role(user, ["admin", "moderator", "superadmin"])
    q: Dict = {}
    if user_id:
        q = {"$or": [{"user_a": user_id}, {"user_b": user_id}]}
    cursor = db.matches.find(q).sort("created_at", -1).limit(500)
    items = await cursor.to_list(length=500)
    return {"matches": serialize_doc(items)}


@api_router.get("/admin/matches/{match_id}/messages")
async def admin_match_messages(match_id: str, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin"])
    cursor = db.messages.find({"match_id": match_id}).sort("created_at", 1).limit(500)
    items = await cursor.to_list(length=500)
    return {"messages": serialize_doc(items)}


@api_router.get("/admin/audit")
async def admin_audit(user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    cursor = db.audit.find({}).sort("created_at", -1).limit(200)
    items = await cursor.to_list(length=200)
    return {"events": serialize_doc(items)}


@api_router.get("/admin/moderation/photos")
async def admin_moderation_photos(user=Depends(_require_user), threshold: Optional[float] = None):
    """Photo moderation queue.

    The default threshold honours the runtime AI config:
      - `mandatory_review=True`  → 0.5 (catch borderline content)
      - `mandatory_review=False` → use `block_threshold` (only the worst hits)
    Admins can still override via the `?threshold=` query parameter.
    """
    await _require_role(user, ["admin", "moderator", "content_reviewer", "superadmin"])
    if threshold is None:
        ai_cfg = await db.settings.find_one({"key": AI_CONFIG_KEY}) or {}
        if ai_cfg.get("mandatory_review", True):
            threshold = 0.5
        else:
            threshold = float(ai_cfg.get("block_threshold") or 0.92)
    cursor = db.users.find(
        {"photos.nsfw_score": {"$gte": threshold}},
        {"password_hash": 0},
    ).limit(100)
    items = await cursor.to_list(length=100)
    out = []
    for u in items:
        for p in u.get("photos", []):
            if p.get("nsfw_score", 0) >= threshold:
                out.append({
                    "user_id": u["id"],
                    "display_name": u["display_name"],
                    "photo": p,
                })
    return {"photos": out, "threshold_used": threshold}


# --------- Admin role management ---------
@api_router.post("/admin/role")
async def admin_set_role(body: AdminSetRoleRequest, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    await db.users.update_one({"id": body.user_id}, {"$set": {"role": body.role}})
    await _audit(user["id"], "role_change", body.user_id, {"role": body.role})
    return {"ok": True}


@api_router.post("/admin/video-review/{user_id}/{video_id}")
async def admin_review_video(user_id: str, video_id: str, payload: dict, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "content_reviewer", "superadmin"])
    new_status = payload.get("status")
    if new_status not in {"approved", "rejected", "pending"}:
        raise HTTPException(400, "Invalid status")
    await db.users.update_one(
        {"id": user_id, "videos.id": video_id},
        {"$set": {"videos.$.moderation_status": new_status}},
    )
    await _audit(user["id"], "video_review", video_id, {"status": new_status})
    return {"ok": True}


@api_router.get("/admin/videos")
async def admin_list_pending_videos(user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "content_reviewer", "superadmin"])
    cursor = db.users.find(
        {"videos.moderation_status": "pending"},
        {"password_hash": 0},
    ).limit(100)
    users = await cursor.to_list(length=100)
    out = []
    for u in users:
        for v in u.get("videos", []) or []:
            if v.get("moderation_status") == "pending":
                out.append({
                    "user_id": u["id"],
                    "display_name": u["display_name"],
                    "video": v,
                })
    return {"videos": out}


@api_router.get("/admin/verifications")
async def admin_list_verifications(user=Depends(_require_user), status: Optional[str] = "pending"):
    await _require_role(user, ["admin", "moderator", "content_reviewer", "superadmin"])
    q: Dict = {}
    if status:
        q["status"] = status
    items = await db.id_verifications.find(q).sort("submitted_at", -1).to_list(200)
    # Defense in depth: never echo a destroyed payload back to the admin UI,
    # even if a stale doc still has bytes hanging around. The destroyed
    # timestamp is the only authoritative signal that the document is gone.
    for it in items:
        if it.get("document_destroyed_at"):
            it["selfie_data_url"] = None
            it["document_data_url"] = None
    return {"verifications": serialize_doc(items)}


@api_router.post("/admin/verifications/review")
async def admin_review_verification(body: AdminReviewIdRequest, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "content_reviewer", "superadmin"])
    # We mark the record as reviewed AND, on approval, immediately wipe the
    # selfie + document base64 payload from MongoDB. Once a moderator has
    # confirmed identity there is no legitimate reason to keep a copy of the
    # ID — the user was promised the document would be destroyed. We retain
    # the metadata (status, reviewer, timestamps, note) for audit purposes.
    update: Dict = {
        "status": body.decision,
        "reviewed_by": user["id"],
        "reviewed_at": now_utc().isoformat(),
        "review_note": body.note,
    }
    if body.decision in ("approved", "rejected"):
        # Hard-delete sensitive imagery for both decisions: there is no
        # reason to keep a denied applicant's ID either.
        update.update({
            "selfie_data_url": None,
            "document_data_url": None,
            "document_destroyed_at": now_utc().isoformat(),
            "document_destroyed_by": user["id"],
        })
    await db.id_verifications.update_one(
        {"user_id": body.user_id, "status": "pending"},
        {"$set": update, "$unset": {"selfie_data_url_legacy": "", "document_data_url_legacy": ""}},
    )
    user_update: Dict = {"id_verification_status": body.decision}
    if body.decision == "approved":
        user_update["id_verified"] = True
        user_update["verified"] = True  # grant general verified badge too
    await db.users.update_one({"id": body.user_id}, {"$set": user_update})
    await _audit(
        user["id"],
        "id_review",
        body.user_id,
        {
            "decision": body.decision,
            "documents_destroyed": body.decision in ("approved", "rejected"),
        },
    )
    return {"ok": True, "documents_destroyed": body.decision in ("approved", "rejected")}


# --- Admin user management ---
@api_router.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: AdminUserUpdate, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    upd: Dict = {}
    for f in ["display_name", "bio", "email_verified", "verified", "id_verified",
              "banned", "ban_reason", "shadow_restricted", "shadow_reason"]:
        v = getattr(body, f)
        if v is not None:
            upd[f] = v
    if body.premium_expires_at is not None:
        upd["premium_expires_at"] = body.premium_expires_at.isoformat()
    if upd:
        await db.users.update_one({"id": user_id}, {"$set": upd})
        await _audit(user["id"], "user_update", user_id, {"fields": list(upd.keys())})
    return {"ok": True}


@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    await db.users.delete_one({"id": user_id})
    await db.likes.delete_many({"$or": [{"from_user": user_id}, {"to_user": user_id}]})
    matches = await db.matches.find({"$or": [{"user_a": user_id}, {"user_b": user_id}]}).to_list(1000)
    match_ids = [m["id"] for m in matches]
    await db.matches.delete_many({"id": {"$in": match_ids}})
    await db.messages.delete_many({"match_id": {"$in": match_ids}})
    await db.albums.delete_many({"owner_id": user_id})
    await _audit(user["id"], "user_hard_delete", user_id)
    return {"ok": True}


@api_router.delete("/admin/content/{kind}/{item_id}")
async def admin_delete_content(kind: str, item_id: str, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin"])
    if kind == "message":
        await db.messages.delete_one({"id": item_id})
    elif kind == "album":
        await db.albums.delete_one({"id": item_id})
    elif kind == "event":
        await db.events.delete_one({"id": item_id})
    elif kind == "photo":
        await db.users.update_many({}, {"$pull": {"photos": {"id": item_id}}})
    elif kind == "video":
        await db.users.update_many({}, {"$pull": {"videos": {"id": item_id}}})
    else:
        raise HTTPException(400, "Unknown content kind")
    await _audit(user["id"], f"content_delete_{kind}", item_id)
    return {"ok": True}


@api_router.get("/admin/ai-config")
async def admin_get_ai_config(user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    cfg = await db.settings.find_one({"key": AI_CONFIG_KEY}) or {}
    cfg.pop("_id", None)
    # Mask all api keys before returning. Both legacy top-level `api_key`
    # and the new per-provider `provider_keys[*].api_key` fields are masked
    # so admins see they're set without leaking the secret to the network.
    if cfg.get("api_key"):
        cfg["api_key_masked"] = "***" + cfg["api_key"][-4:]
        cfg.pop("api_key", None)
    pkeys = cfg.get("provider_keys") or {}
    masked_pkeys = {}
    for prov, sub in pkeys.items():
        sub = dict(sub or {})
        if sub.get("api_key"):
            sub["api_key_masked"] = "***" + str(sub["api_key"])[-4:]
            sub.pop("api_key", None)
        masked_pkeys[prov] = sub
    if masked_pkeys:
        cfg["provider_keys"] = masked_pkeys
    cfg.setdefault("enabled", True)
    cfg.setdefault("provider", "gemini")
    cfg.setdefault("model", "gemini-2.5-flash")
    cfg.setdefault("mandatory_review", True)
    cfg.setdefault("block_threshold", 0.92)
    return cfg


@api_router.post("/admin/ai-config")
async def admin_set_ai_config(body: dict, user=Depends(_require_user)):
    """Update the moderation config. Body fields:
        - enabled (bool, master switch)
        - provider ("gemini" | "openai" | "anthropic" | "noop")
        - model (str)
        - mandatory_review (bool)
        - block_threshold (float 0..1)
        - api_key (str, legacy single key — applied to active provider)
        - base_url (str, optional)
        - provider_keys (dict[provider→{api_key, model}]) — partial updates
          merged with existing config.
    """
    await _require_role(user, ["admin", "superadmin"])
    body = body or {}
    existing = await db.settings.find_one({"key": AI_CONFIG_KEY}) or {}
    update: Dict = {"key": AI_CONFIG_KEY,
                    "updated_at": now_utc().isoformat(),
                    "updated_by": user["id"]}
    for field in ("enabled", "provider", "model", "mandatory_review",
                  "block_threshold", "base_url"):
        if field in body and body[field] is not None:
            update[field] = body[field]
    if body.get("api_key"):
        update["api_key"] = body["api_key"]
    incoming_pkeys = body.get("provider_keys") or {}
    if isinstance(incoming_pkeys, dict) and incoming_pkeys:
        merged = dict(existing.get("provider_keys") or {})
        for prov, sub in incoming_pkeys.items():
            if not isinstance(sub, dict):
                continue
            current = dict(merged.get(prov) or {})
            for k in ("api_key", "model"):
                if k in sub and sub[k] not in (None, ""):
                    current[k] = sub[k]
            merged[prov] = current
        update["provider_keys"] = merged
    await db.settings.update_one({"key": AI_CONFIG_KEY}, {"$set": update}, upsert=True)
    # Tell the moderation module to reload on next call.
    try:
        from moderation import invalidate_config_cache
        invalidate_config_cache()
    except Exception:
        pass
    await _audit(user["id"], "ai_config_update", meta={
        "provider": update.get("provider"),
        "enabled": update.get("enabled"),
        "providers_updated": list(incoming_pkeys.keys()) if incoming_pkeys else [],
    })
    return {"ok": True}


@api_router.get("/admin/system/updates")
async def admin_system_updates(user=Depends(_require_user)):
    """
    Returns the updater state written by the updater sidecar container.
    Fields: current_sha, latest_sha, last_check, last_update, enabled,
    message, interval.
    """
    await _require_role(user, ["admin", "superadmin"])
    state_path = os.environ.get("EROS_DATA_DIR", "/data") + "/updater.json"
    try:
        import json as _json
        with open(state_path, "r", encoding="utf-8") as fh:
            state = _json.load(fh)
    except FileNotFoundError:
        state = {
            "current_sha": "",
            "latest_sha": "",
            "last_check": None,
            "last_update": None,
            "enabled": False,
            "message": "Updater läuft nicht oder hat noch keinen Check durchgeführt.",
            "interval": None,
        }
    except Exception as ex:
        state = {"error": f"Updater-State konnte nicht gelesen werden: {ex}"}
    state["update_available"] = bool(
        state.get("latest_sha") and state.get("latest_sha") != state.get("current_sha")
    )
    return state


@api_router.post("/admin/system/updates/trigger")
async def admin_trigger_update(user=Depends(_require_user)):
    """
    Forces the updater sidecar to run a check+rebuild on its next loop tick
    by creating a trigger file in the shared volume. Rebuild happens
    asynchronously; progress is visible via /admin/system/updates.
    """
    await _require_role(user, ["admin", "superadmin"])
    trigger_path = os.environ.get("EROS_DATA_DIR", "/data") + "/updater.trigger"
    try:
        with open(trigger_path, "w", encoding="utf-8") as fh:
            fh.write(now_utc().isoformat())
        return {"ok": True, "message": "Update-Trigger gesetzt. Der Updater übernimmt den Rebuild."}
    except Exception as ex:
        raise HTTPException(500, f"Trigger konnte nicht gesetzt werden: {ex}")


@api_router.get("/admin/payment-config")
async def admin_get_payment_config(user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    cfg = await _get_payment_config()
    # mask legacy stripe api key
    key = cfg.get("stripe_api_key") or ""
    cfg["stripe_api_key_masked"] = _mask(key)
    cfg.pop("stripe_api_key", None)
    # mask per-provider keys and return as *_masked
    cfg["provider_keys_masked"] = _mask_provider_keys(cfg.get("provider_keys") or {})
    cfg.pop("provider_keys", None)
    # inform which providers have a live server-side integration
    cfg["supported_providers"] = ["stripe", "paypal", "klarna"]
    cfg["known_providers"] = ["stripe", "paypal", "mollie", "klarna", "paddle", "custom"]
    return cfg


@api_router.post("/admin/payment-config")
async def admin_set_payment_config(body: PaymentConfigUpdate, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    existing = await _get_payment_config()
    # Merge provider_keys: only overwrite for provided keys (so admin can leave fields empty to keep)
    merged_keys = dict(existing.get("provider_keys") or {})
    if body.provider_keys:
        for pid, keys in body.provider_keys.items():
            current = dict(merged_keys.get(pid) or {})
            for k, v in (keys or {}).items():
                if v:  # only overwrite when user actually provided a non-empty value
                    current[k] = v
            merged_keys[pid] = current
    # Legacy stripe_api_key sync
    stripe_api_key = existing.get("stripe_api_key", "")
    if body.stripe_api_key:
        stripe_api_key = body.stripe_api_key
        merged_keys.setdefault("stripe", {})["secret_key"] = body.stripe_api_key
    elif (merged_keys.get("stripe") or {}).get("secret_key"):
        stripe_api_key = merged_keys["stripe"]["secret_key"]
    doc = {
        "key": PAYMENT_CONFIG_KEY,
        "provider": body.provider,
        "enabled": body.enabled,
        "updated_at": now_utc().isoformat(),
        "updated_by": user["id"],
        "packages": [p.model_dump() for p in body.packages] if body.packages is not None
                    else existing.get("packages", DEFAULT_PACKAGES),
        "stripe_api_key": stripe_api_key,
        "provider_keys": merged_keys,
    }
    await db.settings.update_one({"key": PAYMENT_CONFIG_KEY}, {"$set": doc}, upsert=True)
    await _audit(user["id"], "payment_config_update",
                 meta={"provider": body.provider, "enabled": body.enabled,
                       "packages": len(doc["packages"]),
                       "provider_keys": list(merged_keys.keys())})
    return {"ok": True}


@api_router.get("/admin/payments/transactions")
async def admin_list_transactions(
    user=Depends(_require_user),
    provider: Optional[str] = None,
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
    """Admin-only list of payment transactions with filters."""
    await _require_role(user, ["admin", "superadmin"])
    q: Dict = {}
    if provider:
        q["provider"] = provider
    if user_id:
        q["user_id"] = user_id
    if status:
        # unify: match either legacy `payment_status` or new `status`
        q["$or"] = [{"status": status}, {"payment_status": status}]
    cursor = db.payment_transactions.find(q).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    # Attach short user display for convenience
    uids = list({t.get("user_id") for t in items if t.get("user_id")})
    umap: Dict = {}
    if uids:
        async for u in db.users.find({"id": {"$in": uids}}, {"_id": 0, "id": 1, "display_name": 1, "email": 1}):
            umap[u["id"]] = u
    out = []
    for t in items:
        d = serialize_doc(t)
        u = umap.get(t.get("user_id"))
        if u:
            d["user_display_name"] = u.get("display_name")
            d["user_email"] = u.get("email")
        out.append(d)
    return {"transactions": out, "count": len(out)}


@api_router.get("/admin/payments/webhook-events")
async def admin_list_webhook_events(
    user=Depends(_require_user),
    provider: Optional[str] = None,
    only_errors: bool = False,
    limit: int = Query(100, ge=1, le=500),
):
    """Admin-only view of raw webhook deliveries for debugging."""
    await _require_role(user, ["admin", "superadmin"])
    q: Dict = {}
    if provider:
        q["provider"] = provider
    if only_errors:
        q["error"] = {"$ne": None}
    cursor = db.payment_webhook_events.find(q).sort("received_at", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return {"events": serialize_doc(items), "count": len(items)}


@api_router.post("/admin/payments/transactions/{txn_id}/reconcile")
async def admin_reconcile_transaction(txn_id: str, user=Depends(_require_user)):
    """Force a reconciliation for a single transaction.

    - Stripe: queries the session status via StripeCheckout.
    - PayPal: queries the PayPal order status via REST API.
    - Klarna: re-applies entitlement if order is in a paid-like state.

    The entitlement grant is idempotent via transaction status flag.
    """
    await _require_role(user, ["admin", "superadmin"])
    txn = await db.payment_transactions.find_one({"id": txn_id})
    if not txn:
        raise HTTPException(404, "Transaktion nicht gefunden")
    provider = txn.get("provider")
    cfg = await _get_payment_config()
    status_before = txn.get("status") or txn.get("payment_status")
    result: Dict = {"id": txn_id, "provider": provider, "before": status_before}
    if provider == "stripe" and txn.get("session_id"):
        api_key = cfg.get("stripe_api_key") or os.environ.get("STRIPE_API_KEY", "")
        if not api_key:
            raise HTTPException(400, "Stripe nicht konfiguriert")
        host_url = os.environ.get("EROS_PUBLIC_URL", "").rstrip("/") or ""
        webhook_url = f"{host_url}/api/webhook/stripe"
        sc = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
        st = await sc.get_checkout_status(txn["session_id"])
        result["stripe_status"] = {"status": st.status, "payment_status": st.payment_status}
        if st.payment_status == "paid" and status_before != "paid":
            await _apply_successful_payment(txn["session_id"], st.metadata or {})
    elif provider == "paypal" and txn.get("order_id"):
        try:
            token, api_base = await _paypal_access_token(cfg)
        except HTTPException as ex:
            raise ex
        import httpx as _httpx
        async with _httpx.AsyncClient(timeout=15) as http:
            r = await http.get(
                f"{api_base}/v2/checkout/orders/{txn['order_id']}",
                headers={"Authorization": f"Bearer {token}"},
            )
            if r.status_code >= 400:
                raise HTTPException(502, f"PayPal Order Lookup fehlgeschlagen: {r.status_code}")
            data = r.json()
        result["paypal_status"] = data.get("status")
        if data.get("status") == "COMPLETED" and status_before != "paid":
            await db.payment_transactions.update_one(
                {"_id": txn["_id"]},
                {"$set": {"status": "paid", "paid_at": now_utc().isoformat(),
                          "reconciled_by": user["id"]}},
            )
            await _apply_entitlement(txn.get("user_id"), txn.get("package_id"))
    elif provider == "klarna":
        # Klarna has no cheap "look up by order id" without the merchant plugin id;
        # rely on manual confirmation — mark paid if the admin requests it explicitly.
        raise HTTPException(400, "Klarna-Reconcile bitte via Push-Webhook. Manueller Abgleich nicht unterst\u00fctzt.")
    else:
        raise HTTPException(400, f"Provider {provider} nicht reconcilable")
    txn_after = await db.payment_transactions.find_one({"id": txn_id})
    result["after"] = (txn_after or {}).get("status") or (txn_after or {}).get("payment_status")
    await _audit(user["id"], "payment_reconcile", txn_id, meta=result)
    return result


@api_router.get("/admin/platform-config")
async def admin_get_platform_config(user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    return await _get_platform_config()


@api_router.put("/admin/platform-config")
async def admin_update_platform_config(payload: dict, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    clean: Dict = {}
    if "free_daily_like_limit" in payload:
        v = int(payload["free_daily_like_limit"])
        if v < 0 or v > 1000:
            raise HTTPException(400, "free_daily_like_limit must be 0-1000")
        clean["free_daily_like_limit"] = v
    if "super_like_daily_limit" in payload:
        v = int(payload["super_like_daily_limit"])
        if v < 0 or v > 100:
            raise HTTPException(400, "super_like_daily_limit must be 0-100")
        clean["super_like_daily_limit"] = v
    if "visitors_window_days" in payload:
        v = int(payload["visitors_window_days"])
        if v < 1 or v > 365:
            raise HTTPException(400, "visitors_window_days must be 1-365")
        clean["visitors_window_days"] = v
    if "premium_only_filter_keys" in payload and isinstance(payload["premium_only_filter_keys"], list):
        clean["premium_only_filter_keys"] = [str(x) for x in payload["premium_only_filter_keys"]]
    if not clean:
        raise HTTPException(400, "Nothing to update")
    await db.platform_config.update_one(
        {"key": "main"}, {"$set": {**clean, "updated_by": user["id"], "updated_at": now_utc().isoformat()}},
        upsert=True,
    )
    await _audit(user["id"], "platform_config_update", None, clean)
    return await _get_platform_config()


@api_router.post("/admin/promo-codes")
async def admin_create_promo(payload: dict, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    payload = payload or {}
    code = (payload.get("code") or "").strip().upper()
    if not code or len(code) < 3 or len(code) > 40 or not all(c.isalnum() or c in "-_" for c in code):
        raise HTTPException(400, "Ungültiger Code (3-40 Zeichen, A-Z/0-9/-_)")
    kind = payload.get("kind")
    if kind not in ALLOWED_PROMO_KINDS:
        raise HTTPException(400, f"kind muss eines sein aus {sorted(ALLOWED_PROMO_KINDS)}")
    value = int(payload.get("value") or 0)
    if value <= 0:
        raise HTTPException(400, "value muss > 0 sein")
    existing = await db.promo_codes.find_one({"code": code})
    if existing:
        raise HTTPException(409, "Code existiert bereits")
    doc = {
        "id": str(uuid.uuid4()),
        "code": code,
        "kind": kind,
        "value": value,
        "max_uses": int(payload["max_uses"]) if payload.get("max_uses") not in (None, "") else None,
        "used_count": 0,
        "starts_at": payload.get("starts_at") or None,
        "expires_at": payload.get("expires_at") or None,
        "one_per_user": bool(payload.get("one_per_user", True)),
        "new_users_only": bool(payload.get("new_users_only", False)),
        "auto_on_register": bool(payload.get("auto_on_register", False)),
        "active": bool(payload.get("active", True)),
        "description": (payload.get("description") or "").strip() or None,
        "created_at": now_utc().isoformat(),
        "created_by": user["id"],
    }
    await db.promo_codes.insert_one(doc)
    await _audit(user["id"], "promo_code_create", doc["id"], {"code": code, "kind": kind, "value": value})
    return _promo_public(doc)


@api_router.get("/admin/promo-codes")
async def admin_list_promos(user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin", "support"])
    cursor = db.promo_codes.find({}).sort("created_at", -1).limit(500)
    items = await cursor.to_list(length=500)
    return {"codes": [_promo_public(x) for x in items]}


@api_router.patch("/admin/promo-codes/{promo_id}")
async def admin_update_promo(promo_id: str, payload: dict, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    allowed = {"active", "max_uses", "starts_at", "expires_at", "one_per_user", "new_users_only", "auto_on_register", "description", "value"}
    clean: Dict = {}
    for k in allowed:
        if k in payload:
            clean[k] = payload[k]
    if "value" in clean and int(clean["value"]) <= 0:
        raise HTTPException(400, "value muss > 0 sein")
    if not clean:
        raise HTTPException(400, "Nothing to update")
    res = await db.promo_codes.update_one({"id": promo_id}, {"$set": clean})
    if res.matched_count == 0:
        raise HTTPException(404, "Promo nicht gefunden")
    await _audit(user["id"], "promo_code_update", promo_id, clean)
    doc = await db.promo_codes.find_one({"id": promo_id})
    return _promo_public(doc)


@api_router.delete("/admin/promo-codes/{promo_id}")
async def admin_delete_promo(promo_id: str, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    res = await db.promo_codes.delete_one({"id": promo_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Promo nicht gefunden")
    await _audit(user["id"], "promo_code_delete", promo_id)
    return {"ok": True}





# ---------------------------------------------------------------------------
# Honey-Pot Profile + Shadow-Ban management (Feature #9, 2026-05).
# ---------------------------------------------------------------------------
@api_router.get("/admin/honeypots")
async def admin_list_honeypots(user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin", "content_reviewer"])
    items = await db.users.find(
        {"is_honeypot": True},
        {"_id": 0, "id": 1, "display_name": 1, "age": 1, "gender_identity": 1,
         "orientation": 1, "photos": 1, "created_at": 1, "honeypot_note": 1,
         "shadow_ban_triggers": 1},
    ).sort("created_at", -1).to_list(200)
    # Also surface the trigger count = number of users this trap caught
    enriched = []
    for hp in items:
        cnt = await db.users.count_documents({
            "shadow_ban_triggers.honeypot_user_id": hp["id"],
        })
        enriched.append({**hp, "trigger_count": cnt})
    return {"honeypots": serialize_doc(enriched)}


@api_router.post("/admin/honeypots")
async def admin_create_honeypot(payload: dict, user=Depends(_require_user)):
    """Create a new honeypot account.

    Required: `display_name`, `age`, `gender_identity`, `orientation`.
    Optional: `bio`, `photos` (list of {data, is_primary}), `honeypot_note`.
    The created user has `is_honeypot=True` and a random throwaway email so it
    cannot accidentally match a real registration.
    """
    await _require_role(user, ["admin", "superadmin"])
    name = (payload.get("display_name") or "").strip()
    if not name or len(name) > 60:
        raise HTTPException(400, "display_name erforderlich (max. 60 Zeichen)")
    try:
        age = int(payload.get("age"))
    except Exception:
        raise HTTPException(400, "age erforderlich (Zahl)")
    if age < 18 or age > 99:
        raise HTTPException(400, "age muss zwischen 18 und 99 liegen")
    gender = payload.get("gender_identity") or "other"
    orient = payload.get("orientation") or "straight"
    hp_id = str(uuid.uuid4())
    doc = {
        "id": hp_id,
        "email": f"honeypot+{hp_id[:8]}@eros.internal",
        "password_hash": "!honeypot!",  # never used to log in
        "display_name": name,
        "age": age,
        "gender_identity": gender,
        "orientation": orient,
        "bio": (payload.get("bio") or "")[:500] or None,
        "photos": payload.get("photos") or [],
        "preferences": {"age_min": 18, "age_max": 99, "seeking_genders": [], "radius_km": 50},
        "consents": {"terms": True, "privacy": True, "sensitive_data": True},
        "privacy": {"hidden_mode": False},
        "is_honeypot": True,
        "honeypot_note": (payload.get("honeypot_note") or "")[:300] or None,
        "honeypot_created_by": user["id"],
        "is_system": True,  # also hides from /discover under existing rules
        "banned": False,
        "created_at": now_utc().isoformat(),
        "last_active": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    await _audit(user["id"], "honeypot_create", hp_id, {"display_name": name})
    return {"ok": True, "honeypot": serialize_doc(doc)}


@api_router.delete("/admin/honeypots/{hp_id}")
async def admin_delete_honeypot(hp_id: str, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    res = await db.users.delete_one({"id": hp_id, "is_honeypot": True})
    if res.deleted_count == 0:
        raise HTTPException(404, "Honeypot nicht gefunden")
    await _audit(user["id"], "honeypot_delete", hp_id)
    return {"ok": True}


@api_router.get("/admin/shadow-banned")
async def admin_list_shadow_banned(
    user=Depends(_require_user),
    reason: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """List shadow-banned users with their honeypot trigger trail.

    Filter by `reason` (e.g. `honeypot_trigger`) to surface only bot catches.
    """
    await _require_role(user, ["admin", "moderator", "superadmin", "content_reviewer"])
    q: Dict = {"shadow_banned": True}
    if reason:
        q["shadow_ban_reason"] = reason
    items = await db.users.find(
        q,
        {"_id": 0, "id": 1, "email": 1, "display_name": 1, "shadow_banned_at": 1,
         "shadow_ban_reason": 1, "shadow_ban_triggers": 1, "registration_ip": 1,
         "created_at": 1},
    ).sort("shadow_banned_at", -1).to_list(limit)
    return {"users": serialize_doc(items)}


@api_router.post("/admin/shadow-ban/{user_id}")
async def admin_shadow_ban(user_id: str, payload: dict, user=Depends(_require_user)):
    """Manually shadow-ban a user. Body: {reason: str}."""
    await _require_role(user, ["admin", "superadmin"])
    reason = (payload or {}).get("reason") or "manual"
    if user_id == user["id"]:
        raise HTTPException(400, "Du kannst dich nicht selbst shadow-bannen")
    res = await db.users.update_one(
        {"id": user_id, "shadow_banned": {"$ne": True}},
        {"$set": {"shadow_banned": True, "shadow_banned_at": now_utc().isoformat(),
                   "shadow_ban_reason": reason, "shadow_banned_by": user["id"]}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "User nicht gefunden oder bereits shadow-banned")
    await _audit(user["id"], "shadow_ban", user_id, {"reason": reason})
    return {"ok": True}


@api_router.post("/admin/shadow-unban/{user_id}")
async def admin_shadow_unban(user_id: str, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin"])
    res = await db.users.update_one(
        {"id": user_id, "shadow_banned": True},
        {"$set": {"shadow_banned": False, "shadow_unbanned_at": now_utc().isoformat(),
                   "shadow_unbanned_by": user["id"]}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "User nicht shadow-banned")
    await _audit(user["id"], "shadow_unban", user_id)
    return {"ok": True}
