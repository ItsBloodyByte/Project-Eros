"""Inclusive Modern Dating Platform - FastAPI backend.

Implements the concept's core features:
- Auth (JWT + bcrypt), registration with consent flags
- Rich profile (gender identity, pronouns, orientation, kinks, relationship types, preferences, privacy)
- Photo upload with AI moderation (Gemini Vision: nsfw_score, has_face, category)
- Gallery discovery with bidirectional filtering (Alice-Werner principle) + one-way filters
- Likes & mutual matches
- Real-time chat via WebSocket (post-match only), read receipts, typing, self-destructing media
- Albums with sharing + unlock requests
- Reports + admin moderation
- GDPR export + account delete
- Privacy: rounded distance, online-status toggle, hidden mode
"""
import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Dict

from fastapi import FastAPI, APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.encoders import jsonable_encoder
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from auth import (
    hash_password,
    verify_password,
    create_token,
    decode_token,
    get_current_user_payload,
)
from helpers import now_utc, public_user_from_doc, rounded_distance_km, haversine_km, serialize_doc, parse_dt, contains_link_like
from moderation import moderate_image
from models import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    ProfileUpdate,
    PhotoUploadRequest,
    LikeRequest,
    LikeResponse,
    SendMessageRequest,
    AlbumCreate,
    AlbumShareRequest,
    AlbumUnlockRequest,
    ReportCreate,
    AdminBanRequest,
    UserPublic,
    MatchItem,
    MessagePublic,
    AlbumPublic,
    ReportPublic,
    ChatPrefsUpdate,
    EmailVerifyRequest,
    MfaSetupResponse,
    MfaEnableRequest,
    MfaDisableRequest,
    LoginMfaRequest,
    VideoUploadRequest,
    PremiumUpgradeRequest,
    BoostActivateRequest,
    MessageFirstRequest,
    EventCreate,
    EventRsvpRequest,
    AdminSetRoleRequest,
    TravelPlanCreate,
    IdVerificationSubmit,
    AdminReviewIdRequest,
    CheckoutRequest,
    PaymentConfigUpdate,
    PaymentPackage,
    AIConfigUpdate,
    AdminUserUpdate,
    LegalPageUpdate,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Inclusive Dating Platform API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("app")


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        await db.users.create_index([("location", "2dsphere")])
        await db.likes.create_index([("from_user", 1), ("to_user", 1)], unique=True)
        await db.matches.create_index("id", unique=True)
        await db.messages.create_index([("match_id", 1), ("created_at", 1)])
        await db.albums.create_index("id", unique=True)
        await db.reports.create_index("id", unique=True)
        await db.audit.create_index("created_at")
        await db.events.create_index("id", unique=True)
        await db.events.create_index("starts_at")
        await db.legal_pages.create_index("key", unique=True)
        logger.info("Mongo indexes ensured.")
    except Exception as e:
        logger.exception("Index creation failed: %s", e)

    # One-time migration: disable hide_seen for all existing users (per UX decision:
    # already-viewed profiles should remain visible, only marked with an eye icon).
    try:
        flag = await db.settings.find_one({"key": "migration_hide_seen_off_v1"})
        if not flag:
            res = await db.users.update_many(
                {"preferences.hide_seen": True},
                {"$set": {"preferences.hide_seen": False}},
            )
            await db.settings.insert_one({
                "key": "migration_hide_seen_off_v1",
                "applied_at": now_utc().isoformat(),
                "modified_count": getattr(res, "modified_count", 0),
            })
            logger.info("Migration: disabled hide_seen for %s users", getattr(res, "modified_count", 0))
    except Exception as e:
        logger.exception("hide_seen migration failed: %s", e)


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---------- Helpers ----------
async def _get_user_doc(user_id: str) -> dict:
    doc = await db.users.find_one({"id": user_id})
    if not doc:
        raise HTTPException(404, "User not found")
    return doc


async def _require_user(payload: dict = Depends(get_current_user_payload)) -> dict:
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "User no longer exists")
    if user.get("banned"):
        raise HTTPException(403, "Account banned")
    # Update last_active
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"last_active": now_utc().isoformat()}}
    )
    return user


async def _require_role(user: dict, allowed: List[str]):
    if user.get("role", "user") not in allowed:
        raise HTTPException(403, "Insufficient role")


async def _audit(actor_id: str, action: str, target: Optional[str] = None, meta: Optional[dict] = None):
    await db.audit.insert_one(
        {
            "id": str(uuid.uuid4()),
            "actor_id": actor_id,
            "action": action,
            "target": target,
            "meta": meta or {},
            "created_at": now_utc().isoformat(),
        }
    )


# ---------- Public ----------
@api_router.get("/")
async def root():
    return {"message": "Inclusive Dating Platform API", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "ok", "time": now_utc().isoformat()}


@api_router.post("/client-event")
async def client_event(payload: dict):
    """Lightweight, unauthenticated telemetry used e.g. by the screenshot
    deterrent to signal attempts. Rate-limit externally in production."""
    await db.client_events.insert_one({
        "id": str(uuid.uuid4()),
        "type": str(payload.get("type", "unknown"))[:40],
        "reason": str(payload.get("reason", ""))[:80],
        "created_at": now_utc().isoformat(),
    })
    return {"ok": True}


# ---------- Auth ----------
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(body: RegisterRequest):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(409, "Email already registered")
    if not (body.consents.terms and body.consents.privacy and body.consents.sensitive_data):
        raise HTTPException(400, "Required consents must be accepted")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "display_name": body.display_name,
        "age": body.age,
        "gender_identity": body.gender_identity,
        "pronouns": None,
        "orientation": None,
        "bio": None,
        "location": None,
        "photos": [],
        "preferences": {
            "age_min": max(18, body.age - 10),
            "age_max": body.age + 10,
            "seeking_genders": [],
            "radius_km": 50,
            "relationship_types": [],
            "seeking_roles": [],
            "kinks": [],
            "only_with_photos": True,
            "only_face_photo": False,
            "only_verified": False,
            "hide_seen": False,
            "online_only": False,
        },
        "privacy": {
            "read_receipts": True,
            "show_online_status": True,
            "show_typing": True,
            "hidden_mode": False,
            "screenshot_notifications": True,
        },
        "relationship_types": [],
        "seeking_roles": [],
        "kinks": [],
        "verified": False,
        "banned": False,
        "role": "user",
        "consents": {
            "terms": True,
            "privacy": True,
            "sensitive_data": True,
            "nsfw_view": body.consents.nsfw_view,
            "accepted_at": now_utc().isoformat(),
            "version": 1,
        },
        "seen_user_ids": [],
        "created_at": now_utc().isoformat(),
        "last_active": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    await _audit(user_id, "register", user_id)
    token = create_token(user_id)
    return TokenResponse(access_token=token, user=UserPublic(**public_user_from_doc(doc)))


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    doc = await db.users.find_one({"email": body.email.lower()})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    if doc.get("banned"):
        raise HTTPException(403, "Account banned")
    token = create_token(doc["id"], doc.get("role", "user"))
    await db.users.update_one({"id": doc["id"]}, {"$set": {"last_active": now_utc().isoformat()}})
    await _audit(doc["id"], "login")
    return TokenResponse(access_token=token, user=UserPublic(**public_user_from_doc(doc)))


