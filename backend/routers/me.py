"""Profile / "me" endpoints. All routes return or mutate the caller's own
user document.

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
    BoostActivateRequest,
    ChatPrefsUpdate,
    LocationHeartbeatRequest,
    MoodUpdateRequest,
    PhotoUploadRequest,
    ProfileUpdate,
    VIDEO_MAX_DURATION_SECONDS,
    VIDEO_MAX_PER_USER,
    VIDEO_MAX_RAW_BYTES,
    VIDEO_MAX_WIDTH,
    VideoUploadRequest,
    _audit,
    _broadcast_matches_user,
    _get_platform_config,
    _is_premium,
    _is_user_premium,
    _public_broadcast,
    _reject_if_bad_image_mime,
    _reject_if_bad_video_mime,
    _require_user,
    api_router,
    compress_image_data_url,
    db,
    moderate_image,
    now_utc,
    public_user_from_doc,
    serialize_doc,
)

logger = logging.getLogger("app.routers.me")


# ---------- Profile ----------
@api_router.get("/me")
async def me(user=Depends(_require_user)):
    pub = public_user_from_doc(user)
    # /me always exposes the true role to the owner, even when role_badge_visible=False
    # (the toggle hides the role only from OTHERS, not from the staff member themselves).
    pub["role"] = user.get("role", "user")
    now_iso = now_utc().isoformat()
    return {
        **pub,
        "email": user["email"],
        "email_verified": bool(user.get("email_verified")),
        "mfa_enabled": bool(user.get("mfa_enabled")),
        "preferences": user.get("preferences", {}),
        "privacy": user.get("privacy", {}),
        "location": user.get("location"),
        "consents": user.get("consents", {}),
        "videos": user.get("videos", []),
        "is_premium": (user.get("premium_expires_at") or "") > now_iso,
        "premium_until": user.get("premium_expires_at"),
        "boost_until": user.get("boost_expires_at"),
        "seen_user_ids": user.get("seen_user_ids", []) or [],
        "id_verified": bool(user.get("id_verified")),
        "id_verification_status": user.get("id_verification_status"),
        "role": user.get("role", "user"),
    }


@api_router.patch("/me")
async def update_me(body: ProfileUpdate, user=Depends(_require_user)):
    update: Dict = {}
    # Age is immutable once set (and is mandatory at registration).
    immutable_once_set = {"age"}
    for field in [
        "display_name", "age", "gender_identity", "pronouns", "orientation",
        "bio", "relationship_types", "seeking_roles", "kinks",
        # Phase 4 extended
        "height_cm", "body_type", "ethnicity", "languages", "interests",
        "smoking", "drinking", "diet", "sti_status", "sti_tested_on",
        "cup_size", "penis_length_cm", "penis_girth_cm", "current_mood",
        "relationship_status",
        # NSFW signal (all users) + conditional gay-male position (guarded below).
        "accept_nsfw", "gay_position",
    ]:
        val = getattr(body, field)
        if val is None:
            continue
        if field in immutable_once_set and user.get(field) not in (None, "", 0):
            # silently ignore age changes after it is set
            continue
        update[field] = val
    # Gay-position guard: silently drop the field for non-qualifying accounts
    # (prevents e.g. a cis-hetero woman from accidentally storing a gay-male tag).
    # We evaluate against the *merged* profile view — i.e. whatever identity will
    # be effective after this PATCH — so a user flipping their orientation in the
    # same request works correctly.
    if "gay_position" in update:
        effective_gender = update.get("gender_identity", user.get("gender_identity"))
        effective_orientation = update.get("orientation", user.get("orientation"))
        if not (
            effective_gender in {"man", "trans_man"} and
            effective_orientation in {"gay", "bisexual", "pansexual", "queer", "questioning"}
        ):
            # Clear any previous value so stale tags can't survive orientation changes.
            update["gay_position"] = None
    if body.location is not None:
        update["location"] = {"type": "Point", "coordinates": body.location.coordinates}
    if body.preferences is not None:
        update["preferences"] = body.preferences.model_dump()
    if body.privacy is not None:
        update["privacy"] = body.privacy.model_dump()
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]})
    pub = public_user_from_doc(fresh)
    pub["role"] = fresh.get("role", "user")  # owner always sees own role
    return pub


@api_router.patch("/me/mood")
async def update_mood(body: MoodUpdateRequest, user=Depends(_require_user)):
    """
    Set or clear the current mood indicator (sex_meet / dating / chatting / online / None).
    Separate from the bulk /me endpoint so it can be toggled fast from anywhere.
    """
    update: Dict = {"current_mood": body.current_mood}
    if body.current_mood is not None:
        update["current_mood_updated_at"] = now_utc().isoformat()
    else:
        update["current_mood_updated_at"] = None
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]})
    return public_user_from_doc(fresh)


@api_router.post("/me/location")
async def update_location_heartbeat(body: LocationHeartbeatRequest, user=Depends(_require_user)):
    """
    Lightweight GPS heartbeat. Frontend calls this every ~15 min while the tab
    is visible so that distance-based discovery uses fresh coordinates. Accepts
    [lng, lat]; accuracy_m is logged for future radius heuristics.
    """
    if not body.coordinates or len(body.coordinates) != 2:
        raise HTTPException(400, "coordinates must be [lng, lat]")
    lng, lat = body.coordinates
    try:
        lng = float(lng)
        lat = float(lat)
    except (TypeError, ValueError):
        raise HTTPException(400, "coordinates must be numeric")
    if not (-180.0 <= lng <= 180.0) or not (-90.0 <= lat <= 90.0):
        raise HTTPException(400, "coordinates out of range")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "location": {"type": "Point", "coordinates": [lng, lat]},
            "location_updated_at": now_utc().isoformat(),
            "location_accuracy_m": float(body.accuracy_m) if body.accuracy_m is not None else None,
            "last_active": now_utc().isoformat(),
        }},
    )
    return {"ok": True, "updated_at": now_utc().isoformat()}


@api_router.post("/me/photos")
async def upload_photo(body: PhotoUploadRequest, user=Depends(_require_user)):
    if not body.data_url.startswith("data:image/"):
        raise HTTPException(400, "Invalid image data URL")
    _reject_if_bad_image_mime(body.data_url)
    # Basic size guard: base64 chars. ~1.37x raw. Limit ~8MB raw.
    if len(body.data_url) > 11_000_000:
        raise HTTPException(413, "Image too large (max ~8MB)")
    # Server-side compression: shrink to sane dimensions + re-encode JPEG.
    # This drastically reduces Mongo storage + every subsequent wire transfer.
    compressed_url, _ = compress_image_data_url(body.data_url)
    # Hard cap: max 5 photos per user (1 primary + 4 secondary)
    MAX_PHOTOS = 5
    current = user.get("photos", [])
    if len(current) >= MAX_PHOTOS:
        raise HTTPException(400, f"Maximal {MAX_PHOTOS} Fotos erlaubt")
    photo_id = str(uuid.uuid4())
    mod = await moderate_image(compressed_url, session_tag=f"photo-{photo_id}")
    photo = {
        "id": photo_id,
        "data": compressed_url,
        "nsfw_score": mod["nsfw_score"],
        "has_face": mod["has_face"],
        "category": mod["category"],
        "labels": mod["labels"],
        "created_at": now_utc().isoformat(),
        "is_primary": body.is_primary or len(user.get("photos", [])) == 0,
    }
    if photo["is_primary"]:
        # unset previous primaries
        photos = user.get("photos", [])
        for p in photos:
            p["is_primary"] = False
        photos.append(photo)
        await db.users.update_one({"id": user["id"]}, {"$set": {"photos": photos}})
    else:
        await db.users.update_one({"id": user["id"]}, {"$push": {"photos": photo}})
    return photo


@api_router.delete("/me/photos/{photo_id}")
async def delete_photo(photo_id: str, user=Depends(_require_user)):
    # Evidence preservation: block photo deletion while an active report targets the user or this photo
    active_against_user = await db.reports.count_documents({
        "target_type": "user",
        "target_id": user["id"],
        "status": {"$in": ["open", "reviewing"]},
    })
    active_against_photo = await db.reports.count_documents({
        "target_type": "photo",
        "target_id": photo_id,
        "status": {"$in": ["open", "reviewing"]},
    })
    # Per-photo retention lock (admin-set, e.g. 30 days even after report resolved)
    photo_obj = next((p for p in (user.get("photos") or []) if p.get("id") == photo_id), None)
    retention_lock = False
    if photo_obj and photo_obj.get("retention_until"):
        try:
            retention_lock = datetime.fromisoformat(photo_obj["retention_until"]) > now_utc()
        except Exception:
            retention_lock = False
    if active_against_user or active_against_photo or retention_lock:
        reason = (
            "Foto ist durch Moderation bis "
            + (photo_obj.get("retention_until") if retention_lock else "zum Abschluss einer Meldung")
            + " gesperrt."
        ) if retention_lock else "Fotos können derzeit nicht gelöscht werden: Es läuft eine aktive Meldung. Bitte kontaktiere den Support."
        raise HTTPException(423, reason)
    photos = [p for p in user.get("photos", []) if p["id"] != photo_id]
    # ensure at least one primary if any left
    if photos and not any(p.get("is_primary") for p in photos):
        photos[0]["is_primary"] = True
    await db.users.update_one({"id": user["id"]}, {"$set": {"photos": photos}})
    return {"ok": True}


@api_router.post("/me/photos/{photo_id}/primary")
async def make_primary(photo_id: str, user=Depends(_require_user)):
    photos = user.get("photos", [])
    found = False
    for p in photos:
        if p["id"] == photo_id:
            p["is_primary"] = True
            found = True
        else:
            p["is_primary"] = False
    if not found:
        raise HTTPException(404, "Photo not found")
    await db.users.update_one({"id": user["id"]}, {"$set": {"photos": photos}})
    return {"ok": True}


@api_router.post("/me/photos/reorder")
async def reorder_photos(body: dict, user=Depends(_require_user)):
    """Reorder photos by list of photo ids. First id becomes primary."""
    order: List[str] = body.get("order") or []
    if not isinstance(order, list) or not order:
        raise HTTPException(400, "order (list of ids) required")
    photos = user.get("photos", [])
    by_id = {p["id"]: p for p in photos}
    if any(pid not in by_id for pid in order):
        raise HTTPException(400, "Unknown photo id in order")
    new_photos = []
    for idx, pid in enumerate(order):
        p = dict(by_id[pid])
        p["is_primary"] = (idx == 0)
        new_photos.append(p)
    # append any photos not referenced (safety)
    for p in photos:
        if p["id"] not in order:
            q = dict(p)
            q["is_primary"] = False
            new_photos.append(q)
    await db.users.update_one({"id": user["id"]}, {"$set": {"photos": new_photos}})
    return {"ok": True}


@api_router.patch("/me/chat-prefs")
async def update_chat_prefs(body: ChatPrefsUpdate, user=Depends(_require_user)):
    upd = {}
    if body.read_receipts is not None:
        upd["privacy.read_receipts"] = body.read_receipts
    if body.show_typing is not None:
        upd["privacy.show_typing"] = body.show_typing
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    return {"ok": True}


@api_router.get("/me/acquaintances/pending")
async def my_pending_acquaintances(user=Depends(_require_user)):
    """Incoming pending requests for the current user (and their partner)."""
    recipients = [user["id"]]
    if user.get("partner_user_id"):
        recipients.append(user["partner_user_id"])
    cur = db.acquaintances.find({
        "target_id": {"$in": recipients},
        "status": "pending",
    }).sort("created_at", -1).limit(50)
    items: List[Dict] = []
    async for a in cur:
        items.append(serialize_doc(a))
    return {"count": len(items), "items": items}


@api_router.get("/me/broadcasts")
async def my_broadcasts(
    user=Depends(_require_user),
    unread_only: bool = False,
    read_status: Optional[str] = None,   # 'read' | 'unread' | None
    severity: Optional[str] = None,      # 'info' | 'warning' | 'urgent'
    audience: Optional[str] = None,      # 'all' | 'premium' | 'verified' | 'staff' | 'segment'
    since: Optional[str] = None,         # ISO timestamp inclusive
    until: Optional[str] = None,         # ISO timestamp inclusive
    include_expired: bool = False,       # default False preserves legacy banner behaviour
    pinned_only: bool = False,
    search: Optional[str] = None,        # case-insensitive substring in title/body
    limit: int = 20,
    skip: int = 0,
):
    """
    Returns broadcasts visible to the current user with optional filters.
    Defaults preserve legacy behaviour (active, latest-first) – the account
    history view opts in via `include_expired=True` and larger page sizes.
    """
    now_iso = now_utc().isoformat()
    q: Dict = {}
    if not include_expired:
        q["$or"] = [{"expires_at": None}, {"expires_at": {"$gt": now_iso}}]
    if severity in {"info", "warning", "urgent"}:
        q["severity"] = severity
    if audience in {"all", "premium", "verified", "staff", "segment"}:
        q["audience"] = audience
    if pinned_only:
        q["pinned"] = True
    if since or until:
        rng: Dict = {}
        if since:
            rng["$gte"] = since
        if until:
            rng["$lte"] = until
        q["created_at"] = rng
    if search:
        import re as _re_local
        esc = _re_local.escape(search.strip())
        if esc:
            rx = {"$regex": esc, "$options": "i"}
            q["$and"] = q.get("$and", []) + [{"$or": [{"title": rx}, {"body": rx}]}]

    # Cap pool: broadcasts are platform-wide and low-volume; fetch a safe upper bound,
    # then apply per-user visibility + read-filter in Python, paginate last.
    pool_cap = 500
    cursor = db.broadcasts.find(q).sort([("pinned", -1), ("created_at", -1)]).limit(pool_cap)
    pool = await cursor.to_list(length=pool_cap)

    lim = max(1, min(int(limit), 100))
    off = max(0, int(skip))

    filtered: List[Dict] = []
    for d in pool:
        if not _broadcast_matches_user(d, user):
            continue
        pub = await _public_broadcast(d, for_user_id=user["id"])
        is_read = bool(pub.get("read"))
        if unread_only and is_read:
            continue
        if read_status == "read" and not is_read:
            continue
        if read_status == "unread" and is_read:
            continue
        filtered.append(pub)

    total = len(filtered)
    page = filtered[off:off + lim]
    return {
        "broadcasts": page,
        "total": total,
        "limit": lim,
        "skip": off,
        "has_more": (off + len(page)) < total,
    }


@api_router.post("/me/broadcasts/ack-all")
async def ack_all_broadcasts(user=Depends(_require_user)):
    """Marks every broadcast currently visible to the user as read."""
    now_iso = now_utc().isoformat()
    pool = await db.broadcasts.find({}).sort([("created_at", -1)]).limit(1000).to_list(length=1000)
    marked = 0
    for d in pool:
        if not _broadcast_matches_user(d, user):
            continue
        res = await db.broadcast_reads.update_one(
            {"broadcast_id": d.get("id"), "user_id": user["id"]},
            {"$set": {"broadcast_id": d.get("id"), "user_id": user["id"], "ack_at": now_iso}},
            upsert=True,
        )
        if res.upserted_id or res.modified_count:
            marked += 1
    return {"ok": True, "marked": marked}


@api_router.get("/me/unread-summary")
async def unread_summary(user=Depends(_require_user)):
    """
    Lightweight aggregate for the nav badges:
    - unread_messages: total messages across all matches not read by the user
    - unread_matches: matches with at least one unread message from the partner
    - new_matches: matches created in the last 72h where the user hasn't sent a message yet
    """
    uid = user["id"]
    # total unread messages (partner-sent, not in read_by)
    match_ids_cursor = db.matches.find(
        {"$or": [{"user_a": uid}, {"user_b": uid}]}, {"id": 1}
    )
    match_ids = [m["id"] async for m in match_ids_cursor]
    unread_messages = 0
    unread_match_ids: set = set()
    if match_ids:
        pipeline = [
            {"$match": {
                "match_id": {"$in": match_ids},
                "sender_id": {"$ne": uid},
                "read_by": {"$ne": uid},
            }},
            {"$group": {"_id": "$match_id", "count": {"$sum": 1}}},
        ]
        async for row in db.messages.aggregate(pipeline):
            unread_messages += int(row.get("count") or 0)
            unread_match_ids.add(row["_id"])
    # new matches (no message by me yet, created in last 72h)
    from datetime import timedelta
    cutoff = (now_utc() - timedelta(hours=72)).isoformat()
    new_matches = 0
    if match_ids:
        cursor = db.matches.find({
            "id": {"$in": match_ids},
            "created_at": {"$gte": cutoff},
        })
        async for m in cursor:
            has_my_msg = await db.messages.find_one(
                {"match_id": m["id"], "sender_id": uid}, {"_id": 1}
            )
            if not has_my_msg:
                new_matches += 1
    return {
        "unread_messages": unread_messages,
        "unread_matches": len(unread_match_ids),
        "new_matches": new_matches,
    }


@api_router.post("/me/broadcasts/{bid}/ack")
async def ack_broadcast(bid: str, user=Depends(_require_user)):
    b = await db.broadcasts.find_one({"id": bid})
    if not b:
        raise HTTPException(404, "Broadcast not found")
    await db.broadcast_reads.update_one(
        {"broadcast_id": bid, "user_id": user["id"]},
        {"$set": {"broadcast_id": bid, "user_id": user["id"], "ack_at": now_utc().isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@api_router.post("/me/videos")
async def upload_video(body: VideoUploadRequest, user=Depends(_require_user)):
    if not _is_premium(user):
        raise HTTPException(402, "Video-Uploads sind Premium-Mitgliedern vorbehalten. Bitte schließe ein Premium-Abo ab.")
    if not body.data_url.startswith("data:video/"):
        raise HTTPException(400, "Ungültiger Video-Upload (erwarte data:video/...).")
    _reject_if_bad_video_mime(body.data_url)
    if len(body.data_url) > VIDEO_MAX_RAW_BYTES:
        raise HTTPException(413, "Video zu groß (max. ~30 MB).")
    # Count existing videos BEFORE adding the new one (active + moderation-pending count against quota)
    existing = user.get("videos", []) or []
    if len([v for v in existing if v.get("moderation_status") != "rejected"]) >= VIDEO_MAX_PER_USER:
        raise HTTPException(
            409,
            f"Maximal {VIDEO_MAX_PER_USER} Videos erlaubt. Bitte lösche ein vorhandenes Video, bevor du ein neues hochlädst.",
        )
    # Duration + resolution: we TRUST the caller-provided values (from client-side
    # probe) but clamp them server-side. Trusting is acceptable because the video
    # is still moderated, gets re-probed by staff, and rejected if it deviates.
    duration = float(body.duration_seconds) if body.duration_seconds is not None else None
    width = int(body.width) if body.width is not None else None
    height = int(body.height) if body.height is not None else None
    if duration is not None and duration > VIDEO_MAX_DURATION_SECONDS + 0.5:
        raise HTTPException(413, f"Videos dürfen höchstens {int(VIDEO_MAX_DURATION_SECONDS)} Sekunden lang sein.")
    if width is not None and height is not None:
        longer = max(width, height)
        if longer > VIDEO_MAX_WIDTH:
            raise HTTPException(413, "Videos dürfen max. 1080p Auflösung haben (längere Kante ≤ 1920 px).")
    vid = {
        "id": str(uuid.uuid4()),
        "data": body.data_url,
        "caption": body.caption,
        "duration_seconds": duration,
        "width": width,
        "height": height,
        "created_at": now_utc().isoformat(),
        "moderation_status": "pending",  # admin review
    }
    await db.users.update_one({"id": user["id"]}, {"$push": {"videos": vid}})
    return vid


@api_router.delete("/me/videos/{video_id}")
async def delete_video(video_id: str, user=Depends(_require_user)):
    active_against_user = await db.reports.count_documents({
        "target_type": "user",
        "target_id": user["id"],
        "status": {"$in": ["open", "reviewing"]},
    })
    if active_against_user:
        raise HTTPException(
            423,
            "Videos können derzeit nicht gelöscht werden: Es läuft eine aktive Meldung. Bitte kontaktiere den Support.",
        )
    await db.users.update_one({"id": user["id"]}, {"$pull": {"videos": {"id": video_id}}})
    return {"ok": True}


@api_router.post("/me/boost")
async def activate_boost(body: BoostActivateRequest, user=Depends(_require_user)):
    if not _is_premium(user):
        raise HTTPException(402, "Premium required to activate boost")
    minutes = max(5, min(180, body.duration_minutes))
    new_exp = now_utc() + timedelta(minutes=minutes)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"boost_expires_at": new_exp.isoformat()}},
    )
    await _audit(user["id"], "boost_activated", meta={"minutes": minutes})
    return {"ok": True, "boost_until": new_exp.isoformat()}


@api_router.get("/me/visitors")
async def my_visitors(user=Depends(_require_user), limit: int = Query(40, ge=1, le=200)):
    """
    Visitors of my profile.
    - Premium users: full list within the configured window (e.g. 30 days).
    - Non-premium users: the 3 most-recent visitors are returned unblurred;
      additional visits within the last 24h are returned as blurred silhouettes
      (no name / no photo / just a visited_at timestamp) so free users see that
      there IS more activity without revealing identities.
    """
    cfg = await _get_platform_config()
    window_days = int(cfg.get("visitors_window_days", 30))
    cutoff_premium = (now_utc() - timedelta(days=window_days)).isoformat()
    cutoff_24h = (now_utc() - timedelta(hours=24)).isoformat()
    is_premium = _is_user_premium(user)
    viewer_coords = (user.get("location") or {}).get("coordinates")

    # Free-tier configuration
    free_visible = int(cfg.get("visitors_free_visible", 3))
    free_window_hours = int(cfg.get("visitors_free_blur_window_hours", 24))

    if is_premium:
        q = {"target_id": user["id"], "last_visited_at": {"$gte": cutoff_premium}}
        total = await db.visits.count_documents(q)
        cursor = db.visits.find(q).sort("last_visited_at", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        visitor_ids = [d.get("viewer_id") for d in docs if d.get("viewer_id")]
        users_map: Dict = {}
        if visitor_ids:
            async for u in db.users.find({"id": {"$in": visitor_ids}}):
                users_map[u["id"]] = u
        out = []
        for d in docs:
            vid = d.get("viewer_id")
            vu = users_map.get(vid)
            if not vu or vu.get("banned"):
                continue
            pub = public_user_from_doc(vu, viewer_location=viewer_coords, list_mode=True)
            pub["visited_at"] = d.get("last_visited_at")
            pub["visit_count"] = int(d.get("count", 1))
            pub["blurred"] = False
            out.append(pub)
        return {
            "total": total,
            "window_days": window_days,
            "visitors": out,
            "premium_required": False,
            "is_premium": True,
            "free_visible": None,
            "blurred_total": 0,
        }

    # Free tier: 24h window
    cutoff = (now_utc() - timedelta(hours=free_window_hours)).isoformat()
    q_free = {"target_id": user["id"], "last_visited_at": {"$gte": cutoff}}
    total_free = await db.visits.count_documents(q_free)
    cursor = db.visits.find(q_free).sort("last_visited_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    visible_docs = docs[:free_visible]
    blurred_docs = docs[free_visible:]
    visitor_ids = [d.get("viewer_id") for d in visible_docs if d.get("viewer_id")]
    users_map = {}
    if visitor_ids:
        async for u in db.users.find({"id": {"$in": visitor_ids}}):
            users_map[u["id"]] = u
    visible_out: List[Dict] = []
    for d in visible_docs:
        vid = d.get("viewer_id")
        vu = users_map.get(vid)
        if not vu or vu.get("banned"):
            continue
        pub = public_user_from_doc(vu, viewer_location=viewer_coords, list_mode=True)
        pub["visited_at"] = d.get("last_visited_at")
        pub["visit_count"] = int(d.get("count", 1))
        pub["blurred"] = False
        visible_out.append(pub)
    blurred_out: List[Dict] = []
    for idx, d in enumerate(blurred_docs):
        # We deliberately leak *no* identifying data.
        blurred_out.append({
            "id": f"blurred-{idx}",
            "blurred": True,
            "visited_at": d.get("last_visited_at"),
            "visit_count": int(d.get("count", 1)),
        })
    return {
        "total": total_free,
        "window_days": window_days,
        "window_hours_free": free_window_hours,
        "visitors": visible_out,
        "blurred_visitors": blurred_out,
        "blurred_total": len(blurred_out),
        "free_visible": free_visible,
        "premium_required": len(blurred_out) > 0,
        "is_premium": False,
    }