# ---------- Profile ----------
@api_router.get("/me")
async def me(user=Depends(_require_user)):
    pub = public_user_from_doc(user)
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
        "cup_size", "penis_length_cm", "penis_girth_cm",
    ]:
        val = getattr(body, field)
        if val is None:
            continue
        if field in immutable_once_set and user.get(field) not in (None, "", 0):
            # silently ignore age changes after it is set
            continue
        update[field] = val
    if body.location is not None:
        update["location"] = {"type": "Point", "coordinates": body.location.coordinates}
    if body.preferences is not None:
        update["preferences"] = body.preferences.model_dump()
    if body.privacy is not None:
        update["privacy"] = body.privacy.model_dump()
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]})
    return public_user_from_doc(fresh)


# ---------- Photos ----------
@api_router.post("/me/photos")
async def upload_photo(body: PhotoUploadRequest, user=Depends(_require_user)):
    if not body.data_url.startswith("data:image/"):
        raise HTTPException(400, "Invalid image data URL")
    # Basic size guard: base64 chars. ~1.37x raw. Limit ~8MB raw.
    if len(body.data_url) > 11_000_000:
        raise HTTPException(413, "Image too large (max ~8MB)")
    # Hard cap: max 5 photos per user (1 primary + 4 secondary)
    MAX_PHOTOS = 5
    current = user.get("photos", [])
    if len(current) >= MAX_PHOTOS:
        raise HTTPException(400, f"Maximal {MAX_PHOTOS} Fotos erlaubt")
    photo_id = str(uuid.uuid4())
    mod = await moderate_image(body.data_url, session_tag=f"photo-{photo_id}")
    photo = {
        "id": photo_id,
        "data": body.data_url,
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
    if active_against_user or active_against_photo:
        raise HTTPException(
            423,
            "Fotos können derzeit nicht gelöscht werden: Es läuft eine aktive Meldung. Bitte kontaktiere den Support.",
        )
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


# ---------- Discovery (bidirectional filter) ----------
@api_router.get("/discover")
async def discover(
    user=Depends(_require_user),
    limit: int = Query(20, ge=1, le=60),
    skip: int = Query(0, ge=0),
):
    prefs = user.get("preferences", {}) or {}
    loc = user.get("location")
    my_gender = user.get("gender_identity")
    my_age = user.get("age", 0)
    seen = set(user.get("seen_user_ids", []) or [])
    blocked = set(user.get("blocked_user_ids", []) or [])

    query: Dict = {
        "id": {"$ne": user["id"]},
        "banned": {"$ne": True},
        "privacy.hidden_mode": {"$ne": True},
        "age": {
            "$gte": prefs.get("age_min", 18),
            "$lte": prefs.get("age_max", 99),
        },
    }
    # Exclude users who blocked me OR whom I blocked
    exclude_ids = set(blocked)
    # Users who blocked me
    async for bdoc in db.users.find({"blocked_user_ids": user["id"]}, {"id": 1}):
        exclude_ids.add(bdoc["id"])
    if exclude_ids:
        query["id"] = {"$ne": user["id"], "$nin": list(exclude_ids)}

    # One-way filters from viewer
    if prefs.get("seeking_genders"):
        query["gender_identity"] = {"$in": prefs["seeking_genders"]}
    if prefs.get("relationship_types"):
        query["relationship_types"] = {"$in": prefs["relationship_types"]}
    if prefs.get("seeking_roles"):
        query["seeking_roles"] = {"$in": prefs["seeking_roles"]}
    if prefs.get("only_with_photos"):
        query["photos.0"] = {"$exists": True}
    if prefs.get("only_face_photo"):
        query["photos.has_face"] = True
    if prefs.get("only_verified"):
        query["verified"] = True
    if prefs.get("hide_seen") and seen:
        cur = query.get("id", {"$ne": user["id"]})
        if "$nin" in cur:
            cur["$nin"] = list(set(cur["$nin"]) | seen)
        else:
            cur["$nin"] = list(seen)
        query["id"] = cur

    # Phase 4 extended filters
    if prefs.get("body_types"):
        query["body_type"] = {"$in": prefs["body_types"]}
    if prefs.get("min_height_cm") or prefs.get("max_height_cm"):
        h: Dict = {}
        if prefs.get("min_height_cm"):
            h["$gte"] = int(prefs["min_height_cm"])
        if prefs.get("max_height_cm"):
            h["$lte"] = int(prefs["max_height_cm"])
        if h:
            query["height_cm"] = h
    if prefs.get("smoking"):
        query["smoking"] = {"$in": prefs["smoking"]}
    if prefs.get("drinking"):
        query["drinking"] = {"$in": prefs["drinking"]}
    if prefs.get("diet"):
        query["diet"] = {"$in": prefs["diet"]}
    if prefs.get("sti_status"):
        query["sti_status"] = {"$in": prefs["sti_status"]}
    if prefs.get("cup_sizes"):
        query["cup_size"] = {"$in": prefs["cup_sizes"]}
    if prefs.get("languages"):
        query["languages"] = {"$in": prefs["languages"]}
    if prefs.get("ethnicities"):
        query["ethnicity"] = {"$in": prefs["ethnicities"]}
    if prefs.get("kinks"):
        # Others only appear if they also list at least one of the viewer's kinks.
        query["kinks"] = {"$in": prefs["kinks"]}

    # Bidirectional: their preferences must also match me
    if my_gender:
        query["preferences.seeking_genders"] = my_gender
    if my_age:
        query["preferences.age_min"] = {"$lte": my_age}
        query["preferences.age_max"] = {"$gte": my_age}

    # Radius (geo)
    geo_applied = False
    if loc and loc.get("coordinates") and prefs.get("radius_km"):
        query["location"] = {
            "$near": {
                "$geometry": loc,
                "$maxDistance": int(prefs["radius_km"]) * 1000,
            }
        }
        geo_applied = True

    cursor = db.users.find(query).skip(skip).limit(limit * 2)
    docs = await cursor.to_list(length=limit * 2)

    now_iso = now_utc().isoformat()
    # Boost sort: active boosts first, then original order.
    docs.sort(key=lambda d: 0 if (d.get("boost_expires_at") or "") > now_iso else 1)
    docs = docs[:limit]

    viewer_coords = loc.get("coordinates") if loc else None
    results = []
    wanted_penis = set(prefs.get("penis_categories") or [])
    for d in docs:
        pub = public_user_from_doc(d, viewer_location=viewer_coords)
        pub["boosted"] = (d.get("boost_expires_at") or "") > now_iso
        pub["is_premium"] = (d.get("premium_expires_at") or "") > now_iso
        # Penis category post-filter (derived)
        if wanted_penis:
            if pub.get("penis_category") not in wanted_penis:
                continue
        # Online-only post-filter (privacy-aware)
        if prefs.get("online_only") and not pub["is_online"]:
            continue
        results.append(pub)
    return {"results": results, "has_more": len(docs) == limit, "geo_applied": geo_applied}


@api_router.post("/seen/{user_id}")
async def mark_seen(user_id: str, user=Depends(_require_user)):
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"seen_user_ids": user_id}})
    return {"ok": True}


@api_router.get("/users/{user_id}")
async def view_user(user_id: str, user=Depends(_require_user)):
    doc = await _get_user_doc(user_id)
    is_admin = user.get("role") in {"admin", "moderator", "superadmin", "content_reviewer", "support"}
    is_self = user_id == user["id"]
    if not is_admin and not is_self:
        if doc.get("banned") or doc.get("privacy", {}).get("hidden_mode"):
            raise HTTPException(404, "Not found")
    pub = public_user_from_doc(
        doc, viewer_location=(user.get("location") or {}).get("coordinates")
    )
    # Has the current user liked this user?
    my_like = await db.likes.find_one({"from_user": user["id"], "to_user": user_id})
    their_like = await db.likes.find_one({"from_user": user_id, "to_user": user["id"]})
    match = None
    if my_like and their_like:
        m = await db.matches.find_one(
            {"$or": [
                {"user_a": user["id"], "user_b": user_id},
                {"user_a": user_id, "user_b": user["id"]},
            ]}
        )
        match = m["id"] if m else None
    extra = {}
    if is_admin:
        extra = {
            "admin_view": True,
            "email": doc.get("email"),
            "banned": bool(doc.get("banned")),
            "ban_reason": doc.get("ban_reason"),
            "hidden_mode": bool((doc.get("privacy") or {}).get("hidden_mode")),
            "last_active": doc.get("last_active"),
            "role_of_target": doc.get("role", "user"),
        }
    return {**pub, "i_liked": bool(my_like), "they_liked": bool(their_like), "match_id": match, **extra}


# ---------- Likes & Matches ----------
@api_router.post("/likes", response_model=LikeResponse)
async def create_like(body: LikeRequest, user=Depends(_require_user)):
    if body.target_user_id == user["id"]:
        raise HTTPException(400, "Cannot like yourself")
    target = await db.users.find_one({"id": body.target_user_id})
    if not target or target.get("banned"):
        raise HTTPException(404, "Target not found")
    like_doc = {
        "id": str(uuid.uuid4()),
        "from_user": user["id"],
        "to_user": body.target_user_id,
        "created_at": now_utc().isoformat(),
    }
    try:
        await db.likes.insert_one(like_doc)
    except Exception:
        pass  # already liked
    # Check mutual
    mutual = await db.likes.find_one(
        {"from_user": body.target_user_id, "to_user": user["id"]}
    )
    if mutual:
        # ensure match exists
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
            await db.matches.insert_one(
                {
                    "id": match_id,
                    "user_a": user["id"],
                    "user_b": body.target_user_id,
                    "created_at": now_utc().isoformat(),
                    "last_message_at": None,
                }
            )
            await _audit(user["id"], "match_created", match_id)
        return LikeResponse(liked=True, matched=True, match_id=match_id)
    return LikeResponse(liked=True, matched=False)


@api_router.delete("/likes/{target_user_id}")
async def unlike(target_user_id: str, user=Depends(_require_user)):
    await db.likes.delete_one({"from_user": user["id"], "to_user": target_user_id})
    return {"ok": True}


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


@api_router.post("/users/{target_user_id}/block")
async def block_user(target_user_id: str, user=Depends(_require_user)):
    if target_user_id == user["id"]:
        raise HTTPException(400, "Cannot block yourself")
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"blocked_user_ids": target_user_id}})
    # Also break any match/likes
    await db.likes.delete_many({
        "$or": [
            {"from_user": user["id"], "to_user": target_user_id},
            {"from_user": target_user_id, "to_user": user["id"]},
        ]
    })
    match = await db.matches.find_one({
        "$or": [
            {"user_a": user["id"], "user_b": target_user_id},
            {"user_a": target_user_id, "user_b": user["id"]},
        ]
    })
    if match:
        await db.matches.delete_one({"id": match["id"]})
        await db.messages.delete_many({"match_id": match["id"]})
    await _audit(user["id"], "block_user", target_user_id)
    return {"ok": True}


@api_router.delete("/users/{target_user_id}/block")
async def unblock_user(target_user_id: str, user=Depends(_require_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"blocked_user_ids": target_user_id}})
    await _audit(user["id"], "unblock_user", target_user_id)
    return {"ok": True}


@api_router.get("/matches")
async def list_matches(user=Depends(_require_user)):
    cursor = db.matches.find(
        {"$or": [{"user_a": user["id"]}, {"user_b": user["id"]}]}
    ).sort("created_at", -1)
    matches = await cursor.to_list(length=200)
    out = []
    for m in matches:
        other_id = m["user_b"] if m["user_a"] == user["id"] else m["user_a"]
        other = await db.users.find_one({"id": other_id})
        if not other or other.get("banned"):
            continue
        pub = public_user_from_doc(other, viewer_location=(user.get("location") or {}).get("coordinates"))
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
            }
        )
    return {"matches": out}


async def _match_or_403(match_id: str, user_id: str) -> dict:
    m = await db.matches.find_one({"id": match_id})
    if not m:
        raise HTTPException(404, "Match not found")
    if user_id not in (m["user_a"], m["user_b"]):
        raise HTTPException(403, "Not in match")
    return m


@api_router.get("/matches/{match_id}/messages")
async def list_messages(match_id: str, user=Depends(_require_user), limit: int = 100):
    await _match_or_403(match_id, user["id"])
    # cleanup self-destruct expired
    now_iso = now_utc().isoformat()
    await db.messages.delete_many(
        {"match_id": match_id, "self_destruct_at": {"$lte": now_iso}}
    )
    cursor = db.messages.find({"match_id": match_id}).sort("created_at", 1).limit(limit)
    items = await cursor.to_list(length=limit)
    # mark as read
    await db.messages.update_many(
        {"match_id": match_id, "sender_id": {"$ne": user["id"]}, "read_by": {"$ne": user["id"]}},
        {"$addToSet": {"read_by": user["id"]}},
    )
    return {"messages": serialize_doc(items)}


@api_router.post("/messages")
async def send_message(body: SendMessageRequest, user=Depends(_require_user)):
    m = await _match_or_403(body.match_id, user["id"])
    if not body.text and not body.media_data_url:
        raise HTTPException(400, "Message must have text or media")
    if body.text and contains_link_like(body.text):
        raise HTTPException(400, "Links sind im Chat nicht erlaubt.")
    nsfw_score = None
    if body.media_data_url:
        if not body.media_data_url.startswith("data:image/"):
            raise HTTPException(400, "Only image media supported in MVP")
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
    # push via WS if subscribers
    other_id = m["user_b"] if m["user_a"] == user["id"] else m["user_a"]
    await ws_manager.broadcast(body.match_id, {
        "type": "message",
        "message": serialize_doc(msg),
        "for_users": [user["id"], other_id],
    })
    return serialize_doc(msg)


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


# ---------- WebSocket Chat ----------
class WSManager:
    def __init__(self):
        # match_id -> list of (user_id, ws)
        self.rooms: Dict[str, List] = {}

    async def connect(self, match_id: str, user_id: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(match_id, []).append((user_id, ws))

    def disconnect(self, match_id: str, user_id: str, ws: WebSocket):
        if match_id in self.rooms:
            self.rooms[match_id] = [(u, w) for (u, w) in self.rooms[match_id] if w is not ws]
            if not self.rooms[match_id]:
                del self.rooms[match_id]

    async def broadcast(self, match_id: str, payload: dict):
        conns = self.rooms.get(match_id, [])
        dead = []
        for uid, w in conns:
            try:
                await w.send_json(payload)
            except Exception:
                dead.append((uid, w))
        for uid, w in dead:
            self.disconnect(match_id, uid, w)


ws_manager = WSManager()


@app.websocket("/api/ws/chat/{match_id}")
async def ws_chat(websocket: WebSocket, match_id: str, token: str = Query(...)):
    try:
        payload = decode_token(token)
    except HTTPException:
        await websocket.close(code=4401)
        return
    user_id = payload["sub"]
    m = await db.matches.find_one({"id": match_id})
    if not m or user_id not in (m["user_a"], m["user_b"]):
        await websocket.close(code=4403)
        return
    await ws_manager.connect(match_id, user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                evt = json.loads(data)
            except Exception:
                continue
            if evt.get("type") == "typing":
                # forward typing indicator
                sender = await db.users.find_one({"id": user_id})
                if (sender or {}).get("privacy", {}).get("show_typing", True):
                    await ws_manager.broadcast(match_id, {
                        "type": "typing",
                        "from": user_id,
                        "is_typing": bool(evt.get("is_typing")),
                    })
            elif evt.get("type") == "screenshot":
                # notify the other user
                sender = await db.users.find_one({"id": user_id})
                if (sender or {}).get("privacy", {}).get("screenshot_notifications", True):
                    await ws_manager.broadcast(match_id, {
                        "type": "screenshot",
                        "from": user_id,
                    })
                # Always log screenshot events to the audit trail so moderators can review
                try:
                    await _audit(user_id, "screenshot_detected", match_id, {"match_id": match_id})
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(match_id, user_id, websocket)


# ---------- Albums ----------
@api_router.post("/albums", response_model=AlbumPublic)
async def create_album(body: AlbumCreate, user=Depends(_require_user)):
    album = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "title": body.title,
        "description": body.description,
        "is_nsfw": body.is_nsfw,
        "photos": [],
        "shared_with": [],
        "unlock_requests": [],
        "created_at": now_utc().isoformat(),
    }
    await db.albums.insert_one(album)
    return AlbumPublic(**{k: v for k, v in album.items() if k != "unlock_requests"})


@api_router.get("/albums")
async def list_my_albums(user=Depends(_require_user)):
    cursor = db.albums.find({"owner_id": user["id"]})
    items = await cursor.to_list(length=200)
    return {"albums": serialize_doc(items)}


@api_router.get("/albums/{album_id}")
async def get_album(album_id: str, user=Depends(_require_user)):
    a = await db.albums.find_one({"id": album_id})
    if not a:
        raise HTTPException(404, "Album not found")
    is_owner = a["owner_id"] == user["id"]
    if not is_owner:
        shares = a.get("shared_with", [])
        share = next((s for s in shares if s["user_id"] == user["id"]), None)
        if not share:
            return {
                "id": a["id"],
                "owner_id": a["owner_id"],
                "title": a["title"],
                "is_nsfw": a["is_nsfw"],
                "locked": True,
                "photos": [],
                "description": a.get("description"),
            }
        # check expiry
        if share.get("expires_at") and share["expires_at"] < now_utc().isoformat():
            return {"id": a["id"], "owner_id": a["owner_id"], "title": a["title"], "locked": True, "photos": []}
    return serialize_doc(a)


@api_router.post("/albums/{album_id}/photos")
async def add_album_photo(album_id: str, body: PhotoUploadRequest, user=Depends(_require_user)):
    a = await db.albums.find_one({"id": album_id})
    if not a or a["owner_id"] != user["id"]:
        raise HTTPException(404, "Album not found")
    if not body.data_url.startswith("data:image/"):
        raise HTTPException(400, "Invalid image data URL")
    mod = await moderate_image(body.data_url, session_tag=f"album-{album_id}")
    photo = {
        "id": str(uuid.uuid4()),
        "data": body.data_url,
        "nsfw_score": mod["nsfw_score"],
        "has_face": mod["has_face"],
        "category": mod["category"],
        "labels": mod["labels"],
        "created_at": now_utc().isoformat(),
        "is_primary": False,
    }
    await db.albums.update_one({"id": album_id}, {"$push": {"photos": photo}})
    return photo


@api_router.post("/albums/share")
async def share_album(body: AlbumShareRequest, user=Depends(_require_user)):
    a = await db.albums.find_one({"id": body.album_id})
    if not a or a["owner_id"] != user["id"]:
        raise HTTPException(404, "Album not found")
    # must be a match
    match = await db.matches.find_one(
        {"$or": [
            {"user_a": user["id"], "user_b": body.user_id},
            {"user_a": body.user_id, "user_b": user["id"]},
        ]}
    )
    if not match:
        raise HTTPException(403, "Can only share with a mutual match")
    share = {
        "user_id": body.user_id,
        "expires_at": body.expires_at.isoformat() if body.expires_at else None,
        "granted_at": now_utc().isoformat(),
    }
    await db.albums.update_one(
        {"id": body.album_id},
        {"$pull": {"shared_with": {"user_id": body.user_id}}},
    )
    await db.albums.update_one(
        {"id": body.album_id},
        {"$push": {"shared_with": share}},
    )
    return {"ok": True}


@api_router.post("/albums/unlock-request")
async def request_unlock(body: AlbumUnlockRequest, user=Depends(_require_user)):
    a = await db.albums.find_one({"id": body.album_id})
    if not a:
        raise HTTPException(404, "Album not found")
    req = {
        "id": str(uuid.uuid4()),
        "from_user": user["id"],
        "message": body.message,
        "created_at": now_utc().isoformat(),
        "status": "pending",
    }
    await db.albums.update_one({"id": body.album_id}, {"$push": {"unlock_requests": req}})
    return {"ok": True}


# ---------- Reports & Admin ----------
# NOTE: The /reports POST handler with request+IP tracking and auto-mod is defined later in Phase 5.


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


_ADMIN_EDITABLE_FIELDS = {
    "display_name", "age", "email", "gender_identity", "pronouns", "orientation", "bio",
    "relationship_types", "seeking_roles", "kinks",
    "height_cm", "body_type", "ethnicity", "languages", "interests",
    "smoking", "drinking", "diet", "sti_status", "sti_tested_on",
    "cup_size", "penis_length_cm", "penis_girth_cm",
    "preferences", "privacy", "location",
    "verified", "id_verified", "id_verification_status",
    "email_verified", "banned", "ban_reason", "shadow_restricted",
    "boost_expires_at", "premium_expires_at",
}


@api_router.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, payload: dict, user=Depends(_require_user)):
    """Admin-only: override any user field. Bypasses regular immutability (e.g. age)."""
    await _require_role(user, ["admin", "superadmin"])
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    clean: Dict = {}
    unset: Dict = {}
    for k, v in (payload or {}).items():
        if k not in _ADMIN_EDITABLE_FIELDS:
            continue
        if v is None:
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
async def admin_moderation_photos(user=Depends(_require_user), threshold: float = 0.5):
    await _require_role(user, ["admin", "moderator", "content_reviewer", "superadmin"])
    cursor = db.users.find(
        {"photos.nsfw_score": {"$gte": threshold}},
        {"password_hash": 0}
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
    return {"photos": out}


# ---------- GDPR ----------
@api_router.get("/gdpr/export")
async def gdpr_export(user=Depends(_require_user)):
    my_likes = await db.likes.find({"$or": [{"from_user": user["id"]}, {"to_user": user["id"]}]}).to_list(1000)
    my_matches = await db.matches.find({"$or": [{"user_a": user["id"]}, {"user_b": user["id"]}]}).to_list(1000)
    match_ids = [m["id"] for m in my_matches]
    my_msgs = await db.messages.find({"match_id": {"$in": match_ids}}).to_list(10000)
    my_albums = await db.albums.find({"owner_id": user["id"]}).to_list(500)
    data = {
        "profile": serialize_doc({k: v for k, v in user.items() if k != "password_hash"}),
        "likes": serialize_doc(my_likes),
        "matches": serialize_doc(my_matches),
        "messages": serialize_doc(my_msgs),
        "albums": serialize_doc(my_albums),
        "exported_at": now_utc().isoformat(),
    }
    await _audit(user["id"], "gdpr_export")
    return data


@api_router.delete("/gdpr/account")
async def gdpr_delete(user=Depends(_require_user)):
    uid = user["id"]
    await db.users.delete_one({"id": uid})
    await db.likes.delete_many({"$or": [{"from_user": uid}, {"to_user": uid}]})
    matches = await db.matches.find({"$or": [{"user_a": uid}, {"user_b": uid}]}).to_list(1000)
    match_ids = [m["id"] for m in matches]
    await db.matches.delete_many({"id": {"$in": match_ids}})
    await db.messages.delete_many({"match_id": {"$in": match_ids}})
    await db.albums.delete_many({"owner_id": uid})
    await _audit(uid, "account_deleted")
    return {"ok": True}


# =====================================================================
# Phase 3: Email verification, MFA, Videos, Premium+Boost, Events, Roles
# =====================================================================
import random
import pyotp  # noqa: E402


# --------- Email verification (in-app code) ---------
@api_router.post("/auth/email/send-code")
async def send_email_code(user=Depends(_require_user)):
    code = f"{random.randint(0, 999999):06d}"
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "email_verification": {
                "code": code,
                "issued_at": now_utc().isoformat(),
                "expires_at": (now_utc() + timedelta(minutes=15)).isoformat(),
            }
        }},
    )
    await _audit(user["id"], "email_verify_code_sent")
    # In production this would be emailed. For MVP, we return a dev_code so the UI
    # and automated tests can complete the flow end-to-end.
    return {"ok": True, "dev_code": code, "expires_in_minutes": 15}


@api_router.post("/auth/email/verify")
async def verify_email(body: EmailVerifyRequest, user=Depends(_require_user)):
    ev = (user.get("email_verification") or {})
    if not ev.get("code"):
        raise HTTPException(400, "No code requested")
    if ev.get("expires_at") and ev["expires_at"] < now_utc().isoformat():
        raise HTTPException(400, "Code expired")
    if body.code != ev["code"]:
        raise HTTPException(400, "Invalid code")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"email_verified": True}, "$unset": {"email_verification": ""}},
    )
    await _audit(user["id"], "email_verified")
    return {"ok": True}


# --------- MFA (TOTP) ---------
@api_router.post("/auth/mfa/setup", response_model=MfaSetupResponse)
async def mfa_setup(user=Depends(_require_user)):
    secret = pyotp.random_base32()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"mfa_pending_secret": secret}},
    )
    uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=user["email"], issuer_name="Eros"
    )
    return MfaSetupResponse(secret=secret, otpauth_url=uri)


@api_router.post("/auth/mfa/enable")
async def mfa_enable(body: MfaEnableRequest, user=Depends(_require_user)):
    secret = user.get("mfa_pending_secret")
    if not secret:
        raise HTTPException(400, "MFA not set up")
    if not pyotp.TOTP(secret).verify(body.code, valid_window=1):
        raise HTTPException(400, "Invalid code")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"mfa_enabled": True, "mfa_secret": secret},
         "$unset": {"mfa_pending_secret": ""}},
    )
    await _audit(user["id"], "mfa_enabled")
    return {"ok": True}


@api_router.post("/auth/mfa/disable")
async def mfa_disable(body: MfaDisableRequest, user=Depends(_require_user)):
    secret = user.get("mfa_secret")
    if not secret:
        raise HTTPException(400, "MFA not enabled")
    if not pyotp.TOTP(secret).verify(body.code, valid_window=1):
        raise HTTPException(400, "Invalid code")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"mfa_enabled": False}, "$unset": {"mfa_secret": ""}},
    )
    await _audit(user["id"], "mfa_disabled")
    return {"ok": True}


@api_router.post("/auth/login-mfa", response_model=TokenResponse)
async def login_mfa(body: LoginMfaRequest):
    doc = await db.users.find_one({"email": body.email.lower()})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    if doc.get("banned"):
        raise HTTPException(403, "Account banned")
    if doc.get("mfa_enabled"):
        if not body.mfa_code:
            raise HTTPException(401, "MFA required")
        if not pyotp.TOTP(doc["mfa_secret"]).verify(body.mfa_code, valid_window=1):
            raise HTTPException(401, "Invalid MFA code")
    token = create_token(doc["id"], doc.get("role", "user"))
    await db.users.update_one({"id": doc["id"]}, {"$set": {"last_active": now_utc().isoformat()}})
    await _audit(doc["id"], "login_mfa" if doc.get("mfa_enabled") else "login")
    return TokenResponse(access_token=token, user=UserPublic(**public_user_from_doc(doc)))


# --------- Video clips ---------
@api_router.post("/me/videos")
async def upload_video(body: VideoUploadRequest, user=Depends(_require_user)):
    if not body.data_url.startswith("data:video/"):
        raise HTTPException(400, "Invalid video data URL (expected data:video/...)")
    # Size guard ~30MB raw
    if len(body.data_url) > 42_000_000:
        raise HTTPException(413, "Video too large (max ~30MB)")
    vid = {
        "id": str(uuid.uuid4()),
        "data": body.data_url,
        "caption": body.caption,
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


@api_router.get("/users/{user_id}/videos")
async def get_user_videos(user_id: str, user=Depends(_require_user)):
    doc = await db.users.find_one({"id": user_id})
    if not doc:
        raise HTTPException(404, "Not found")
    # only show approved videos to others; own videos always visible
    vids = doc.get("videos", []) or []
    if user_id != user["id"]:
        vids = [v for v in vids if v.get("moderation_status") == "approved"]
    return {"videos": serialize_doc(vids)}


# --------- Premium / Boost / Who-liked-me ---------
def _is_premium(doc: dict) -> bool:
    exp = doc.get("premium_expires_at")
    if not exp:
        return False
    try:
        return exp > now_utc().isoformat()
    except Exception:
        return False


def _boost_active(doc: dict) -> bool:
    exp = doc.get("boost_expires_at")
    if not exp:
        return False
    return exp > now_utc().isoformat()


@api_router.post("/premium/upgrade")
async def premium_upgrade(body: PremiumUpgradeRequest, user=Depends(_require_user)):
    days = max(1, min(365, body.duration_days))
    new_exp = now_utc() + timedelta(days=days)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"premium_expires_at": new_exp.isoformat()}},
    )
    await _audit(user["id"], "premium_upgrade", meta={"days": days})
    return {"ok": True, "premium_until": new_exp.isoformat()}


@api_router.post("/premium/cancel")
async def premium_cancel(user=Depends(_require_user)):
    await db.users.update_one({"id": user["id"]}, {"$unset": {"premium_expires_at": ""}})
    return {"ok": True}


@api_router.get("/premium/status")
async def premium_status(user=Depends(_require_user)):
    return {
        "premium": _is_premium(user),
        "premium_until": user.get("premium_expires_at"),
        "boost_active": _boost_active(user),
        "boost_until": user.get("boost_expires_at"),
    }


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


@api_router.get("/likes/received")
async def likes_received(user=Depends(_require_user)):
    """Premium-only: see who liked you."""
    if not _is_premium(user):
        raise HTTPException(402, "Premium required")
    cursor = db.likes.find({"to_user": user["id"]}).sort("created_at", -1).limit(100)
    likes = await cursor.to_list(length=100)
    ids = [ln["from_user"] for ln in likes]
    users = await db.users.find({"id": {"$in": ids}, "banned": {"$ne": True}}).to_list(100)
    by_id = {u["id"]: u for u in users}
    out = []
    viewer_coords = (user.get("location") or {}).get("coordinates")
    for ln in likes:
        u = by_id.get(ln["from_user"])
        if not u or u.get("privacy", {}).get("hidden_mode"):
            continue
        out.append({
            "liked_at": ln["created_at"],
            "user": public_user_from_doc(u, viewer_location=viewer_coords),
        })
    return {"received": out}


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


# --------- Events ---------
@api_router.post("/events")
async def create_event(body: EventCreate, user=Depends(_require_user)):
    ev = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "title": body.title,
        "description": body.description,
        "starts_at": body.starts_at.isoformat(),
        "location_name": body.location_name,
        "location": (
            {"type": "Point", "coordinates": body.location.coordinates}
            if body.location else None
        ),
        "is_nsfw": body.is_nsfw,
        "cover_data_url": body.cover_data_url,
        "rsvps": [],
        "created_at": now_utc().isoformat(),
    }
    await db.events.insert_one(ev)
    await _audit(user["id"], "event_created", ev["id"])
    return serialize_doc(ev)


@api_router.get("/events")
async def list_events(user=Depends(_require_user), upcoming_only: bool = True):
    q: Dict = {}
    if upcoming_only:
        q["starts_at"] = {"$gte": now_utc().isoformat()}
    cursor = db.events.find(q).sort("starts_at", 1).limit(200)
    items = await cursor.to_list(length=200)
    # attach owner display name + counts
    owner_ids = list({ev["owner_id"] for ev in items})
    owners = await db.users.find({"id": {"$in": owner_ids}}).to_list(len(owner_ids))
    owner_map = {u["id"]: u["display_name"] for u in owners}
    out = []
    for ev in items:
        rsvps = ev.get("rsvps", []) or []
        my = next((r for r in rsvps if r["user_id"] == user["id"]), None)
        out.append({
            **serialize_doc(ev),
            "owner_name": owner_map.get(ev["owner_id"], "—"),
            "going_count": sum(1 for r in rsvps if r.get("status") == "going"),
            "interested_count": sum(1 for r in rsvps if r.get("status") == "interested"),
            "my_rsvp": my.get("status") if my else None,
        })
    return {"events": out}


@api_router.get("/events/{event_id}")
async def get_event(event_id: str, user=Depends(_require_user)):
    ev = await db.events.find_one({"id": event_id})
    if not ev:
        raise HTTPException(404, "Event not found")
    owner = await db.users.find_one({"id": ev["owner_id"]})
    rsvps = ev.get("rsvps", []) or []
    # enrich rsvp users with public info
    rsvp_ids = [r["user_id"] for r in rsvps]
    users = await db.users.find({"id": {"$in": rsvp_ids}}).to_list(len(rsvp_ids) or 1)
    by_id = {u["id"]: u for u in users}
    enriched = []
    for r in rsvps:
        u = by_id.get(r["user_id"])
        if u:
            enriched.append({"status": r["status"], "user": public_user_from_doc(u)})
    return {
        **serialize_doc(ev),
        "owner_name": owner["display_name"] if owner else "—",
        "rsvps": enriched,
        "going_count": sum(1 for r in rsvps if r.get("status") == "going"),
        "interested_count": sum(1 for r in rsvps if r.get("status") == "interested"),
        "my_rsvp": next((r["status"] for r in rsvps if r["user_id"] == user["id"]), None),
    }


@api_router.post("/events/{event_id}/rsvp")
async def rsvp_event(event_id: str, body: EventRsvpRequest, user=Depends(_require_user)):
    ev = await db.events.find_one({"id": event_id})
    if not ev:
        raise HTTPException(404, "Event not found")
    await db.events.update_one(
        {"id": event_id},
        {"$pull": {"rsvps": {"user_id": user["id"]}}},
    )
    await db.events.update_one(
        {"id": event_id},
        {"$push": {"rsvps": {"user_id": user["id"], "status": body.status,
                              "at": now_utc().isoformat()}}},
    )
    return {"ok": True}


@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, user=Depends(_require_user)):
    ev = await db.events.find_one({"id": event_id})
    if not ev:
        raise HTTPException(404, "Event not found")
    if ev["owner_id"] != user["id"] and user.get("role") not in {"admin", "moderator", "superadmin"}:
        raise HTTPException(403, "Not allowed")
    await db.events.delete_one({"id": event_id})
    return {"ok": True}


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


# =====================================================================
# Phase 5: Travel, ID Verification, Auto-Mod, User Management, Payments, AI Config
# =====================================================================
from fastapi import Request  # noqa: E402

AUTO_MOD_UNIQUE_REPORT_THRESHOLD = 10


def _client_ip(req: Request) -> str:
    return (req.headers.get("x-forwarded-for") or req.client.host or "").split(",")[0].strip()


# --- Auto-Mod: count unique reporter IPs, shadow-restrict when threshold crossed ---
async def _maybe_shadow_restrict(target_user_id: str):
    pipeline = [
        {"$match": {"target_type": "user", "target_id": target_user_id, "status": {"$ne": "rejected"}}},
        {"$group": {"_id": "$reporter_ip"}},
        {"$count": "unique"},
    ]
    cur = db.reports.aggregate(pipeline)
    rows = await cur.to_list(1)
    unique = rows[0]["unique"] if rows else 0
    if unique >= AUTO_MOD_UNIQUE_REPORT_THRESHOLD:
        await db.users.update_one(
            {"id": target_user_id, "shadow_restricted": {"$ne": True}},
            {"$set": {
                "shadow_restricted": True,
                "shadow_reason": f"auto-mod: {unique} unique reports",
                "shadow_restricted_at": now_utc().isoformat(),
            }},
        )
        await _audit("auto-mod", "shadow_restrict", target_user_id, {"unique_reports": unique})


# --- Patch create_report to track ip + auto-mod ---
@api_router.post("/reports", response_model=ReportPublic)
async def create_report(body: ReportCreate, request: Request, user=Depends(_require_user)):
    ip = _client_ip(request)
    # prevent spam: one open report per (reporter,target)
    existing = await db.reports.find_one({
        "reporter_id": user["id"], "target_id": body.target_id, "target_type": body.target_type,
        "status": {"$in": ["open", "reviewing"]},
    })
    if existing:
        return ReportPublic(**{**existing, "created_at": now_utc()})
    r = {
        "id": str(uuid.uuid4()),
        "reporter_id": user["id"],
        "reporter_ip": ip,
        "target_type": body.target_type,
        "target_id": body.target_id,
        "reason": body.reason,
        "detail": body.detail,
        "status": "open",
        "created_at": now_utc().isoformat(),
    }
    await db.reports.insert_one(r)
    await _audit(user["id"], "report_created", r["id"], {"target": body.target_id})
    if body.target_type == "user":
        await _maybe_shadow_restrict(body.target_id)
    return ReportPublic(**{**r, "created_at": now_utc()})


# --- Travel plans ---
@api_router.post("/travel")
async def create_travel(body: TravelPlanCreate, user=Depends(_require_user)):
    plan = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "city": body.city,
        "country": body.country,
        "location": (
            {"type": "Point", "coordinates": body.location.coordinates}
            if body.location else None
        ),
        "starts_at": body.starts_at.isoformat(),
        "ends_at": body.ends_at.isoformat(),
        "note": body.note,
        "created_at": now_utc().isoformat(),
    }
    await db.travel.insert_one(plan)
    await _audit(user["id"], "travel_created", plan["id"])
    return serialize_doc(plan)


@api_router.get("/travel/mine")
async def list_my_travel(user=Depends(_require_user)):
    items = await db.travel.find({"user_id": user["id"]}).sort("starts_at", 1).to_list(100)
    return {"plans": serialize_doc(items)}


@api_router.delete("/travel/{plan_id}")
async def delete_travel(plan_id: str, user=Depends(_require_user)):
    await db.travel.delete_one({"id": plan_id, "user_id": user["id"]})
    return {"ok": True}


# --- ID Verification ---
@api_router.post("/verification/id")
async def submit_id_verification(body: IdVerificationSubmit, user=Depends(_require_user)):
    for dataurl in [body.selfie_data_url, body.document_data_url]:
        if not dataurl.startswith("data:image/"):
            raise HTTPException(400, "Invalid image data URL")
    rec = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "document_type": body.document_type,
        "selfie_data_url": body.selfie_data_url,
        "document_data_url": body.document_data_url,
        "status": "pending",
        "submitted_at": now_utc().isoformat(),
    }
    await db.id_verifications.insert_one(rec)
    await db.users.update_one({"id": user["id"]}, {"$set": {"id_verification_status": "pending"}})
    return {"ok": True, "status": "pending"}


@api_router.get("/admin/verifications")
async def admin_list_verifications(user=Depends(_require_user), status: Optional[str] = "pending"):
    await _require_role(user, ["admin", "moderator", "content_reviewer", "superadmin"])
    q: Dict = {}
    if status:
        q["status"] = status
    items = await db.id_verifications.find(q).sort("submitted_at", -1).to_list(200)
    return {"verifications": serialize_doc(items)}


@api_router.post("/admin/verifications/review")
async def admin_review_verification(body: AdminReviewIdRequest, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "content_reviewer", "superadmin"])
    await db.id_verifications.update_one(
        {"user_id": body.user_id, "status": "pending"},
        {"$set": {"status": body.decision, "reviewed_by": user["id"],
                   "reviewed_at": now_utc().isoformat(), "review_note": body.note}},
    )
    user_update: Dict = {"id_verification_status": body.decision}
    if body.decision == "approved":
        user_update["id_verified"] = True
        user_update["verified"] = True  # grant general verified badge too
    await db.users.update_one({"id": body.user_id}, {"$set": user_update})
    await _audit(user["id"], "id_review", body.user_id, {"decision": body.decision})
    return {"ok": True}


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


# --- AI configuration (admin-editable runtime) ---
AI_CONFIG_KEY = "ai_moderation"


@api_router.get("/admin/ai-config")
async def admin_get_ai_config(user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    cfg = await db.settings.find_one({"key": AI_CONFIG_KEY}) or {}
    cfg.pop("_id", None)
    # Don't leak api key in GET after set, return masked
    if cfg.get("api_key"):
        cfg["api_key_masked"] = "***" + cfg["api_key"][-4:]
        cfg.pop("api_key", None)
    return cfg or {"provider": "gemini", "model": "gemini-2.5-flash", "enabled": True}


@api_router.post("/admin/ai-config")
async def admin_set_ai_config(body: AIConfigUpdate, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    doc = {
        "key": AI_CONFIG_KEY,
        "provider": body.provider,
        "model": body.model,
        "base_url": body.base_url,
        "enabled": body.enabled,
        "updated_at": now_utc().isoformat(),
        "updated_by": user["id"],
    }
    if body.api_key:
        doc["api_key"] = body.api_key
    await db.settings.update_one({"key": AI_CONFIG_KEY}, {"$set": doc}, upsert=True)
    await _audit(user["id"], "ai_config_update", meta={"provider": body.provider, "model": body.model})
    return {"ok": True}


# --- Stripe payments (admin-configurable) ---
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest  # noqa: E402

PAYMENT_CONFIG_KEY = "payment_config"

DEFAULT_PACKAGES: List[Dict] = [
    {"id": "premium_30", "amount": 9.99, "currency": "eur", "desc": "Eros Premium 30 Tage",
     "enabled": True, "kind": "premium", "days": 30},
    {"id": "premium_365", "amount": 79.99, "currency": "eur", "desc": "Eros Premium 1 Jahr",
     "enabled": True, "kind": "premium", "days": 365},
    {"id": "boost_single", "amount": 2.99, "currency": "eur", "desc": "Boost (30 Minuten)",
     "enabled": True, "kind": "boost", "minutes": 30},
]


async def _get_payment_config() -> Dict:
    cfg = await db.settings.find_one({"key": PAYMENT_CONFIG_KEY})
    if not cfg:
        return {
            "key": PAYMENT_CONFIG_KEY,
            "provider": "disabled",
            "enabled": False,
            "stripe_api_key": os.environ.get("STRIPE_API_KEY", ""),
            "provider_keys": {"stripe": {"secret_key": os.environ.get("STRIPE_API_KEY", "")}},
            "packages": DEFAULT_PACKAGES,
        }
    cfg.pop("_id", None)
    if not cfg.get("packages"):
        cfg["packages"] = DEFAULT_PACKAGES
    if not cfg.get("stripe_api_key"):
        cfg["stripe_api_key"] = os.environ.get("STRIPE_API_KEY", "")
    if not cfg.get("provider_keys"):
        cfg["provider_keys"] = {"stripe": {"secret_key": cfg.get("stripe_api_key") or ""}}
    return cfg


def _mask(val: str) -> str:
    if not val:
        return ""
    s = str(val)
    return ("***" + s[-4:]) if len(s) >= 4 else "***"


def _mask_provider_keys(provider_keys: Dict[str, Dict[str, str]]) -> Dict[str, Dict[str, str]]:
    """Return provider_keys with every value masked (for admin GET)."""
    out: Dict[str, Dict[str, str]] = {}
    for pid, keys in (provider_keys or {}).items():
        out[pid] = {k: _mask(v) for k, v in (keys or {}).items()}
    return out


def _find_package(cfg: Dict, pkg_id: str) -> Optional[Dict]:
    for p in (cfg.get("packages") or []):
        if p.get("id") == pkg_id and p.get("enabled", True):
            return p
    return None


@api_router.get("/payments/packages")
async def list_packages(user=Depends(_require_user)):
    cfg = await _get_payment_config()
    pkgs = [p for p in (cfg.get("packages") or []) if p.get("enabled", True)]
    return {
        "enabled": bool(cfg.get("enabled")) and cfg.get("provider") != "disabled",
        "provider": cfg.get("provider", "disabled"),
        "supported": cfg.get("provider", "disabled") == "stripe",
        "packages": pkgs,
    }


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
    cfg["supported_providers"] = ["stripe"]
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


@api_router.post("/payments/checkout")
async def create_checkout(body: CheckoutRequest, request: Request, user=Depends(_require_user)):
    cfg = await _get_payment_config()
    if not cfg.get("enabled") or cfg.get("provider") == "disabled":
        raise HTTPException(400, "Zahlungen sind deaktiviert")
    pkg = _find_package(cfg, body.package_id)
    if not pkg:
        raise HTTPException(400, "Unbekanntes oder deaktiviertes Paket")
    provider = cfg.get("provider", "disabled")
    if provider != "stripe":
        # Other providers are accepted in config but not yet integrated server-side.
        raise HTTPException(
            501,
            f"Anbieter '{provider}' ist konfiguriert, aber noch nicht integriert. "
            f"Bitte Stripe verwenden oder Admin kontaktieren.",
        )
    pkeys = (cfg.get("provider_keys") or {}).get("stripe") or {}
    api_key = pkeys.get("secret_key") or cfg.get("stripe_api_key") or os.environ.get("STRIPE_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "Stripe API-Key fehlt")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/payments/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/account"
    req = CheckoutSessionRequest(
        amount=float(pkg["amount"]),
        currency=pkg.get("currency", "eur"),
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user["id"], "package_id": body.package_id},
    )
    session = await stripe_checkout.create_checkout_session(req)
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user["id"],
        "package_id": body.package_id,
        "amount": pkg["amount"],
        "currency": pkg.get("currency", "eur"),
        "payment_status": "initiated",
        "provider": provider,
        "created_at": now_utc().isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id, "provider": provider}


async def _apply_successful_payment(session_id: str, metadata: Dict):
    """Idempotent: apply entitlement based on package_id once."""
    txn = await db.payment_transactions.find_one({"session_id": session_id})
    if not txn:
        return
    if txn.get("payment_status") == "paid":
        return  # already applied
    pkg_id = metadata.get("package_id") or txn.get("package_id")
    uid = metadata.get("user_id") or txn.get("user_id")
    upd = {"payment_status": "paid", "paid_at": now_utc().isoformat()}
    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": upd})
    if not uid or not pkg_id:
        return
    cfg = await _get_payment_config()
    pkg = next((p for p in (cfg.get("packages") or []) if p.get("id") == pkg_id), None)
    if not pkg:
        return
    kind = pkg.get("kind")
    if kind == "premium":
        days = int(pkg.get("days") or 30)
        new_exp = now_utc() + timedelta(days=days)
        existing = await db.users.find_one({"id": uid})
        base = parse_dt((existing or {}).get("premium_expires_at")) or now_utc()
        if base > now_utc():
            new_exp = base + timedelta(days=days)
        await db.users.update_one({"id": uid}, {"$set": {"premium_expires_at": new_exp.isoformat()}})
    elif kind == "boost":
        minutes = int(pkg.get("minutes") or 30)
        new_exp = now_utc() + timedelta(minutes=minutes)
        await db.users.update_one({"id": uid}, {"$set": {"boost_expires_at": new_exp.isoformat()}})


@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request, user=Depends(_require_user)):
    cfg = await _get_payment_config()
    api_key = cfg.get("stripe_api_key") or os.environ.get("STRIPE_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "Payment provider not configured")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    status = await stripe_checkout.get_checkout_status(session_id)
    if status.payment_status == "paid":
        await _apply_successful_payment(session_id, status.metadata or {})
    txn = await db.payment_transactions.find_one({"session_id": session_id})
    return {"status": status.status, "payment_status": status.payment_status,
            "amount_total": status.amount_total, "currency": status.currency,
            "metadata": status.metadata, "txn": serialize_doc(txn) if txn else None}


@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    cfg = await _get_payment_config()
    api_key = cfg.get("stripe_api_key") or os.environ.get("STRIPE_API_KEY", "")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    body = await request.body()
    sig = request.headers.get("Stripe-Signature")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    try:
        evt = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        logger.exception("Webhook handling error: %s", e)
        raise HTTPException(400, "Invalid webhook")
    if evt.payment_status == "paid":
        await _apply_successful_payment(evt.session_id, evt.metadata or {})
    return {"ok": True}


# ---------- Legal / Info Pages (CMS-light) ----------
LEGAL_PAGE_KEYS = {
    "terms": "Nutzungsbedingungen",
    "privacy": "Datenschutzerklärung",
    "imprint": "Impressum",
    "community": "Community-Richtlinien",
    "cookies": "Cookie-Hinweis",
    "cancellation": "Widerrufsbelehrung",
}

_DEFAULT_LEGAL_CONTENT = {
    "terms": (
        "# Nutzungsbedingungen\n\n"
        "_Stand: bitte durch Administrator:in aktualisieren._\n\n"
        "Willkommen bei Eros. Mit der Nutzung unserer Plattform erklärst du dich mit "
        "diesen Nutzungsbedingungen einverstanden.\n\n"
        "## 1. Volljährigkeit\n"
        "Die Nutzung ist ausschließlich Personen ab **18 Jahren** gestattet.\n\n"
        "## 2. Respektvoller Umgang\n"
        "Diskriminierung, Belästigung und Hassrede führen zum sofortigen Ausschluss.\n\n"
        "## 3. Inhalte\n"
        "Du behältst die Rechte an deinen Inhalten, räumst uns aber das Recht ein, "
        "sie im Rahmen der Plattform darzustellen.\n\n"
        "## 4. Haftung\n"
        "Wir haften nur für grobe Fahrlässigkeit und Vorsatz, sofern gesetzlich zulässig.\n\n"
        "## 5. Änderungen\n"
        "Diese Bedingungen können angepasst werden; wesentliche Änderungen werden angekündigt.\n"
    ),
    "privacy": (
        "# Datenschutzerklärung\n\n"
        "_Stand: bitte durch Administrator:in aktualisieren._\n\n"
        "Wir verarbeiten deine Daten gemäß DSGVO. Eine ausführliche Fassung wird hier gepflegt.\n\n"
        "## Verantwortlich\nBitte Kontaktdaten einfügen.\n\n"
        "## Zwecke\n- Bereitstellung des Dienstes\n- Moderation (inkl. KI-gestützter Bildprüfung)\n"
        "- Sicherheit und Betrugsprävention\n\n"
        "## Betroffenenrechte\nAuskunft, Berichtigung, Löschung, Datenübertragbarkeit, Widerspruch.\n"
    ),
    "imprint": (
        "# Impressum\n\n"
        "_Bitte durch Administrator:in ausfüllen._\n\n"
        "**Anbieter:** \n\n**Anschrift:** \n\n**E-Mail:** \n\n**Telefon:** \n\n"
        "**Registergericht / HRB:** \n\n**Vertretungsberechtigt:** \n\n"
        "**Umsatzsteuer-ID:** \n"
    ),
    "community": (
        "# Community-Richtlinien\n\n"
        "Sei freundlich, respektvoll und aufrichtig. Keine Belästigung, keine Diskriminierung, "
        "keine sexuellen Inhalte ohne Einvernehmen. Links im Chat sind untersagt.\n"
    ),
    "cookies": (
        "# Cookie-Hinweis\n\n"
        "Wir verwenden technisch notwendige Cookies/LocalStorage-Einträge (z. B. für Login). "
        "Tracking-Cookies werden **nicht** eingesetzt.\n"
    ),
    "cancellation": (
        "# Widerrufsbelehrung\n\n"
        "Hinweise zum Widerrufsrecht bei digitalen Diensten und Abonnements. "
        "Bitte durch Administrator:in konkretisieren.\n"
    ),
}


async def _ensure_default_legal_pages():
    for key, title in LEGAL_PAGE_KEYS.items():
        doc = await db.legal_pages.find_one({"key": key})
        if not doc:
            await db.legal_pages.insert_one({
                "key": key,
                "title": title,
                "content_markdown": _DEFAULT_LEGAL_CONTENT.get(key, ""),
                "updated_at": now_utc().isoformat(),
                "updated_by": None,
            })


@api_router.get("/legal")
async def list_legal():
    """Public: list available legal pages (key + title only)."""
    await _ensure_default_legal_pages()
    items = await db.legal_pages.find({}, {"_id": 0, "key": 1, "title": 1, "updated_at": 1}).to_list(50)
    return {"pages": items}


@api_router.get("/legal/{key}")
async def get_legal(key: str):
    """Public: fetch a legal page by key."""
    if key not in LEGAL_PAGE_KEYS:
        raise HTTPException(404, "Unbekannte Seite")
    await _ensure_default_legal_pages()
    doc = await db.legal_pages.find_one({"key": key})
    if not doc:
        raise HTTPException(404, "Seite nicht gefunden")
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/legal/{key}")
async def admin_update_legal(key: str, body: LegalPageUpdate, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    if key not in LEGAL_PAGE_KEYS:
        raise HTTPException(404, "Unbekannte Seite")
    upd = {
        "key": key,
        "title": body.title,
        "content_markdown": body.content_markdown,
        "updated_at": now_utc().isoformat(),
        "updated_by": user["id"],
    }
    await db.legal_pages.update_one({"key": key}, {"$set": upd}, upsert=True)
    await _audit(user["id"], "legal_update", key, {"title": body.title, "length": len(body.content_markdown)})
    return {"ok": True}


# ---------- Wire ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
