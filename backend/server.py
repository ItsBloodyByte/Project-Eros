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

from fastapi import FastAPI, APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, Request
from fastapi.encoders import jsonable_encoder
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from auth import (
    hash_password,
    verify_password,
    create_token,
    decode_token,
    get_current_user_payload,
    get_optional_user_payload,
)
from helpers import now_utc, public_user_from_doc, rounded_distance_km, haversine_km, serialize_doc, parse_dt, contains_link_like
from image_compression import compress_image_data_url
from moderation import moderate_image
from rate_limit import rate_limiter, client_ip as _ratelimit_client_ip
from models import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    ProfileUpdate,
    MoodUpdateRequest,
    AcquaintanceRequestBody,
    AcquaintanceResponseBody,
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
    LocationHeartbeatRequest,
    PayPalOrderRequest,
    KlarnaSessionRequest,
    KlarnaPlaceOrderRequest,
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
        # Phase 6: visitors, promo codes, platform config
        try:
            await db.visits.create_index([("viewer_id", 1), ("target_id", 1)], unique=True)
            await db.visits.create_index([("target_id", 1), ("last_visited_at", -1)])
            await db.promo_codes.create_index("code", unique=True)
            await db.promo_codes.create_index("id", unique=True)
            await db.promo_codes.create_index("auto_on_register")
            await db.promo_redemptions.create_index([("code_id", 1), ("user_id", 1)])
            await db.promo_redemptions.create_index([("user_id", 1), ("redeemed_at", -1)])
            await db.platform_config.create_index("key", unique=True)
            await db.blog_posts.create_index("id", unique=True)
            await db.blog_posts.create_index("slug", unique=True)
            await db.blog_posts.create_index([("status", 1), ("published_at", -1)])
            # Couples
            await db.couples.create_index("id", unique=True)
            await db.couples.create_index("user_a_id")
            # Acquaintances (personal-known links)
            await db.acquaintances.create_index([("requester_id", 1), ("target_id", 1)], unique=True)
            await db.acquaintances.create_index([("target_id", 1), ("status", 1)])
            await db.acquaintances.create_index([("requester_id", 1), ("status", 1)])
            await db.couples.create_index("user_b_id")
            await db.couple_invites.create_index("id", unique=True)
            await db.couple_invites.create_index([("to_user_id", 1), ("status", 1)])
            await db.couple_invites.create_index([("from_user_id", 1), ("status", 1)])
            # Payment webhook events — unique per provider+event_id to prevent double-processing
            await db.payment_webhook_events.create_index([("provider", 1), ("event_id", 1)], unique=True)
            await db.payment_webhook_events.create_index("received_at")
            # Payment transactions lookup paths (Stripe uses session_id, PayPal/Klarna use order_id)
            await db.payment_transactions.create_index("session_id", sparse=True)
            await db.payment_transactions.create_index("order_id", sparse=True)
            await db.payment_transactions.create_index([("provider", 1), ("created_at", -1)])
            await db.payment_transactions.create_index("user_id")
        except Exception as ex:
            logger.warning("Phase-6 index setup issue: %s", ex)
        # IP flagging with automatic expiry (minor-attempt protection)
        try:
            await db.ip_flags.create_index("ip")
        except Exception:
            pass
        # Official Eros system profile (used as sender of broadcast DMs)
        try:
            await _ensure_eros_system_user()
        except Exception as ex:
            logger.warning("Could not ensure Eros system user: %s", ex)
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
    if user.get("deleted_at"):
        # Soft-deleted / scheduled for deletion – refuse further use
        raise HTTPException(403, "Account has been deleted")
    # Update last_active
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"last_active": now_utc().isoformat()}}
    )
    return user


async def _optional_user(payload: Optional[dict] = Depends(get_optional_user_payload)) -> Optional[dict]:
    """Returns the user doc if authenticated, otherwise None.
    Banned / soft-deleted accounts are treated as anonymous.
    """
    if not payload:
        return None
    try:
        user = await db.users.find_one({"id": payload.get("sub")})
    except Exception:
        return None
    if not user or user.get("banned") or user.get("deleted_at"):
        return None
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
def _compute_age(birth_date: Optional[str]) -> Optional[int]:
    if not birth_date:
        return None
    try:
        bd = datetime.strptime(birth_date[:10], "%Y-%m-%d").date()
    except Exception:
        return None
    today = datetime.now(timezone.utc).date()
    years = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
    return max(0, years)


def _client_ip(request) -> Optional[str]:
    try:
        xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
        if xff:
            return xff.split(",")[0].strip()
        real = request.headers.get("x-real-ip") or request.headers.get("X-Real-IP")
        if real:
            return real.strip()
        return request.client.host if request and request.client else None
    except Exception:
        return None


async def _is_ip_flagged_minor(ip: Optional[str]) -> bool:
    if not ip:
        return False
    doc = await db.ip_flags.find_one({"ip": ip, "kind": "minor_attempt"})
    if not doc:
        return False
    exp = doc.get("expires_at")
    if exp:
        try:
            if datetime.fromisoformat(exp) < now_utc():
                await db.ip_flags.delete_one({"_id": doc["_id"]})
                return False
        except Exception:
            pass
    return True


async def _flag_ip_minor(ip: Optional[str], hours: int = 48) -> None:
    if not ip:
        return
    until = now_utc() + timedelta(hours=hours)
    await db.ip_flags.update_one(
        {"ip": ip, "kind": "minor_attempt"},
        {"$set": {
            "ip": ip,
            "kind": "minor_attempt",
            "created_at": now_utc().isoformat(),
            "expires_at": until.isoformat(),
        }},
        upsert=True,
    )


@api_router.post("/auth/register", response_model=TokenResponse)
async def register(body: RegisterRequest, request: "Request" = None):
    # Rate-limit: 6 registrations per IP per hour, 3 per email/hour
    _ip = _ratelimit_client_ip(request)
    await rate_limiter.check(f"register:ip:{_ip}", capacity=6, window_seconds=3600)
    await rate_limiter.check(f"register:email:{(body.email or '').lower()}", capacity=3, window_seconds=3600)
    # Age handling: birth_date is preferred; fall back to legacy `age`
    computed_age = _compute_age(body.birth_date) if body.birth_date else None
    effective_age = computed_age if computed_age is not None else body.age
    if effective_age is None:
        raise HTTPException(400, "Birth date (YYYY-MM-DD) or age is required")

    ip = _client_ip(request) if request is not None else None

    # <18: refuse + flag IP for 48h
    if effective_age < 18:
        await _flag_ip_minor(ip, hours=48)
        await _audit(None, "minor_registration_attempt", None, {
            "ip": ip, "email": body.email.lower(), "age": effective_age, "birth_date": body.birth_date,
        })
        try:
            await notify_admins({
                "type": "minor_registration_attempt",
                "ip": ip,
                "email": body.email.lower(),
                "age": effective_age,
                "birth_date": body.birth_date,
                "at": now_utc().isoformat(),
            })
        except Exception:
            pass
        raise HTTPException(403, "Mindestalter 18 Jahre. Das Konto kann nicht erstellt werden.")

    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(409, "Email already registered")
    if not (body.consents.terms and body.consents.privacy and body.consents.sensitive_data):
        raise HTTPException(400, "Required consents must be accepted")

    flagged = await _is_ip_flagged_minor(ip)
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "display_name": body.display_name,
        "age": effective_age,
        "birth_date": body.birth_date,
        "gender_identity": body.gender_identity,
        "pronouns": None,
        "orientation": None,
        "bio": None,
        "location": None,
        "photos": [],
        "preferences": {
            "age_min": max(18, effective_age - 10),
            "age_max": effective_age + 10,
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
            # If the IP was previously flagged for a minor attempt, hide profile until ID is verified
            "hidden_mode": bool(flagged),
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
        "registration_ip": ip,
        "requires_id_verification": bool(flagged),
        "id_verification_status": "required_due_to_ip_flag" if flagged else None,
        "account_type": (body.account_type or "single"),
        "persona_b": _normalize_persona_b(body.persona_b) if (body.account_type == "duo" and body.persona_b) else None,
        "created_at": now_utc().isoformat(),
        "last_active": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    await _audit(user_id, "register", user_id, {"ip": ip, "flagged_ip": flagged, "account_type": doc.get("account_type")})
    # Auto-apply any active auto_on_register promo campaigns (e.g. "first 100 get 30 days premium")
    try:
        applied_promos = await _maybe_apply_auto_register_promos(doc)
        if applied_promos:
            await _audit(user_id, "auto_promo_applied", user_id, {"promos": applied_promos})
            # reload doc to capture new expiries
            reloaded = await db.users.find_one({"id": user_id})
            if reloaded:
                doc = reloaded
    except Exception:
        pass
    if flagged:
        try:
            await notify_admins({
                "type": "flagged_registration",
                "user_id": user_id,
                "email": body.email.lower(),
                "ip": ip,
                "at": now_utc().isoformat(),
            })
        except Exception:
            pass
    token = create_token(user_id)
    return TokenResponse(access_token=token, user=UserPublic(**public_user_from_doc(doc)))


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: "Request" = None):
    ip = _ratelimit_client_ip(request)
    # IP-level: 10 attempts per 5 minutes
    await rate_limiter.check(f"login:ip:{ip}", capacity=10, window_seconds=300)
    # Email-level: 6 attempts per 5 minutes (slows targeted attacks even behind NATs)
    await rate_limiter.check(f"login:email:{body.email.lower()}", capacity=6, window_seconds=300)
    doc = await db.users.find_one({"email": body.email.lower()})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    if doc.get("banned"):
        raise HTTPException(403, "Account banned")
    token = create_token(doc["id"], doc.get("role", "user"))
    await db.users.update_one({"id": doc["id"]}, {"$set": {"last_active": now_utc().isoformat()}})
    await _audit(doc["id"], "login", meta={"ip": ip})
    return TokenResponse(access_token=token, user=UserPublic(**public_user_from_doc(doc)))


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


# ---------- Photos ----------
# ---------- Upload MIME allowlist ----------
ALLOWED_IMAGE_MIMES = {
    "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif",
}
ALLOWED_VIDEO_MIMES = {
    "video/mp4", "video/webm", "video/ogg", "video/quicktime",
}


def _data_url_mime(data_url: str) -> Optional[str]:
    """Extract the declared MIME type from a data URL header. None if malformed."""
    if not data_url or not data_url.startswith("data:"):
        return None
    try:
        head, _ = data_url.split(",", 1)
        # e.g. 'data:image/jpeg;base64'
        meta = head[5:]  # strip 'data:'
        mime = meta.split(";", 1)[0].strip().lower()
        return mime or None
    except Exception:
        return None


def _reject_if_bad_image_mime(data_url: str) -> str:
    mime = _data_url_mime(data_url) or ""
    if mime not in ALLOWED_IMAGE_MIMES:
        # Explicitly block SVG (XSS) and other non-raster content
        raise HTTPException(400, f"Unerlaubter Bildtyp: {mime or 'unbekannt'}. Erlaubt: JPEG, PNG, WebP, HEIC, HEIF, GIF.")
    return mime


def _reject_if_bad_video_mime(data_url: str) -> str:
    mime = _data_url_mime(data_url) or ""
    if mime not in ALLOWED_VIDEO_MIMES:
        raise HTTPException(400, f"Unerlaubter Videotyp: {mime or 'unbekannt'}. Erlaubt: MP4, WebM, OGG, MOV.")
    return mime


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


# ---------- Discovery (bidirectional filter) ----------
@api_router.get("/discover")
async def discover(
    user=Depends(_require_user),
    limit: int = Query(20, ge=1, le=60),
    skip: int = Query(0, ge=0),
    admin_mode: bool = Query(False),
    include_hidden: bool = Query(False),
    include_banned: bool = Query(False),
    admin_q: Optional[str] = Query(None),
):
    is_staff = user.get("role") in {"admin", "moderator", "superadmin", "content_reviewer", "support"}
    # Staff-only admin browsing mode — bypass bidirectional + preference + radius filters
    if admin_mode and is_staff:
        q: Dict = {"id": {"$ne": user["id"]}, "is_system": {"$ne": True}}
        if not include_banned:
            q["banned"] = {"$ne": True}
        if not include_hidden:
            q["privacy.hidden_mode"] = {"$ne": True}
        if admin_q:
            q["$or"] = [
                {"display_name": {"$regex": admin_q, "$options": "i"}},
                {"email": {"$regex": admin_q, "$options": "i"}},
                {"bio": {"$regex": admin_q, "$options": "i"}},
            ]
        cursor = db.users.find(q).sort("last_active", -1).skip(skip).limit(limit)
        users = await cursor.to_list(length=limit)
        total = await db.users.count_documents(q)
        out = []
        for u in users:
            pub = public_user_from_doc(u, viewer_location=(user.get("location") or {}).get("coordinates"), list_mode=True)
            pub["admin_flags"] = {
                "banned": bool(u.get("banned")),
                "hidden_mode": bool((u.get("privacy") or {}).get("hidden_mode")),
                "shadow_restricted": bool(u.get("shadow_restricted")),
                "id_verified": bool(u.get("id_verified")),
                "role": u.get("role", "user"),
                "registration_ip": u.get("registration_ip"),
                "requires_id_verification": bool(u.get("requires_id_verification")),
                "premium_expires_at": u.get("premium_expires_at"),
            }
            if u.get("partner_user_id"):
                try:
                    pdoc = await db.users.find_one({"id": u["partner_user_id"]})
                    if pdoc:
                        pub["partner"] = public_user_from_doc(pdoc, viewer_location=(user.get("location") or {}).get("coordinates"), list_mode=True)
                except Exception:
                    pass
            out.append(pub)
        return {"users": out, "total": total, "admin_mode": True}

    prefs = user.get("preferences", {}) or {}
    loc = user.get("location")
    my_gender = user.get("gender_identity")
    my_age = user.get("age", 0)
    seen = set(user.get("seen_user_ids", []) or [])
    blocked = set(user.get("blocked_user_ids", []) or [])

    # Premium gating: advanced filters are only applied for premium/staff users.
    cfg = await _get_platform_config()
    premium_only_filter_keys = set(cfg.get("premium_only_filter_keys") or [])
    user_is_premium = _is_user_premium(user)
    if premium_only_filter_keys and not user_is_premium:
        prefs = {k: v for k, v in prefs.items() if k not in premium_only_filter_keys}

    query: Dict = {
        "id": {"$ne": user["id"]},
        "banned": {"$ne": True},
        "privacy.hidden_mode": {"$ne": True},
        "is_system": {"$ne": True},
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
    # Gender: union logic — show target if EITHER the viewer seeks the target's gender,
    # OR the target seeks the viewer's gender. Previously this was strict AND.
    viewer_seeking = prefs.get("seeking_genders") or []
    gender_conds: List[Dict] = []
    if viewer_seeking:
        gender_conds.append({"gender_identity": {"$in": viewer_seeking}})
    if my_gender:
        gender_conds.append({"preferences.seeking_genders": my_gender})
    if gender_conds:
        # If only one side specifies anything, fall back to that single condition.
        query.setdefault("$and", []).append(
            {"$or": gender_conds} if len(gender_conds) > 1 else gender_conds[0]
        )
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
    # NSFW content filter (applies to everyone who opts in via preferences).
    # A profile that explicitly signals "accept_nsfw=True" is considered
    # potentially offering NSFW content. When the viewer opts out, we hide
    # those profiles. Null (`None`) is treated as "no opinion" → visible.
    if prefs.get("hide_nsfw_profiles"):
        query["$and"] = query.get("$and", []) + [
            {"$or": [{"accept_nsfw": {"$ne": True}}, {"accept_nsfw": {"$exists": False}}]},
        ]
    # Gay-male position filter — only applied when the viewer is themselves a
    # gay-male-like account AND is seeking men. This keeps the filter scoped
    # to the identities it was designed for and prevents accidental misuse.
    viewer_seeks_men = any(g in {"man", "trans_man"} for g in (viewer_seeking or []))
    viewer_is_gay_male = (
        my_gender in {"man", "trans_man"} and
        user.get("orientation") in {"gay", "bisexual", "pansexual", "queer", "questioning"}
    )
    if prefs.get("gay_positions") and viewer_is_gay_male and viewer_seeks_men:
        query["gay_position"] = {"$in": list(prefs["gay_positions"])}
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
    if prefs.get("moods"):
        query["current_mood"] = {"$in": prefs["moods"]}

    # Bidirectional age filter (gender handled above with union logic)
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

    # --- Boost-aware fetch --------------------------------------------------
    # Previously we fetched `limit * 2` in DB-natural / $near order and sorted
    # boosters in Python. That meant a booster sitting past position 40 (e.g.
    # farther away when $near is active, or late in insertion order otherwise)
    # would *never* float to the top of page 1. We now run two deterministic
    # queries and stitch them — boosters that match the viewer's filters are
    # guaranteed to appear first, across pagination too.
    now_iso = now_utc().isoformat()
    boost_query = dict(query)
    boost_query["boost_expires_at"] = {"$gt": now_iso}

    # 1) All boosted matches (usually a tiny set) — same filters, up to `limit`.
    boost_docs = await db.users.find(boost_query).limit(limit).to_list(length=limit)
    boost_ids = {d["id"] for d in boost_docs}
    num_boosted = len(boost_docs)

    remaining = max(0, limit - max(0, num_boosted - skip))
    # 2) Non-boosted pool with pagination shifted by the boost count so page N
    #    continues seamlessly after the boost block.
    non_boost_query = dict(query)
    non_boost_query["$and"] = query.get("$and", []) + [
        {"$or": [
            {"boost_expires_at": {"$exists": False}},
            {"boost_expires_at": {"$lte": now_iso}},
        ]},
    ]
    if not non_boost_query["$and"]:
        non_boost_query.pop("$and")
    non_boost_skip = max(0, skip - num_boosted)
    non_boost_docs: List[Dict] = []
    if remaining > 0:
        non_boost_docs = await db.users.find(non_boost_query).skip(non_boost_skip).limit(remaining).to_list(length=remaining)

    # Slice the boost block for the current page (first N pages get the halo).
    visible_boost = boost_docs[skip: skip + limit] if skip < num_boosted else []
    docs = visible_boost + [d for d in non_boost_docs if d["id"] not in boost_ids][:limit - len(visible_boost)]

    viewer_coords = loc.get("coordinates") if loc else None
    results = []
    wanted_penis = set(prefs.get("penis_categories") or [])
    for d in docs:
        pub = public_user_from_doc(d, viewer_location=viewer_coords, list_mode=True)
        pub["boosted"] = (d.get("boost_expires_at") or "") > now_iso
        pub["is_premium"] = (d.get("premium_expires_at") or "") > now_iso
        # Penis category post-filter (derived)
        if wanted_penis:
            if pub.get("penis_category") not in wanted_penis:
                continue
        # Online-only post-filter (privacy-aware)
        if prefs.get("online_only") and not pub["is_online"]:
            continue
        # Attach partner snapshot for linked couples (one discover entry per couple: skip partner docs below)
        if d.get("partner_user_id"):
            try:
                pdoc = await db.users.find_one({"id": d["partner_user_id"]})
                if pdoc and not pdoc.get("banned"):
                    pub["partner"] = public_user_from_doc(pdoc, viewer_location=viewer_coords, list_mode=True)
            except Exception:
                pass
        results.append(pub)
    # De-duplicate: if both partners of a couple made it into results, keep only one entry
    if results:
        seen_couple: set = set()
        deduped = []
        for r in results:
            cid = r.get("couple_id")
            if cid:
                if cid in seen_couple:
                    continue
                seen_couple.add(cid)
            deduped.append(r)
        results = deduped
    return {"results": results, "has_more": len(docs) == limit, "geo_applied": geo_applied}


@api_router.post("/seen/{user_id}")
async def mark_seen(user_id: str, user=Depends(_require_user)):
    # Stealth mode: don't persist "seen" markers so others get no trace
    if (user.get("privacy") or {}).get("stealth_mode"):
        return {"ok": True, "stealth": True}
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
    # Record visit (unless self, admin-mode viewing, or stealth viewer)
    if not is_self and not is_admin:
        try:
            await _record_visit(user, user_id)
        except Exception:
            pass
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
    # Attach partner doc (if linked) so the profile view can render both people side-by-side
    if doc.get("partner_user_id"):
        try:
            pdoc = await db.users.find_one({"id": doc["partner_user_id"]})
            if pdoc and not pdoc.get("banned"):
                pub["partner"] = public_user_from_doc(pdoc, viewer_location=(user.get("location") or {}).get("coordinates"))
        except Exception:
            pass
    return {**pub, "i_liked": bool(my_like), "they_liked": bool(their_like), "match_id": match, **extra}


# ---------- Likes & Matches ----------
@api_router.post("/likes", response_model=LikeResponse)
async def create_like(body: LikeRequest, user=Depends(_require_user)):
    if body.target_user_id == user["id"]:
        raise HTTPException(400, "Cannot like yourself")
    target = await db.users.find_one({"id": body.target_user_id})
    if not target or target.get("banned"):
        raise HTTPException(404, "Target not found")
    # Free-tier daily like limit (premium / staff bypass)
    if not _is_user_premium(user):
        cfg = await _get_platform_config()
        free_limit = int(cfg.get("free_daily_like_limit", 5))
        already = await db.likes.find_one({"from_user": user["id"], "to_user": body.target_user_id})
        if not already and free_limit > 0:
            sent_today = await _count_likes_today(user["id"])
            if sent_today >= free_limit:
                raise HTTPException(
                    429,
                    f"Tägliches Like-Limit erreicht ({free_limit}/Tag). Mit Premium sind Likes unbegrenzt.",
                )
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


async def _match_or_403(match_id: str, user_id: str) -> dict:
    m = await db.matches.find_one({"id": match_id})
    if not m:
        raise HTTPException(404, "Match not found")
    allowed_ids = {m.get("user_a"), m.get("user_b")}
    if user_id not in allowed_ids:
        # Allow the linked partner of one of the match users to access as well
        caller = await db.users.find_one({"id": user_id})
        if caller and caller.get("partner_user_id") in allowed_ids:
            return m
        raise HTTPException(403, "Not in match")
    return m


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


# ---------- Acquaintances (personal-known graph) ----------
async def _get_or_create_match(a_id: str, b_id: str) -> str:
    """Ensures a match/conversation exists between two users. Returns match_id.
    Used to host the acquaintance request chat messages even for users
    who haven't liked each other yet.
    """
    existing = await db.matches.find_one({
        "$or": [
            {"user_a": a_id, "user_b": b_id},
            {"user_a": b_id, "user_b": a_id},
        ]
    })
    if existing:
        return existing["id"]
    match_id = str(uuid.uuid4())
    await db.matches.insert_one({
        "id": match_id,
        "user_a": a_id,
        "user_b": b_id,
        "created_at": now_utc().isoformat(),
        "last_message_at": None,
        "auto_created": True,
    })
    return match_id


async def _post_system_message(match_id: str, sender_user: dict, text: str,
                               extra: Optional[Dict] = None) -> dict:
    """Create a chat message and broadcast it via WS."""
    msg = {
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "sender_id": sender_user["id"],
        "text": text,
        "media_data_url": None,
        "nsfw_score": None,
        "self_destruct_at": None,
        "read_by": [sender_user["id"]],
        "created_at": now_utc().isoformat(),
    }
    if extra:
        msg.update(extra)
    await db.messages.insert_one(msg)
    await db.matches.update_one({"id": match_id}, {"$set": {"last_message_at": msg["created_at"]}})
    primary_photo = next((p.get("data") for p in (sender_user.get("photos") or []) if p.get("is_primary")), None)
    if not primary_photo and sender_user.get("photos"):
        primary_photo = sender_user["photos"][0].get("data")
    sender_snapshot = {
        "id": sender_user["id"],
        "display_name": sender_user.get("display_name"),
        "avatar": primary_photo,
    }
    try:
        await ws_manager.broadcast(match_id, {
            "type": "message",
            "message": serialize_doc(msg),
            "sender": sender_snapshot,
        })
    except Exception:
        pass
    return msg


@api_router.post("/acquaintances/request")
async def request_acquaintance(body: AcquaintanceRequestBody,
                               request: "Request" = None,
                               user=Depends(_require_user)):
    # Anti-spam: 20 requests per user per day, 5 per minute
    await rate_limiter.check(f"acq:user:{user['id']}:min", capacity=5, window_seconds=60)
    await rate_limiter.check(f"acq:user:{user['id']}:day", capacity=20, window_seconds=86400)
    """
    Mark another user as personally known. Creates a pending acquaintance
    record and posts a special chat message in the pair's conversation with
    Accept / Reject controls for the recipient.
    """
    target_id = body.target_user_id
    if target_id == user["id"]:
        raise HTTPException(400, "Du kannst dich nicht selbst markieren.")
    target = await db.users.find_one({"id": target_id})
    if not target or target.get("banned"):
        raise HTTPException(404, "Profil nicht gefunden")
    # Existing record (in either direction)?
    existing = await db.acquaintances.find_one({
        "$or": [
            {"requester_id": user["id"], "target_id": target_id},
            {"requester_id": target_id, "target_id": user["id"]},
        ]
    })
    if existing and existing.get("status") == "confirmed":
        raise HTTPException(409, "Ihr seid bereits als persönlich bekannt markiert.")
    if existing and existing.get("status") == "pending":
        raise HTTPException(409, "Es gibt bereits eine offene Anfrage.")
    # Re-request after rejection: allow by creating a new pending record
    if existing:
        await db.acquaintances.delete_one({"id": existing["id"]})
    acq_id = str(uuid.uuid4())
    now_iso = now_utc().isoformat()
    doc = {
        "id": acq_id,
        "requester_id": user["id"],
        "target_id": target_id,
        "status": "pending",
        "created_at": now_iso,
        "responded_at": None,
    }
    await db.acquaintances.insert_one(doc)
    # Ensure a chat conversation exists between requester and target and post
    # the system-styled acquaintance request as a chat message.
    match_id = await _get_or_create_match(user["id"], target_id)
    requester_name = user.get("display_name") or "Jemand"
    text = f"{requester_name} möchte dich als persönlich bekannt markieren."
    msg = await _post_system_message(
        match_id, user, text,
        extra={
            "kind": "acquaintance_request",
            "acquaintance_id": acq_id,
            "acquaintance_requester_id": user["id"],
            "acquaintance_target_id": target_id,
            "acquaintance_status": "pending",
        },
    )
    doc["message_id"] = msg["id"]
    doc["match_id"] = match_id
    await db.acquaintances.update_one(
        {"id": acq_id},
        {"$set": {"message_id": msg["id"], "match_id": match_id}},
    )
    await _audit(user["id"], "acquaintance_requested", target_id)
    return serialize_doc(doc)


@api_router.post("/acquaintances/{acq_id}/respond")
async def respond_acquaintance(acq_id: str, body: AcquaintanceResponseBody,
                               user=Depends(_require_user)):
    """Accept or reject an incoming acquaintance request."""
    doc = await db.acquaintances.find_one({"id": acq_id})
    if not doc:
        raise HTTPException(404, "Anfrage nicht gefunden")
    if doc.get("target_id") != user["id"]:
        # Allow partner of a duo account to respond as well
        if not (user.get("partner_user_id") and doc.get("target_id") == user.get("partner_user_id")):
            raise HTTPException(403, "Nur die adressierte Person darf antworten.")
    if doc.get("status") != "pending":
        raise HTTPException(409, "Anfrage wurde bereits beantwortet.")
    new_status = "confirmed" if body.action == "confirm" else "rejected"
    now_iso = now_utc().isoformat()
    await db.acquaintances.update_one(
        {"id": acq_id},
        {"$set": {
            "status": new_status,
            "responded_at": now_iso,
            "responder_id": user["id"],
        }},
    )
    # Update the original chat message (for UI) and append a confirmation one.
    match_id = doc.get("match_id")
    if match_id:
        try:
            await db.messages.update_one(
                {"id": doc.get("message_id")},
                {"$set": {"acquaintance_status": new_status}},
            )
        except Exception:
            pass
        responder_name = user.get("display_name") or "Die andere Person"
        follow_up = (
            f"{responder_name} hat die Anfrage bestätigt. Ihr seid nun als persönlich bekannt markiert."
            if new_status == "confirmed"
            else f"{responder_name} hat die Anfrage abgelehnt."
        )
        await _post_system_message(
            match_id, user, follow_up,
            extra={"kind": "acquaintance_response", "acquaintance_id": acq_id,
                   "acquaintance_status": new_status},
        )
        # Broadcast the updated status for any connected clients rendering the request card
        try:
            await ws_manager.broadcast(match_id, {
                "type": "acquaintance_status",
                "acquaintance_id": acq_id,
                "status": new_status,
                "message_id": doc.get("message_id"),
            })
        except Exception:
            pass
    await _audit(user["id"], f"acquaintance_{new_status}", doc.get("requester_id") or "")
    return {"ok": True, "status": new_status}


@api_router.get("/users/{user_id}/acquaintances")
async def list_user_acquaintances(user_id: str, user=Depends(_require_user)):
    """Public list of confirmed acquaintances for any profile."""
    target = await db.users.find_one({"id": user_id})
    if not target or target.get("banned"):
        raise HTTPException(404, "Profil nicht gefunden")
    cur = db.acquaintances.find({
        "status": "confirmed",
        "$or": [{"requester_id": user_id}, {"target_id": user_id}],
    }).sort("responded_at", -1).limit(60)
    ids = []
    async for a in cur:
        other = a["target_id"] if a["requester_id"] == user_id else a["requester_id"]
        if other not in ids:
            ids.append(other)
    if not ids:
        return {"count": 0, "users": []}
    viewer_coords = (user.get("location") or {}).get("coordinates")
    out: List[Dict] = []
    async for u in db.users.find({"id": {"$in": ids}}):
        if u.get("banned"):
            continue
        out.append(public_user_from_doc(u, viewer_location=viewer_coords, list_mode=True))
    # Preserve original order
    order = {uid: i for i, uid in enumerate(ids)}
    out.sort(key=lambda x: order.get(x.get("id"), 9999))
    return {"count": len(out), "users": out}


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
    # Re-check user is alive + not banned / deleted (JWT alone is insufficient)
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc or user_doc.get("banned") or user_doc.get("deleted_at"):
        await websocket.close(code=4403)
        return
    m = await db.matches.find_one({"id": match_id})
    if not m:
        await websocket.close(code=4403)
        return
    # Allow the user themselves OR their linked duo-partner to join
    participants = {m.get("user_a"), m.get("user_b")}
    allowed_ids = {user_id}
    partner_id = user_doc.get("partner_user_id")
    if partner_id:
        allowed_ids.add(partner_id)
    if not (allowed_ids & participants):
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


# ---------- Admin Realtime Notifications ----------
# Known moderation notification channels (event types).
ADMIN_NOTIFICATION_CHANNELS = [
    "new_report",
    "minor_registration_attempt",
    "flagged_registration",
    "id_verification_submitted",
    "auto_shadow_restrict",
    "photo_retention_set",
]

# Default team-based channel assignments (when no explicit role config set)
DEFAULT_ROLE_CHANNELS: Dict[str, List[str]] = {
    "support": ["new_report", "id_verification_submitted"],
    "content_reviewer": ["new_report", "id_verification_submitted", "photo_retention_set", "auto_shadow_restrict"],
    "moderator": ADMIN_NOTIFICATION_CHANNELS,
    "admin": ADMIN_NOTIFICATION_CHANNELS,
    "superadmin": ADMIN_NOTIFICATION_CHANNELS,
}


async def _role_channels(role: str) -> List[str]:
    """Resolve channels assigned to a role. Admin-configured docs override defaults."""
    doc = await db.role_channel_assignments.find_one({"role": role})
    if doc and isinstance(doc.get("channels"), list):
        return [c for c in doc["channels"] if c in ADMIN_NOTIFICATION_CHANNELS]
    return list(DEFAULT_ROLE_CHANNELS.get(role, ADMIN_NOTIFICATION_CHANNELS))


async def _resolve_user_channels(user_doc: dict) -> List[str]:
    """User-level channels take priority; fallback to role-level assignment."""
    stored = user_doc.get("admin_notification_channels")
    if stored is not None:
        return [c for c in stored if c in ADMIN_NOTIFICATION_CHANNELS]
    return await _role_channels(user_doc.get("role") or "user")


class AdminWSManager:
    """Broadcasts moderation events to all connected admin/moderator sockets.

    Each connection subscribes to a subset of channels (event types).
    """
    def __init__(self):
        # list of (ws, set(channels)|None)  — None == all
        self.connections: List = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, channels=None):
        await ws.accept()
        async with self._lock:
            self.connections.append((ws, channels))

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self.connections = [(w, c) for (w, c) in self.connections if w is not ws]

    async def broadcast(self, payload: dict):
        evt_type = payload.get("type", "")
        dead: List = []
        async with self._lock:
            conns = list(self.connections)
        for w, channels in conns:
            if channels is not None and evt_type not in channels:
                continue
            try:
                await w.send_json(payload)
            except Exception:
                dead.append(w)
        for w in dead:
            await self.disconnect(w)


admin_ws_manager = AdminWSManager()


async def notify_admins(payload: dict) -> None:
    """Persist a moderation event AND push to connected admin sockets."""
    doc = {
        "id": str(uuid.uuid4()),
        "type": payload.get("type", "generic"),
        "data": payload,
        "created_at": now_utc().isoformat(),
        "read_by": [],
    }
    try:
        await db.admin_notifications.insert_one(doc)
    except Exception:
        pass
    msg = {**payload, "notification_id": doc["id"], "persisted_at": doc["created_at"]}
    try:
        await admin_ws_manager.broadcast(msg)
    except Exception:
        pass


@app.websocket("/api/ws/admin")
async def ws_admin(websocket: WebSocket, token: str = Query(...), channels: Optional[str] = Query(None)):
    try:
        payload = decode_token(token)
    except HTTPException:
        await websocket.close(code=4401)
        return
    user = await db.users.find_one({"id": payload["sub"]}, {"role": 1, "admin_notification_channels": 1})
    if not user or user.get("role") not in {"admin", "moderator", "superadmin", "content_reviewer"}:
        await websocket.close(code=4403)
        return
    # Channel resolution: query string (ad-hoc) > user prefs > team default > all.
    if channels:
        requested = {c.strip() for c in channels.split(",") if c.strip()}
        subs = (requested & set(ADMIN_NOTIFICATION_CHANNELS)) or None
    else:
        resolved = await _resolve_user_channels(user)
        subs = set(resolved) if resolved else set()
    await admin_ws_manager.connect(websocket, subs)
    try:
        # Send a greeting with recent unread notifications so newly-connected mods catch up
        recent_q: Dict = {}
        if subs is not None:
            recent_q = {"type": {"$in": list(subs)}}
        recent = await db.admin_notifications.find(recent_q).sort("created_at", -1).limit(20).to_list(length=20)
        for n in reversed(recent):
            try:
                await websocket.send_json({
                    **n.get("data", {}),
                    "notification_id": n.get("id"),
                    "persisted_at": n.get("created_at"),
                    "_replay": True,
                })
            except Exception:
                break
        while True:
            # Keep-alive; clients may send pings or acks
            raw = await websocket.receive_text()
            try:
                evt = json.loads(raw)
            except Exception:
                continue
            if evt.get("type") == "ack":
                nid = evt.get("notification_id")
                if nid:
                    await db.admin_notifications.update_one(
                        {"id": nid},
                        {"$addToSet": {"read_by": payload["sub"]}},
                    )
    except WebSocketDisconnect:
        pass
    finally:
        await admin_ws_manager.disconnect(websocket)












# ---- Authenticated Broadcasts (official messages from the platform team) ----
import hmac as _hmac
import hashlib as _hashlib

EROS_SYSTEM_USER_ID = "eros-system-user"


async def _ensure_eros_system_user() -> dict:
    """Idempotently create the official 'Eros' profile used as sender of broadcast DMs."""
    doc = await db.users.find_one({"id": EROS_SYSTEM_USER_ID})
    if doc:
        return doc
    doc = {
        "id": EROS_SYSTEM_USER_ID,
        "email": "noreply@eros.app",
        "password_hash": hash_password(str(uuid.uuid4())),  # unreachable
        "display_name": "Eros",
        "age": 99,
        "birth_date": "1900-01-01",
        "gender_identity": "other",
        "pronouns": None,
        "orientation": None,
        "bio": "Offizielles Eros-Profil. Mitteilungen vom Team erscheinen hier als verifizierte Nachrichten.",
        "location": None,
        "photos": [{
            "id": str(uuid.uuid4()),
            "data": "https://images.unsplash.com/photo-1557800636-894a64c1696f?w=800&q=80&auto=format&fit=crop",
            "nsfw_score": 0.0,
            "has_face": False,
            "category": "logo",
            "is_primary": True,
        }],
        "preferences": {},
        "privacy": {"hidden_mode": True, "read_receipts": False, "show_online_status": False, "show_typing": False, "screenshot_notifications": False},
        "relationship_types": [],
        "seeking_roles": [],
        "kinks": [],
        "verified": True,
        "id_verified": True,
        "banned": False,
        "role": "admin",
        "is_system": True,
        "consents": {"terms": True, "privacy": True, "sensitive_data": True, "accepted_at": now_utc().isoformat(), "version": 1},
        "created_at": now_utc().isoformat(),
        "last_active": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    return doc


async def _eros_match_for(user_id: str) -> dict:
    """Return (creating if necessary) the locked system match between a user and the Eros profile."""
    existing = await db.matches.find_one({
        "locked": True, "system_match": True,
        "$or": [
            {"user_a": EROS_SYSTEM_USER_ID, "user_b": user_id},
            {"user_a": user_id, "user_b": EROS_SYSTEM_USER_ID},
        ],
    })
    if existing:
        return existing
    doc = {
        "id": str(uuid.uuid4()),
        "user_a": EROS_SYSTEM_USER_ID,
        "user_b": user_id,
        "locked": True,
        "locked_reason": "broadcast",
        "system_match": True,
        "created_at": now_utc().isoformat(),
        "last_message_at": now_utc().isoformat(),
    }
    await db.matches.insert_one(doc)
    return doc


async def _fanout_broadcast_as_chat(broadcast: dict) -> int:
    """Deliver the broadcast as an incoming chat message to each recipient's system match."""
    await _ensure_eros_system_user()
    audience = broadcast.get("audience") or "all"
    q: Dict = {"id": {"$ne": EROS_SYSTEM_USER_ID}, "banned": {"$ne": True}, "is_system": {"$ne": True}}
    if audience == "premium":
        q["premium_expires_at"] = {"$gt": now_utc().isoformat()}
    elif audience == "verified":
        q["id_verified"] = True
    elif audience == "staff":
        q["role"] = {"$in": ["admin", "moderator", "superadmin", "content_reviewer", "support"]}
    elif audience == "segment":
        seg = broadcast.get("segment") or {}
        if seg.get("cities"):
            q["location.city"] = {"$in": seg["cities"]}
        if seg.get("interests"):
            q["interests"] = {"$in": seg["interests"]}
        if seg.get("genders"):
            q["gender_identity"] = {"$in": seg["genders"]}
        age_q: Dict = {}
        if seg.get("age_min") is not None:
            age_q["$gte"] = int(seg["age_min"])
        if seg.get("age_max") is not None:
            age_q["$lte"] = int(seg["age_max"])
        if age_q:
            q["age"] = age_q
    count = 0
    async for u in db.users.find(q, {"id": 1}):
        match = await _eros_match_for(u["id"])
        text = f"**{broadcast['title']}**\n\n{broadcast['body']}"
        msg = {
            "id": str(uuid.uuid4()),
            "match_id": match["id"],
            "sender_id": EROS_SYSTEM_USER_ID,
            "text": text,
            "media_data_url": None,
            "nsfw_score": None,
            "self_destruct_at": None,
            "read_by": [EROS_SYSTEM_USER_ID],
            "is_broadcast": True,
            "broadcast_id": broadcast["id"],
            "broadcast_signature": broadcast.get("signature"),
            "broadcast_severity": broadcast.get("severity"),
            "broadcast_authentic": _verify_broadcast(broadcast),
            "created_at": now_utc().isoformat(),
        }
        await db.messages.insert_one(msg)
        await db.matches.update_one({"id": match["id"]}, {"$set": {"last_message_at": msg["created_at"]}})
        # push to any open chat socket
        try:
            await ws_manager.broadcast(match["id"], {
                "type": "message",
                "message": serialize_doc(msg),
                "for_users": [u["id"], EROS_SYSTEM_USER_ID],
            })
        except Exception:
            pass
        count += 1
    return count


def _broadcast_signature(doc: dict) -> str:
    """HMAC-SHA256 over canonical fields, using the server secret. Only the backend can produce this."""
    from auth import JWT_SECRET
    payload = "\n".join([
        "v1",
        str(doc.get("id") or ""),
        str(doc.get("title") or ""),
        str(doc.get("body") or ""),
        str(doc.get("severity") or ""),
        str(doc.get("audience") or ""),
        str(doc.get("created_by") or ""),
        str(doc.get("created_at") or ""),
    ])
    return _hmac.new(JWT_SECRET.encode("utf-8"), payload.encode("utf-8"), _hashlib.sha256).hexdigest()


def _verify_broadcast(doc: dict) -> bool:
    sig = doc.get("signature")
    if not sig:
        return False
    return _hmac.compare_digest(sig, _broadcast_signature(doc))


async def _public_broadcast(doc: dict, for_user_id: Optional[str] = None) -> dict:
    # Look up author display name & role for the seal
    author = None
    if doc.get("created_by"):
        author_doc = await db.users.find_one({"id": doc["created_by"]}, {"display_name": 1, "role": 1})
        if author_doc:
            author = {"id": author_doc.get("id"), "display_name": author_doc.get("display_name"), "role": author_doc.get("role", "admin")}
    ack = False
    if for_user_id:
        ack = bool(await db.broadcast_reads.find_one({"broadcast_id": doc.get("id"), "user_id": for_user_id}))
    return {
        "id": doc.get("id"),
        "title": doc.get("title"),
        "body": doc.get("body"),
        "severity": doc.get("severity"),
        "audience": doc.get("audience"),
        "created_at": doc.get("created_at"),
        "expires_at": doc.get("expires_at"),
        "pinned": bool(doc.get("pinned")),
        "author": author,
        # Authenticity seal: signature + verification flag computed server-side
        "signature": doc.get("signature"),
        "authentic": _verify_broadcast(doc),
        "read": ack,
    }












def _broadcast_matches_user(doc: dict, user: dict) -> bool:
    aud = doc.get("audience") or "all"
    if aud == "all":
        return True
    if aud == "staff":
        return user.get("role") in {"admin", "moderator", "superadmin", "content_reviewer", "support"}
    if aud == "premium":
        pe = user.get("premium_expires_at")
        if not pe:
            return False
        try:
            return datetime.fromisoformat(pe) > now_utc()
        except Exception:
            return False
    if aud == "verified":
        return bool(user.get("id_verified"))
    if aud == "segment":
        seg = doc.get("segment") or {}
        city = (user.get("location") or {}).get("city") if isinstance(user.get("location"), dict) else None
        if seg.get("cities") and city not in seg["cities"]:
            return False
        if seg.get("interests"):
            inter = set(user.get("interests") or [])
            if not (inter & set(seg["interests"])):
                return False
        if seg.get("genders") and user.get("gender_identity") not in seg["genders"]:
            return False
        age = user.get("age") or 0
        if seg.get("age_min") is not None and age < int(seg["age_min"]):
            return False
        if seg.get("age_max") is not None and age > int(seg["age_max"]):
            return False
        return True
    return False


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
    _reject_if_bad_image_mime(body.data_url)
    compressed, _ = compress_image_data_url(body.data_url)
    mod = await moderate_image(compressed, session_tag=f"album-{album_id}")
    photo = {
        "id": str(uuid.uuid4()),
        "data": compressed,
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












# ---------- Bulk user actions (Admin Discover Grid) ----------
ALLOWED_BULK_ACTIONS = {
    "ban", "unban",
    "hide", "unhide",
    "shadow", "unshadow",
    "require_id_verification", "clear_id_requirement",
}






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
import secrets as _secrets_module
import pyotp  # noqa: E402


# --------- Email verification (in-app code) ---------
@api_router.post("/auth/email/send-code")
async def send_email_code(user=Depends(_require_user)):
    # Cryptographically secure 6-digit code (uniform distribution)
    code = f"{_secrets_module.randbelow(1_000_000):06d}"
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
async def login_mfa(body: LoginMfaRequest, request: "Request" = None):
    ip = _ratelimit_client_ip(request)
    await rate_limiter.check(f"login-mfa:ip:{ip}", capacity=10, window_seconds=300)
    await rate_limiter.check(f"login-mfa:email:{body.email.lower()}", capacity=6, window_seconds=300)
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
# Premium-only feature. Limits keep storage + moderation costs predictable.
VIDEO_MAX_PER_USER = 4                  # hard limit per premium account
VIDEO_MAX_DURATION_SECONDS = 60.0
VIDEO_MAX_WIDTH = 1920                  # 1080p = 1920x1080 landscape or 1080x1920 portrait
VIDEO_MAX_HEIGHT = 1920                 # we accept either orientation
VIDEO_MAX_RAW_BYTES = 42_000_000        # ~30 MB after base64 decoding buffer

def _is_premium(doc: dict) -> bool:
    exp = doc.get("premium_expires_at")
    if not exp:
        return False
    try:
        return exp > now_utc().isoformat()
    except Exception:
        return False


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
PREMIUM_FEATURES = [
    {
        "id": "unlimited_likes",
        "title": "Unbegrenzte Likes",
        "description": "Swipe ohne tägliches Limit und verpasse kein Match mehr.",
        "icon": "heart",
        "premium_only": True,
    },
    {
        "id": "see_who_liked",
        "title": "Sieh, wer dich geliked hat",
        "description": "Entdecke alle Likes, bevor du selbst entscheidest.",
        "icon": "eye",
        "premium_only": True,
    },
    {
        "id": "stealth_mode",
        "title": "Unsichtbarer Modus",
        "description": "Stöbere unbemerkt – ohne Spuren im Besucher-Log.",
        "icon": "ghost",
        "premium_only": True,
    },
    {
        "id": "full_visitors",
        "title": "Alle Besucher:innen sehen",
        "description": "Nicht mehr nur verpixelte Vorschauen – sieh dein komplettes Besucher-Archiv.",
        "icon": "users",
        "premium_only": True,
    },
    {
        "id": "video_upload",
        "title": "Video-Uploads",
        "description": "Bis zu 4 Kurzvideos (max. 60 Sek, 1080p) im Profil zeigen.",
        "icon": "video",
        "premium_only": True,
        "limits": {"max_videos": VIDEO_MAX_PER_USER, "max_duration_seconds": int(VIDEO_MAX_DURATION_SECONDS), "max_resolution": "1080p"},
    },
    {
        "id": "priority_discover",
        "title": "Priorität in der Entdecken-Liste",
        "description": "Dein Profil erscheint häufiger und prominenter bei Matches.",
        "icon": "zap",
        "premium_only": True,
    },
    {
        "id": "advanced_filters",
        "title": "Erweiterte Filter",
        "description": "Filtere nach Beziehungsstatus, Fetisch-Präferenzen und mehr.",
        "icon": "sliders",
        "premium_only": True,
    },
    {
        "id": "no_ads",
        "title": "Werbefrei",
        "description": "Keine Banner, keine Sponsored-Profile, keine Ablenkung.",
        "icon": "shield",
        "premium_only": True,
    },
    {
        "id": "read_receipts_optional",
        "title": "Lesebestätigungen kontrollieren",
        "description": "Du entscheidest, ob andere sehen, wann du gelesen hast.",
        "icon": "message-check",
        "premium_only": True,
    },
    {
        "id": "boost_monthly",
        "title": "Monatlicher Boost",
        "description": "1× pro Monat kostenlos: 30 Min. im Rampenlicht.",
        "icon": "rocket",
        "premium_only": True,
    },
]


@api_router.get("/premium/features")
async def premium_features_catalog():
    """Public premium-feature catalog – shown on the 'Premium' preview page
    so non-subscribers can see what they get before paying.
    """
    return {
        "features": PREMIUM_FEATURES,
        "video_limits": {
            "max_videos": VIDEO_MAX_PER_USER,
            "max_duration_seconds": int(VIDEO_MAX_DURATION_SECONDS),
            "max_resolution": "1080p",
            "max_file_size_mb": 30,
        },
    }


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
        "premium_until": user.get("premium_expires_at"),        "boost_active": _boost_active(user),
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








# =====================================================================
# Phase 5: Travel, ID Verification, Auto-Mod, User Management, Payments, AI Config
# =====================================================================
from fastapi import Request  # noqa: E402

AUTO_MOD_UNIQUE_REPORT_THRESHOLD = 10


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
        try:
            await notify_admins({
                "type": "auto_shadow_restrict",
                "user_id": target_user_id,
                "unique_reports": unique,
                "at": now_utc().isoformat(),
            })
        except Exception:
            pass


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
    # Push realtime admin notification
    try:
        target_user_email = None
        if body.target_type == "user":
            tu = await db.users.find_one({"id": body.target_id}, {"email": 1, "display_name": 1})
            target_user_email = (tu or {}).get("email")
        await notify_admins({
            "type": "new_report",
            "report_id": r["id"],
            "reason": body.reason,
            "target_type": body.target_type,
            "target_id": body.target_id,
            "reporter_id": user["id"],
            "reporter_name": user.get("display_name"),
            "target_email": target_user_email,
            "has_detail": bool(body.detail and len(body.detail.strip()) > 0),
            "at": now_utc().isoformat(),
        })
    except Exception:
        pass
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
    try:
        await notify_admins({
            "type": "id_verification_submitted",
            "user_id": user["id"],
            "user_name": user.get("display_name"),
            "email": user.get("email"),
            "document_type": body.document_type,
            "at": now_utc().isoformat(),
        })
    except Exception:
        pass
    return {"ok": True, "status": "pending"}












# --- AI configuration (admin-editable runtime) ---
AI_CONFIG_KEY = "ai_moderation"






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


def _live_providers(cfg: Dict) -> Dict[str, bool]:
    """Return which admin-configured payment providers have enough credentials to run live."""
    keys = cfg.get("provider_keys") or {}
    stripe_ok = bool((keys.get("stripe") or {}).get("secret_key") or cfg.get("stripe_api_key"))
    pp = keys.get("paypal") or {}
    paypal_ok = bool(pp.get("client_id") and (pp.get("secret") or pp.get("client_secret")))
    kl = keys.get("klarna") or {}
    klarna_ok = bool((kl.get("username") or kl.get("merchant_id")) and (kl.get("password") or kl.get("auth_token")))
    return {"stripe": stripe_ok, "paypal": paypal_ok, "klarna": klarna_ok}
















async def _apply_entitlement(user_id: str, package_id: str):
    """Grant the feature entitlement (premium / boost) for a package to a user.

    Safe to call multiple times: premium extends existing expiry forward, which is
    why the caller MUST first check the transaction idempotency flag before invoking
    this function to avoid stacking entitlements on duplicate webhooks.
    """
    if not user_id or not package_id:
        return
    cfg = await _get_payment_config()
    pkg = next((p for p in (cfg.get("packages") or []) if p.get("id") == package_id), None)
    if not pkg:
        logger.warning("Entitlement skipped: unknown package_id=%s for user=%s", package_id, user_id)
        return
    kind = pkg.get("kind")
    if kind == "premium":
        days = int(pkg.get("days") or 30)
        existing = await db.users.find_one({"id": user_id})
        base = parse_dt((existing or {}).get("premium_expires_at")) or now_utc()
        if base < now_utc():
            base = now_utc()
        new_exp = base + timedelta(days=days)
        await db.users.update_one({"id": user_id}, {"$set": {"premium_expires_at": new_exp.isoformat()}})
    elif kind == "boost":
        minutes = int(pkg.get("minutes") or 30)
        new_exp = now_utc() + timedelta(minutes=minutes)
        await db.users.update_one({"id": user_id}, {"$set": {"boost_expires_at": new_exp.isoformat()}})


async def _record_webhook_event(provider: str, event_id: str, payload: Dict) -> bool:
    """Insert a webhook event record; returns True if this is the first time we see it.

    Uses the unique index on (provider, event_id) so duplicate deliveries are rejected
    by MongoDB. Callers MUST early-return on False to avoid double-processing.
    """
    try:
        await db.payment_webhook_events.insert_one({
            "id": str(uuid.uuid4()),
            "provider": provider,
            "event_id": event_id,
            "payload_excerpt": {k: payload.get(k) for k in list(payload.keys())[:10]},
            "received_at": now_utc().isoformat(),
            "processed": False,
        })
        return True
    except Exception as ex:
        # Duplicate key → we have already seen this event.
        logger.info("Duplicate webhook event %s/%s (ignored): %s", provider, event_id, ex)
        return False


async def _mark_webhook_processed(provider: str, event_id: str, error: Optional[str] = None):
    await db.payment_webhook_events.update_one(
        {"provider": provider, "event_id": event_id},
        {"$set": {
            "processed": error is None,
            "processed_at": now_utc().isoformat(),
            "error": error,
        }},
    )


async def _apply_successful_payment(session_id: str, metadata: Dict):
    """Stripe-path idempotent entitlement grant (keyed on session_id)."""
    txn = await db.payment_transactions.find_one({"session_id": session_id})
    if not txn:
        logger.warning("apply_successful_payment: no transaction for session_id=%s", session_id)
        return
    if txn.get("payment_status") == "paid" or txn.get("status") == "paid":
        return  # already applied
    pkg_id = metadata.get("package_id") or txn.get("package_id")
    uid = metadata.get("user_id") or txn.get("user_id")
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"payment_status": "paid", "status": "paid", "paid_at": now_utc().isoformat()}},
    )
    await _apply_entitlement(uid, pkg_id)


async def _verify_paypal_webhook(cfg: Dict, headers: Dict[str, str], raw_body: bytes, event: Dict) -> bool:
    """Verify PayPal webhook via /v1/notifications/verify-webhook-signature.

    Requires `paypal.webhook_id` in provider_keys. If missing, returns False (reject).
    """
    keys = (cfg.get("provider_keys") or {}).get("paypal") or {}
    webhook_id = keys.get("webhook_id")
    if not webhook_id:
        return False
    try:
        token, api_base = await _paypal_access_token(cfg)
    except Exception as ex:
        logger.warning("PayPal webhook verification failed to get token: %s", ex)
        return False
    import httpx as _httpx
    verify_payload = {
        "auth_algo": headers.get("paypal-auth-algo") or headers.get("PAYPAL-AUTH-ALGO"),
        "cert_url": headers.get("paypal-cert-url") or headers.get("PAYPAL-CERT-URL"),
        "transmission_id": headers.get("paypal-transmission-id") or headers.get("PAYPAL-TRANSMISSION-ID"),
        "transmission_sig": headers.get("paypal-transmission-sig") or headers.get("PAYPAL-TRANSMISSION-SIG"),
        "transmission_time": headers.get("paypal-transmission-time") or headers.get("PAYPAL-TRANSMISSION-TIME"),
        "webhook_id": webhook_id,
        "webhook_event": event,
    }
    async with _httpx.AsyncClient(timeout=15) as http:
        r = await http.post(
            f"{api_base}/v1/notifications/verify-webhook-signature",
            json=verify_payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        if r.status_code >= 400:
            logger.warning("PayPal verify failed %s: %s", r.status_code, r.text[:300])
            return False
        return (r.json().get("verification_status") == "SUCCESS")






# ---------- PayPal (Orders v2, REST) ----------
# NOTE: Payment route handlers (/payments/*) moved to routers/payments.py.
# Webhook handlers (/api/webhook/stripe|paypal|klarna) moved to routers/webhooks.py.
# Helpers below (_paypal_access_token, _klarna_api_base, _apply_entitlement,
# _record_webhook_event, _mark_webhook_processed, _apply_successful_payment,
# _verify_paypal_webhook, PAYPAL_API dict) remain here because they are
# also invoked from background tasks / reconcile endpoints.

PAYPAL_API = {
    "sandbox": "https://api-m.sandbox.paypal.com",
    "live": "https://api-m.paypal.com",
}


async def _paypal_access_token(cfg: Dict) -> tuple[str, str]:
    """Obtain an OAuth2 client-credentials token. Returns (token, api_base)."""
    keys = (cfg.get("provider_keys") or {}).get("paypal") or {}
    client_id = keys.get("client_id")
    client_secret = keys.get("secret") or keys.get("client_secret")
    if not client_id or not client_secret:
        raise HTTPException(400, "PayPal ist nicht konfiguriert (Client-ID / Secret fehlen).")
    env = (keys.get("environment") or "sandbox").lower()
    api_base = PAYPAL_API.get("live" if env in {"live", "production", "prod"} else "sandbox")
    import httpx as _httpx
    async with _httpx.AsyncClient(timeout=20) as http:
        r = await http.post(
            f"{api_base}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(client_id, client_secret),
            headers={"Accept": "application/json"},
        )
        if r.status_code >= 400:
            logger.error("PayPal OAuth error: %s %s", r.status_code, r.text[:500])
            raise HTTPException(502, "PayPal-Authentifizierung fehlgeschlagen")
        return r.json().get("access_token"), api_base


# ---------- Klarna (Payments v1) ----------
async def _klarna_api_base(cfg: Dict) -> tuple[str, str]:
    """Return (basic_auth_header, api_base)."""
    keys = (cfg.get("provider_keys") or {}).get("klarna") or {}
    username = keys.get("username") or keys.get("merchant_id")
    password = keys.get("password") or keys.get("auth_token")
    if not username or not password:
        raise HTTPException(400, "Klarna ist nicht konfiguriert (Username / Password fehlen).")
    region = (keys.get("region") or "eu").lower()
    env = (keys.get("environment") or "sandbox").lower()
    host_map = {
        ("eu", "sandbox"): "https://api.playground.klarna.com",
        ("eu", "live"): "https://api.klarna.com",
        ("na", "sandbox"): "https://api-na.playground.klarna.com",
        ("na", "live"): "https://api-na.klarna.com",
        ("oc", "sandbox"): "https://api-oc.playground.klarna.com",
        ("oc", "live"): "https://api-oc.klarna.com",
    }
    api_base = host_map.get((region, env)) or host_map[("eu", "sandbox")]
    import base64 as _b64
    basic = "Basic " + _b64.b64encode(f"{username}:{password}".encode()).decode()
    return basic, api_base


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
        "_Stand: 23. April 2026_\n\n"
        "Willkommen auf **Eros**, der inklusiven Dating-Plattform für Erwachsene. "
        "Diese Nutzungsbedingungen (nachfolgend „AGB“) regeln die Beziehung "
        "zwischen dir und dem Betreiber der Plattform (siehe Impressum). "
        "Mit der Registrierung erklärst du dich mit diesen AGB einverstanden.\n\n"
        "## 1. Zugangsvoraussetzungen\n"
        "- Die Nutzung ist ausschließlich Personen ab **18 Jahren** gestattet.\n"
        "- Du versicherst, dass deine Angaben (Alter, Identität, Fotos, Videos) der Wahrheit entsprechen.\n"
        "- Pro Person ist nur ein Account zulässig; ausgenommen sind offiziell genehmigte Partner-Profile (Paare-Funktion).\n"
        "- Du bist für die Geheimhaltung deiner Zugangsdaten verantwortlich.\n\n"
        "## 2. Leistungsumfang\n"
        "Eros bietet folgende Funktionen:\n"
        "- Erstellen und Pflegen eines persönlichen Dating-Profils inklusive Fotos und – für Premium-Mitglieder – Kurzvideos (max. 4 Videos à 60 Sek., 1080p).\n"
        "- Matching, Chat, Aktivitätsübersicht („Views“) und Statusindikatoren (Stimmungen).\n"
        "- Alben und Events, Blog-Inhalte sowie die Paare-Funktion.\n"
        "- Kostenpflichtige Premium-Funktionen (Abonnements, Boosts) – Details siehe Premium-Seite.\n\n"
        "## 3. Nutzerpflichten & verbotene Handlungen\n"
        "Untersagt sind insbesondere:\n"
        "- Erstellen von Fake-Profilen, Identitätsdiebstahl oder unautorisierte Nutzung fremder Medien.\n"
        "- Belästigung, Hassrede, Diskriminierung, Drohungen, Stalking.\n"
        "- Kommerzielle Werbung, Prostitution, Menschenhandel oder jeglicher Handel mit Personen.\n"
        "- Inhalte, die Minderjährige zeigen, Gewalt verherrlichen oder gegen geltendes Recht verstoßen.\n"
        "- Sexuelle Inhalte ohne Einvernehmen der gezeigten Personen; nicht-einvernehmliches Teilen intimer Medien (NCII) führt zur sofortigen Sperrung und zur Strafanzeige.\n"
        "- Automatisiertes Auslesen (Scraping), Bots, Reverse Engineering, Missbrauch der API.\n"
        "- Einsetzen von Links in Chats zum Umleiten auf externe Angebote oder Betrugsversuche.\n\n"
        "## 4. Moderation\n"
        "Alle hochgeladenen Bilder werden mit KI-gestützter Moderation vorgeprüft und bei Bedarf durch unser Moderations-Team nachgeprüft. "
        "Videos werden grundsätzlich manuell freigegeben. Profile und Inhalte können jederzeit entfernt, unsichtbar geschaltet "
        "oder gesperrt werden, wenn sie gegen diese AGB oder die Community-Richtlinien verstoßen.\n\n"
        "## 5. Inhalte der Nutzer:innen\n"
        "Du behältst alle Rechte an deinen Inhalten (Fotos, Videos, Texte). Für den Betrieb der Plattform räumst du uns "
        "ein nicht-exklusives, weltweites, kostenfreies Nutzungsrecht ein, deine Inhalte zu speichern, anzuzeigen, "
        "zu transcodieren und anderen Mitgliedern gemäß deinen Sichtbarkeits-Einstellungen zugänglich zu machen. "
        "Mit Löschung deines Accounts erlischt dieses Recht, soweit keine gesetzlichen Aufbewahrungspflichten bestehen.\n\n"
        "## 6. Premium-Abonnements, Boosts, Promo-Codes\n"
        "- Premium-Abos verlängern sich automatisch, sofern nicht rechtzeitig gekündigt. Die aktuelle Laufzeit und Verlängerung siehst du im Bereich „Konto → Abo“.\n"
        "- Kündigung ist jederzeit möglich; die Premium-Funktionen bleiben bis zum Ende der laufenden Periode aktiv.\n"
        "- Promo-Codes können nur einmal pro Konto eingelöst werden, sind nicht mit anderen Aktionen kombinierbar und nicht auszahlbar.\n"
        "- Boosts verfallen nach Ablauf der Boost-Dauer.\n\n"
        "## 7. Haftung\n"
        "Wir haften für Vorsatz und grobe Fahrlässigkeit unbeschränkt. Für leichte Fahrlässigkeit haften wir nur bei Verletzung wesentlicher "
        "Vertragspflichten und begrenzt auf den typischen, vorhersehbaren Schaden. Die Haftung für mittelbare Schäden (z. B. entgangener Gewinn) "
        "ist ausgeschlossen. Ansprüche nach dem Produkthaftungsgesetz und bei Schäden an Leben, Körper oder Gesundheit bleiben unberührt.\n\n"
        "## 8. Offline-Treffen\n"
        "Eros vermittelt keine persönlichen Treffen. Triffst du dich mit einer anderen Person, geschieht dies auf deine eigene Verantwortung. "
        "Bitte beachte unsere Sicherheitstipps im Blog und auf der Community-Seite.\n\n"
        "## 9. Änderungen dieser AGB\n"
        "Wir können diese AGB anpassen, wenn gesetzliche Änderungen, Funktions-Erweiterungen oder berechtigte Sicherheitsgründe dies erfordern. "
        "Wesentliche Änderungen kündigen wir dir per E-Mail oder In-App-Broadcast mindestens 30 Tage im Voraus an. "
        "Widersprichst du nicht, gelten die neuen AGB als angenommen.\n\n"
        "## 10. Schlussbestimmungen\n"
        "Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Ist eine Bestimmung unwirksam, bleibt der Rest wirksam. "
        "Für Verbraucher gelten die zwingenden Verbraucherschutzbestimmungen ihres Wohnsitzlandes.\n"
    ),
    "privacy": (
        "# Datenschutzerklärung\n\n"
        "_Stand: 23. April 2026_\n\n"
        "Wir nehmen den Schutz deiner persönlichen Daten ernst. Diese Erklärung informiert dich über Art, Umfang und Zweck "
        "der Verarbeitung auf **Eros** gemäß der Datenschutz-Grundverordnung (DSGVO).\n\n"
        "## 1. Verantwortlicher\n"
        "Kontaktdaten des Betreibers findest du im [Impressum](/legal/imprint). "
        "Fragen zum Datenschutz richte bitte an unseren Datenschutz-Kontakt, der dort hinterlegt ist.\n\n"
        "## 2. Verarbeitete Daten und Zwecke\n"
        "| Kategorie | Zweck | Rechtsgrundlage |\n"
        "|---|---|---|\n"
        "| Account-Stammdaten (E-Mail, Passwort-Hash, Alter, Geschlechtsidentität, Orientierung) | Authentifizierung, Altersverifikation, Matching | Art. 6 Abs. 1 lit. b DSGVO (Vertrag) |\n"
        "| Profil-Medien (Fotos, Premium-Videos) | Darstellung deines Profils | Art. 6 Abs. 1 lit. b DSGVO |\n"
        "| Chat-Nachrichten, Events, Alben | Kernfunktion der Plattform | Art. 6 Abs. 1 lit. b DSGVO |\n"
        "| Standort (wenn erlaubt, alle 15 Min.) | Entfernungsbasiertes Matching | Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) |\n"
        "| Zahlungsdaten (via Stripe, PayPal, Klarna) | Abwicklung von Premium-Abos & Boosts | Art. 6 Abs. 1 lit. b DSGVO |\n"
        "| Moderations-Logs, KI-Bildanalysen | Plattform-Sicherheit, Schutz vor illegalen Inhalten | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) |\n"
        "| Technische Logs (IP, User-Agent, Zeitstempel) | Betrugsprävention, Rate-Limits | Art. 6 Abs. 1 lit. f DSGVO |\n\n"
        "## 3. Automatisierte Bildmoderation\n"
        "Vor der Veröffentlichung werden Profilbilder und Chat-Medien automatisiert auf Hinweise auf illegale oder gegen die Community-Richtlinien verstoßende Inhalte geprüft. "
        "Die Prüfung erfolgt ausschließlich auf technischem Weg (Mustererkennung); eine Profilbildung findet nicht statt. "
        "Eine manuelle Zweitprüfung durch geschulte Mitarbeiter:innen wird bei Grenzfällen vorgenommen.\n\n"
        "## 4. Weitergabe von Daten\n"
        "Deine Daten werden nur in folgenden Fällen weitergegeben:\n"
        "- An Auftragsverarbeiter (Hosting, Zahlungsabwicklung, E-Mail-Versand, KI-Moderation) auf Grundlage von Auftragsverarbeitungsverträgen gem. Art. 28 DSGVO.\n"
        "- An andere Mitglieder entsprechend deinen Sichtbarkeits-Einstellungen (z. B. öffentliches Profil, Chat-Empfänger).\n"
        "- An Behörden, wenn wir hierzu rechtlich verpflichtet sind.\n"
        "Zahlungsanbieter (Stripe, PayPal, Klarna) verarbeiten Zahlungsdaten eigenverantwortlich gemäß ihrer eigenen Datenschutzbestimmungen.\n\n"
        "## 5. Speicherdauer\n"
        "- Account-Daten: bis zur Löschung des Kontos durch dich.\n"
        "- Chat-Nachrichten: bis zur Löschung durch dich, den Gegenüber oder Löschung des Accounts.\n"
        "- Moderations-Logs: 12 Monate (länger nur bei laufenden Ermittlungen).\n"
        "- Rechnungsdaten: 10 Jahre gem. § 147 AO.\n\n"
        "## 6. Deine Rechte\n"
        "Dir stehen folgende Rechte zu: **Auskunft** (Art. 15), **Berichtigung** (Art. 16), **Löschung** (Art. 17), **Einschränkung** (Art. 18), "
        "**Datenübertragbarkeit** (Art. 20), **Widerspruch** (Art. 21) sowie **Widerruf erteilter Einwilligungen** (Art. 7 Abs. 3). "
        "Du kannst dich außerdem bei der zuständigen Datenschutz-Aufsichtsbehörde beschweren.\n\n"
        "## 7. Account löschen\n"
        "Im Bereich **Einstellungen → Account** kannst du deinen Account und alle personenbezogenen Inhalte selbst löschen. "
        "Die Löschung erfolgt innerhalb von 30 Tagen vollständig; gesetzliche Aufbewahrungspflichten (z. B. Rechnungsdaten) bleiben davon unberührt.\n\n"
        "## 8. Tracking & Analytics\n"
        "Eros verzichtet bewusst auf Third-Party-Tracking und externe Analytics-Dienste. Es werden keine Werbecookies gesetzt, "
        "keine Fingerprints erstellt und keine Daten an Werbenetzwerke weitergegeben.\n"
    ),
    "imprint": (
        "# Impressum\n\n"
        "_Angaben gemäß § 5 TMG und § 18 MStV._\n\n"
        "**Anbieter:**  \n"
        "_Bitte durch Administrator:in ausfüllen_\n\n"
        "**Anschrift:**  \n"
        "_Straße, Hausnummer_  \n"
        "_PLZ, Ort_  \n"
        "_Land_\n\n"
        "**Kontakt:**  \n"
        "E-Mail: _kontakt@…_  \n"
        "Telefon: _…_\n\n"
        "**Datenschutz-Kontakt:**  \n"
        "E-Mail: _datenschutz@…_\n\n"
        "**Registergericht / Handelsregister-Nr.:**  \n"
        "_z. B. Amtsgericht Musterstadt, HRB 123456_\n\n"
        "**Vertretungsberechtigt:**  \n"
        "_Geschäftsführer:in_\n\n"
        "**Umsatzsteuer-ID gem. § 27a UStG:**  \n"
        "_DE…_\n\n"
        "**Verantwortlich für den Inhalt gem. § 18 Abs. 2 MStV:**  \n"
        "_Name, Anschrift wie oben_\n\n"
        "## Online-Streitbeilegung\n"
        "Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: "
        "[ec.europa.eu/consumers/odr](https://ec.europa.eu/consumers/odr). "
        "Wir sind nicht bereit oder verpflichtet, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.\n\n"
        "## Haftungshinweise\n"
        "Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. "
        "Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.\n"
    ),
    "community": (
        "# Community-Richtlinien\n\n"
        "_Zuletzt aktualisiert: 23. April 2026_\n\n"
        "Eros lebt von einer respektvollen, inklusiven Community. Die folgenden Regeln gelten verbindlich für alle Mitglieder.\n\n"
        "## 1. Respekt & Inklusion\n"
        "- **Keine Diskriminierung** wegen Geschlechtsidentität, sexueller Orientierung, Herkunft, Religion, Alter, Behinderung oder Körperbau.\n"
        "- **Misgendering oder Deadnaming ist verboten** – akzeptiere die Selbstbezeichnung anderer Mitglieder.\n"
        "- **Hassrede, Drohungen, Stalking und Belästigung** führen zur sofortigen Sperrung.\n\n"
        "## 2. Authentizität\n"
        "- Nutze nur **eigene** Fotos und Videos. Das Hochladen fremder Medien oder KI-generierter Fake-Bilder als eigene ist untersagt.\n"
        "- Keine Catfishing- oder Impersonation-Versuche.\n"
        "- Alter und grundlegende Profil-Angaben müssen korrekt sein.\n\n"
        "## 3. Sexuelle Inhalte\n"
        "- **Einvernehmen** ist Pflicht – in Chats, bei Bild-Austausch und bei der Darstellung anderer Personen.\n"
        "- **Nicht-einvernehmlich** geteilte intime Medien (Revenge Porn / NCII) werden sofort gelöscht, der Account gesperrt und Strafanzeige erstattet.\n"
        "- Explizite Inhalte sind nur in **privaten Alben** oder **privaten Chats mit Einwilligung** zulässig – niemals im öffentlichen Profilbild.\n"
        "- Unverlangte „Dickpics“ oder andere unaufgeforderte explizite Medien sind verboten.\n\n"
        "## 4. Minderjährige & CSAM\n"
        "Inhalte, die Minderjährige in sexualisierter Form zeigen, werden sofort entfernt, der Account dauerhaft gesperrt "
        "und die Inhalte an die zuständigen Behörden und den NCMEC-Partnerdienst gemeldet. "
        "Verdachtsmeldungen bitte umgehend über den Melde-Button oder an _missbrauch@…_.\n\n"
        "## 5. Keine Kommerzialisierung\n"
        "- Eros ist kein Marktplatz. Kommerzielle Werbung, Prostitution, Escort-Angebote, "
        "verkappte Werbung für OnlyFans/Fansly oder Verweise auf bezahlte Inhalte sind untersagt.\n"
        "- Spam, Affiliate-Links und MLM sind verboten.\n\n"
        "## 6. Links & externe Plattformen\n"
        "Links in Chats sind aus Sicherheitsgründen **nicht erlaubt**. Der Austausch von Messenger-Handles (Telegram, WhatsApp, …) "
        "ist zulässig, wenn beide Seiten einverstanden sind; Vorsicht aber vor Betrugsversuchen.\n\n"
        "## 7. Sicherheit bei Treffen\n"
        "- Triff dich **zuerst in der Öffentlichkeit** und informiere Freunde oder Familie.\n"
        "- Vertraue auf dein Bauchgefühl – Treffen können jederzeit abgebrochen werden.\n"
        "- Erpressung und Drohungen bitte sofort bei uns und bei der Polizei melden.\n\n"
        "## 8. Melde-Pipeline\n"
        "Jedes Profil, jeder Chat und jede Nachricht hat einen **Melden-Button**. Das Moderationsteam prüft Meldungen "
        "werktags innerhalb von 24 Stunden, in dringenden Fällen auch am Wochenende. "
        "Wiederholte grundlose Meldungen (False-Flagging) werden geahndet.\n\n"
        "## 9. Konsequenzen\n"
        "Abgestufte Maßnahmen: Verwarnung → zeitweise Sperre → Account-Löschung ohne Rückerstattung. "
        "Bei Straftaten kooperieren wir mit Ermittlungsbehörden.\n"
    ),
    "cookies": (
        "# Cookie- und LocalStorage-Hinweis\n\n"
        "_Stand: 23. April 2026_\n\n"
        "Eros verwendet **keine** Werbe- oder Tracking-Cookies und bindet **keine** Drittanbieter-Analytics ein. "
        "Wir setzen ausschließlich technisch erforderliche Speichereinträge ein:\n\n"
        "## Technisch notwendige Einträge\n"
        "| Speicher | Inhalt | Zweck | Ablauf |\n"
        "|---|---|---|---|\n"
        "| `eros_token` (LocalStorage) | Session-JWT | Hält dich zwischen Aufrufen eingeloggt | Bis Logout / Tab-Schließen |\n"
        "| `theme` (LocalStorage) | `light` / `dark` / `system` | Merkt dein gewähltes Farbschema | Bis du es änderst |\n"
        "| `eros_cookies_acked` (LocalStorage) | Boolean | Blendet diesen Hinweis nach Zustimmung aus | 12 Monate |\n"
        "| Session-Cookie (Server) | Nicht gesetzt | – | – |\n\n"
        "## Keine Third-Party-Integrationen im Frontend\n"
        "- Keine Google Analytics / GA4, kein Facebook-Pixel, kein Hotjar, kein TikTok-Pixel.\n"
        "- Keine Werbung.\n"
        "- Stripe / PayPal / Klarna laden ihre Skripte ausschließlich im Checkout-Flow (erst wenn du auf „Bezahlen“ klickst).\n\n"
        "## Rechtsgrundlage\n"
        "Die technisch notwendigen Speichereinträge basieren auf Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und "
        "§ 25 Abs. 2 Nr. 2 TTDSG (unbedingt erforderlich).\n\n"
        "## Löschen\n"
        "Alle genannten Einträge kannst du jederzeit in deinem Browser manuell löschen; Eros funktioniert dann ohne Einschränkungen, "
        "du musst dich nach dem Löschen des Tokens nur neu einloggen.\n"
    ),
    "cancellation": (
        "# Widerrufsbelehrung\n\n"
        "_Hinweise für Verbraucher:innen gem. § 312g BGB i. V. m. § 355 BGB._\n\n"
        "## Widerrufsrecht\n"
        "Du hast das Recht, binnen **14 Tagen** ohne Angabe von Gründen deinen Vertrag über Eros-Premium (Abonnement) zu widerrufen. "
        "Die Frist beginnt mit dem Abschluss des Premium-Vertrages.\n\n"
        "Um dein Widerrufsrecht auszuüben, musst du uns (siehe [Impressum](/legal/imprint)) mittels einer eindeutigen Erklärung "
        "(z. B. per E-Mail) über deinen Entschluss informieren. Du kannst das nachfolgende Muster-Widerrufsformular verwenden – "
        "musst es aber nicht.\n\n"
        "Zur Fristwahrung reicht es aus, dass du die Mitteilung vor Ablauf der Widerrufsfrist absendest.\n\n"
        "## Folgen des Widerrufs\n"
        "Wenn du deinen Vertrag widerrufst, erstatten wir dir bereits geleistete Zahlungen unverzüglich, spätestens binnen "
        "**14 Tagen** ab Zugang des Widerrufs. Wir verwenden für die Rückzahlung dasselbe Zahlungsmittel, das du bei der Transaktion "
        "eingesetzt hast, sofern mit dir nichts anderes vereinbart wurde; Entgelte fallen nicht an.\n\n"
        "## Vorzeitiges Erlöschen des Widerrufsrechts\n"
        "Dein Widerrufsrecht erlischt vorzeitig, wenn wir – mit deiner **ausdrücklichen Zustimmung und Kenntnisnahme**, dass du "
        "dein Widerrufsrecht mit Beginn der Ausführung verlierst – mit der Ausführung des Premium-Vertrags vor Ablauf der Widerrufsfrist "
        "begonnen haben (§ 356 Abs. 5 BGB). Du erteilst diese Zustimmung beim Abschluss des Abos durch einen Haken im Checkout.\n\n"
        "Für tatsächlich genutzte Boosts und verbrauchte Premium-Vorteile (z. B. abgelaufene Boost-Minuten) kann ein anteiliger "
        "Wertersatz berechnet werden.\n\n"
        "## Muster-Widerrufsformular\n"
        "```\n"
        "An: [Anbieter – Anschrift/E-Mail aus Impressum]\n"
        "Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den\n"
        "Kauf der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*):\n"
        "Eros-Premium Abo (Paket: _______, Bestell-Nr.: _______)\n\n"
        "Bestellt am (*) / erhalten am (*): _______\n"
        "Name der/des Verbraucher(s): _______\n"
        "Anschrift der/des Verbraucher(s): _______\n"
        "Unterschrift der/des Verbraucher(s) (nur bei Mitteilung auf Papier): _______\n"
        "Datum: _______\n"
        "(*) Unzutreffendes streichen.\n"
        "```\n\n"
        "## Kündigung laufender Abonnements\n"
        "Unabhängig vom Widerrufsrecht kannst du dein Abo jederzeit im Bereich **Konto → Premium** kündigen. "
        "Die bereits bezahlte Laufzeit bleibt bis zum Periodenende aktiv; es erfolgt keine anteilige Rückerstattung über das Widerrufsrecht hinaus.\n"
    ),
}


async def _ensure_default_legal_pages():
    for key, title in LEGAL_PAGE_KEYS.items():
        default_content = _DEFAULT_LEGAL_CONTENT.get(key, "")
        doc = await db.legal_pages.find_one({"key": key})
        if not doc:
            await db.legal_pages.insert_one({
                "key": key,
                "title": title,
                "content_markdown": default_content,
                "updated_at": now_utc().isoformat(),
                "updated_by": None,
            })
            continue
        # Refresh placeholders that were never edited by an admin.
        # Safe: only overwrite entries where `updated_by` is still None AND
        # the existing content is shorter than our default (i.e. a stub/placeholder).
        existing = doc.get("content_markdown", "") or ""
        updated_by = doc.get("updated_by")
        if updated_by is None and len(existing) < len(default_content):
            await db.legal_pages.update_one(
                {"key": key},
                {"$set": {
                    "title": title,
                    "content_markdown": default_content,
                    "updated_at": now_utc().isoformat(),
                }},
            )


# NOTE: Legal route handlers moved to routers/legal.py (imported at bottom of file).
# `_ensure_default_legal_pages`, `LEGAL_PAGE_KEYS` and `_DEFAULT_LEGAL_CONTENT`
# remain here because the app's startup sequence also seeds legal pages.


# ---------- Platform config (admin-tunable runtime settings) ----------
DEFAULT_PLATFORM_CONFIG = {
    "free_daily_like_limit": 5,
    "super_like_daily_limit": 1,
    "visitors_window_days": 30,
    "premium_only_filter_keys": [
        "kinks", "cup_sizes", "penis_categories", "sti_status",
        "body_types", "min_height_cm", "max_height_cm",
    ],
    "premium_feature_keys": [
        "visitors", "stealth_mode", "advanced_filters",
        "super_like", "unlimited_likes",
    ],
}


async def _get_platform_config() -> dict:
    """Return persisted platform config merged with defaults."""
    doc = await db.platform_config.find_one({"key": "main"}) or {}
    merged = {**DEFAULT_PLATFORM_CONFIG, **{k: v for k, v in doc.items() if k not in {"_id", "key"}}}
    return merged


@api_router.get("/platform-config")
async def public_platform_config(user=Depends(_require_user)):
    """Config exposed to every authenticated client (no secrets)."""
    cfg = await _get_platform_config()
    now_iso = now_utc().isoformat()
    is_premium = bool(user.get("premium_expires_at") and user["premium_expires_at"] > now_iso) or user.get("role") != "user"
    return {
        "free_daily_like_limit": int(cfg.get("free_daily_like_limit", 5)),
        "super_like_daily_limit": int(cfg.get("super_like_daily_limit", 1)),
        "visitors_window_days": int(cfg.get("visitors_window_days", 30)),
        "premium_only_filter_keys": list(cfg.get("premium_only_filter_keys", [])),
        "premium_feature_keys": list(cfg.get("premium_feature_keys", [])),
        "is_premium": is_premium,
    }






# ---------- Premium helpers ----------
def _is_user_premium(doc: dict) -> bool:
    if not doc:
        return False
    if doc.get("role") and doc["role"] != "user":
        return True
    exp = doc.get("premium_expires_at")
    return bool(exp and exp > now_utc().isoformat())


def _today_key_utc() -> str:
    return now_utc().strftime("%Y-%m-%d")


async def _count_likes_today(user_id: str, kind: str = "like") -> int:
    """Counts how many likes/super-likes the user has sent today (UTC)."""
    start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    q: Dict = {"from_user": user_id, "created_at": {"$gte": start}}
    if kind == "super":
        q["super"] = True
    return await db.likes.count_documents(q)


# ---------- Visitors (Premium feature) ----------
async def _record_visit(viewer: dict, target_id: str):
    """Log a visit unless viewer is in stealth mode or viewing self, banned, system."""
    if not viewer or not target_id or viewer.get("id") == target_id:
        return
    if viewer.get("id") == EROS_SYSTEM_USER_ID or target_id == EROS_SYSTEM_USER_ID:
        return
    if (viewer.get("privacy") or {}).get("stealth_mode"):
        return
    try:
        await db.visits.update_one(
            {"viewer_id": viewer["id"], "target_id": target_id},
            {
                "$set": {
                    "viewer_id": viewer["id"],
                    "target_id": target_id,
                    "last_visited_at": now_utc().isoformat(),
                },
                "$inc": {"count": 1},
                "$setOnInsert": {"first_visited_at": now_utc().isoformat()},
            },
            upsert=True,
        )
    except Exception:
        pass


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


# ---------- Super-Like (Premium, rate-limited) ----------
@api_router.post("/likes/super")
async def super_like(payload: dict, user=Depends(_require_user)):
    target_user_id = (payload or {}).get("target_user_id")
    if not target_user_id:
        raise HTTPException(400, "target_user_id required")
    if target_user_id == user["id"]:
        raise HTTPException(400, "Cannot super-like yourself")
    if not _is_user_premium(user):
        raise HTTPException(402, "Super-Like ist ein Premium-Feature")
    target = await db.users.find_one({"id": target_user_id})
    if not target or target.get("banned"):
        raise HTTPException(404, "Target not found")
    cfg = await _get_platform_config()
    daily_limit = int(cfg.get("super_like_daily_limit", 1))
    sent_today = await _count_likes_today(user["id"], kind="super")
    if sent_today >= daily_limit:
        raise HTTPException(429, f"Super-Like-Tageslimit erreicht ({daily_limit}/Tag)")
    # Insert or upgrade an existing like to a super-like
    now_iso = now_utc().isoformat()
    existing = await db.likes.find_one({"from_user": user["id"], "to_user": target_user_id})
    if existing:
        await db.likes.update_one({"_id": existing["_id"]}, {"$set": {"super": True, "super_at": now_iso}})
    else:
        await db.likes.insert_one({
            "id": str(uuid.uuid4()),
            "from_user": user["id"],
            "to_user": target_user_id,
            "created_at": now_iso,
            "super": True,
            "super_at": now_iso,
        })
    # Reuse matching logic
    mutual = await db.likes.find_one({"from_user": target_user_id, "to_user": user["id"]})
    match_id = None
    if mutual:
        existing_m = await db.matches.find_one({
            "$or": [
                {"user_a": user["id"], "user_b": target_user_id},
                {"user_a": target_user_id, "user_b": user["id"]},
            ]
        })
        if existing_m:
            match_id = existing_m["id"]
        else:
            match_id = str(uuid.uuid4())
            await db.matches.insert_one({
                "id": match_id,
                "user_a": user["id"],
                "user_b": target_user_id,
                "created_at": now_iso,
                "last_message_at": None,
                "super": True,
            })
            await _audit(user["id"], "match_created", match_id, {"super": True})
    await _audit(user["id"], "super_like", target_user_id)
    return {"liked": True, "super": True, "matched": bool(match_id), "match_id": match_id}


@api_router.get("/likes/quota")
async def likes_quota(user=Depends(_require_user)):
    """Returns the caller's remaining like budget for today."""
    cfg = await _get_platform_config()
    is_premium = _is_user_premium(user)
    today = await _count_likes_today(user["id"])
    super_today = await _count_likes_today(user["id"], kind="super")
    free_limit = int(cfg.get("free_daily_like_limit", 5))
    super_limit = int(cfg.get("super_like_daily_limit", 1))
    return {
        "is_premium": is_premium,
        "likes_today": today,
        "daily_like_limit": None if is_premium else free_limit,
        "likes_remaining": None if is_premium else max(0, free_limit - today),
        "super_likes_today": super_today,
        "super_likes_remaining": (max(0, super_limit - super_today) if is_premium else 0),
    }


# ---------- Promo Codes ----------
ALLOWED_PROMO_KINDS = {"premium_days", "boost_minutes"}


def _promo_public(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "code": doc.get("code"),
        "kind": doc.get("kind"),
        "value": int(doc.get("value", 0)),
        "max_uses": doc.get("max_uses"),
        "used_count": int(doc.get("used_count", 0)),
        "starts_at": doc.get("starts_at"),
        "expires_at": doc.get("expires_at"),
        "one_per_user": bool(doc.get("one_per_user", True)),
        "new_users_only": bool(doc.get("new_users_only", False)),
        "auto_on_register": bool(doc.get("auto_on_register", False)),
        "active": bool(doc.get("active", True)),
        "description": doc.get("description"),
        "created_at": doc.get("created_at"),
        "created_by": doc.get("created_by"),
    }


async def _apply_promo_to_user(promo: dict, user_doc: dict) -> dict:
    """Grants the promo's entitlement to the user and returns the updated user doc."""
    kind = promo.get("kind")
    value = int(promo.get("value", 0))
    update_set: Dict = {}
    now = now_utc()
    if kind == "premium_days" and value > 0:
        current_exp = user_doc.get("premium_expires_at")
        try:
            base = datetime.fromisoformat(current_exp) if current_exp and current_exp > now.isoformat() else now
        except Exception:
            base = now
        new_exp = base + timedelta(days=value)
        update_set["premium_expires_at"] = new_exp.isoformat()
    elif kind == "boost_minutes" and value > 0:
        current = user_doc.get("boost_expires_at")
        try:
            base = datetime.fromisoformat(current) if current and current > now.isoformat() else now
        except Exception:
            base = now
        new_exp = base + timedelta(minutes=value)
        update_set["boost_expires_at"] = new_exp.isoformat()
    if update_set:
        await db.users.update_one({"id": user_doc["id"]}, {"$set": update_set})
    return {**user_doc, **update_set}










async def _validate_promo_for_user(promo: dict, user_doc: dict, *, at_registration: bool = False) -> Optional[str]:
    """Returns an error string if promo cannot be redeemed by user. None if OK."""
    if not promo or not promo.get("active"):
        return "Dieser Code ist nicht (mehr) aktiv."
    now_iso = now_utc().isoformat()
    if promo.get("starts_at") and promo["starts_at"] > now_iso:
        return "Dieser Code ist noch nicht aktiv."
    if promo.get("expires_at") and promo["expires_at"] < now_iso:
        return "Dieser Code ist abgelaufen."
    max_uses = promo.get("max_uses")
    if max_uses is not None and int(promo.get("used_count", 0)) >= int(max_uses):
        return "Dieser Code wurde bereits vollständig eingelöst."
    if promo.get("new_users_only") and not at_registration:
        # Only allowed if user was created in the last 24h and hasn't redeemed yet
        try:
            created = datetime.fromisoformat(user_doc.get("created_at") or now_iso)
            if (now_utc() - created).total_seconds() > 86400:
                return "Dieser Code gilt nur für neue Registrierungen."
        except Exception:
            pass
    if promo.get("one_per_user"):
        already = await db.promo_redemptions.find_one({"code_id": promo["id"], "user_id": user_doc["id"]})
        if already:
            return "Du hast diesen Code bereits eingelöst."
    return None


@api_router.post("/promo/redeem")
async def redeem_promo(payload: dict, user=Depends(_require_user)):
    code = (payload or {}).get("code", "").strip().upper()
    if not code:
        raise HTTPException(400, "Code erforderlich")
    promo = await db.promo_codes.find_one({"code": code})
    if not promo:
        raise HTTPException(404, "Code nicht gefunden")
    err = await _validate_promo_for_user(promo, user)
    if err:
        raise HTTPException(400, err)
    # Apply entitlement
    user_after = await _apply_promo_to_user(promo, user)
    # Record redemption & increment
    await db.promo_redemptions.insert_one({
        "id": str(uuid.uuid4()),
        "code_id": promo["id"],
        "code": promo["code"],
        "user_id": user["id"],
        "kind": promo.get("kind"),
        "value": int(promo.get("value", 0)),
        "redeemed_at": now_utc().isoformat(),
    })
    await db.promo_codes.update_one({"id": promo["id"]}, {"$inc": {"used_count": 1}})
    await _audit(user["id"], "promo_redeem", promo["id"], {"code": promo["code"], "kind": promo.get("kind"), "value": promo.get("value")})
    return {
        "ok": True,
        "kind": promo.get("kind"),
        "value": int(promo.get("value", 0)),
        "premium_until": user_after.get("premium_expires_at"),
        "boost_until": user_after.get("boost_expires_at"),
    }


async def _maybe_apply_auto_register_promos(user_doc: dict) -> List[dict]:
    """Apply every active auto_on_register promo that still has capacity."""
    applied: List[dict] = []
    now_iso = now_utc().isoformat()
    cursor = db.promo_codes.find({"auto_on_register": True, "active": True})
    async for p in cursor:
        if p.get("starts_at") and p["starts_at"] > now_iso:
            continue
        if p.get("expires_at") and p["expires_at"] < now_iso:
            continue
        max_uses = p.get("max_uses")
        if max_uses is not None and int(p.get("used_count", 0)) >= int(max_uses):
            continue
        # Apply & record
        user_doc = await _apply_promo_to_user(p, user_doc)
        await db.promo_redemptions.insert_one({
            "id": str(uuid.uuid4()),
            "code_id": p["id"],
            "code": p.get("code"),
            "user_id": user_doc["id"],
            "kind": p.get("kind"),
            "value": int(p.get("value", 0)),
            "redeemed_at": now_utc().isoformat(),
            "auto": True,
        })
        await db.promo_codes.update_one({"id": p["id"]}, {"$inc": {"used_count": 1}})
        applied.append({"code": p.get("code"), "kind": p.get("kind"), "value": int(p.get("value", 0))})
    return applied


# ---------- Blog ----------
import re as _re_blog

BLOG_ALLOWED_STATUSES = {"draft", "published", "archived"}

# --- Blog HTML sanitization (prevents stored XSS via admin-authored content) ---
import bleach as _bleach  # runtime optional – installed via requirements

_BLOG_ALLOWED_TAGS = [
    "p", "br", "strong", "em", "u", "s", "blockquote", "code", "pre",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "th", "td",
    "hr",
]
_BLOG_ALLOWED_ATTRS = {
    "a": ["href", "title", "rel", "target"],
    "img": ["src", "alt", "title", "width", "height"],
    "*": ["class"],
}
_BLOG_ALLOWED_PROTOCOLS = ["http", "https", "mailto", "data"]


def _sanitize_blog_html(html: str) -> str:
    """Strip all script / event-handler / javascript: content from editor
    HTML. Allowlist based, so novel vectors are blocked by default. Images
    may still be data-URLs (used by the TipTap image upload flow)."""
    if not html:
        return ""
    cleaned = _bleach.clean(
        html,
        tags=_BLOG_ALLOWED_TAGS,
        attributes=_BLOG_ALLOWED_ATTRS,
        protocols=_BLOG_ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )
    # Force rel="noopener noreferrer" on external links to prevent tabnabbing
    cleaned = _bleach.linkifier.Linker(
        callbacks=[_bleach.callbacks.nofollow, _bleach.callbacks.target_blank],
        skip_tags=["pre", "code"],
    ).linkify(cleaned)
    return cleaned


def _slugify(s: str) -> str:
    s = (s or "").strip().lower()
    s = _re_blog.sub(r"[^a-z0-9\s-]+", "", s)
    s = _re_blog.sub(r"\s+", "-", s).strip("-")
    return s[:80] or "post"


def _blog_reading_time(html: str) -> int:
    if not html:
        return 1
    txt = _re_blog.sub(r"<[^>]+>", " ", html)
    words = len([w for w in txt.split() if w])
    return max(1, round(words / 220))  # ~220 wpm


def _blog_public(doc: dict, author: Optional[dict] = None) -> dict:
    out = {
        "id": doc.get("id"),
        "slug": doc.get("slug"),
        "title": doc.get("title"),
        "excerpt": doc.get("excerpt"),
        "content_html": doc.get("content_html"),
        "cover_image": doc.get("cover_image"),
        "tags": doc.get("tags") or [],
        "status": doc.get("status", "draft"),
        "author_id": doc.get("author_id"),
        "author_name": (author or {}).get("display_name") if author else doc.get("author_name"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "published_at": doc.get("published_at"),
        "reading_minutes": int(doc.get("reading_minutes") or _blog_reading_time(doc.get("content_html") or "")),
    }
    return out


# NOTE: Blog route handlers moved to routers/blog.py (imported at bottom).
# Helpers (`_sanitize_blog_html`, `_slugify`, `_blog_reading_time`,
# `_blog_public`, `BLOG_ALLOWED_STATUSES`) stay in this module.


# ---------- Couples / Partner Profiles ----------
def _normalize_persona_b(payload: Optional[dict]) -> Optional[dict]:
    """Sanitize an incoming persona_b dict (second person in a duo account).

    Keeps the same schema as the primary user's public fields so the UI can render both sides symmetrically.
    """
    if not isinstance(payload, dict):
        return None
    out: Dict = {}
    str_fields = [
        "display_name", "bio", "gender_identity", "pronouns", "orientation",
        "body_type", "ethnicity", "smoking", "drinking", "diet",
        "sti_status", "sti_tested_on", "cup_size",
    ]
    for k in str_fields:
        v = payload.get(k)
        if isinstance(v, str):
            out[k] = v.strip()[:200] or None
    list_fields = ["languages", "interests", "kinks", "photos"]
    for k in list_fields:
        v = payload.get(k)
        if isinstance(v, list):
            out[k] = v[:30]
    num_fields = ["height_cm", "penis_length_cm", "penis_girth_cm"]
    for k in num_fields:
        v = payload.get(k)
        try:
            if v is not None:
                out[k] = float(v)
        except Exception:
            pass
    # Age / birth_date
    if payload.get("birth_date"):
        out["birth_date"] = str(payload["birth_date"])[:10]
    elif payload.get("age") is not None:
        try:
            out["age"] = int(payload["age"])
        except Exception:
            pass
    # Photos: coerce to list of {data, is_primary}
    if isinstance(out.get("photos"), list):
        norm_photos = []
        for p in out["photos"]:
            if isinstance(p, str) and p.startswith("data:image/"):
                norm_photos.append({"data": p, "is_primary": not norm_photos})
            elif isinstance(p, dict) and p.get("data"):
                norm_photos.append({
                    "data": p["data"],
                    "is_primary": bool(p.get("is_primary")) or not norm_photos,
                })
        out["photos"] = norm_photos[:5]
    # Strip Nones
    return {k: v for k, v in out.items() if v is not None and v != ""}


def _persona_b_public(persona_b: Optional[dict]) -> Optional[dict]:
    """Return public version of persona_b data for API responses."""
    if not isinstance(persona_b, dict):
        return None
    
    # Return the same data as it's already normalized and safe for public consumption
    # This mirrors the public_user_from_doc pattern for consistency
    return persona_b


async def _get_partner_user(user_doc: dict) -> Optional[dict]:
    pid = user_doc.get("partner_user_id")
    if not pid:
        return None
    return await db.users.find_one({"id": pid})


def _couple_people_for_chat(user_doc: dict, partner_doc: Optional[dict]) -> list:
    """Return a list of people participating in a couple chat (for match headers)."""
    people = [{
        "id": user_doc["id"],
        "display_name": user_doc.get("display_name"),
        "photos": user_doc.get("photos") or [],
    }]
    if partner_doc:
        people.append({
            "id": partner_doc["id"],
            "display_name": partner_doc.get("display_name"),
            "photos": partner_doc.get("photos") or [],
        })
    return people


async def _couple_identity_ids(user_doc: dict) -> List[str]:
    """Return all user IDs that share the same couple chat identity (self + linked partner)."""
    ids = [user_doc["id"]]
    if user_doc.get("partner_user_id"):
        ids.append(user_doc["partner_user_id"])
    return ids


# ---------- Wire ----------
# Late-bind router modules: each of these registers its routes on the
# `api_router` defined above via `@api_router.<verb>` decorators. Importing
# them *after* all helpers have been declared avoids circular imports.
# This is step 1 of the server.py router refactor (see /app/plan.md Phase 11).
from routers import legal as _legal_routes  # noqa: E402,F401
from routers import blog as _blog_routes  # noqa: E402,F401
from routers import couples as _couples_routes  # noqa: E402,F401
from routers import payments as _payments_routes  # noqa: E402,F401
from routers import webhooks as _webhook_routes  # noqa: E402,F401
from routers import admin as _admin_routes  # noqa: E402,F401

app.include_router(api_router)

# CORS: if credentials are allowed, wildcard origins are insecure. Require
# an explicit allowlist (comma-separated) via the CORS_ORIGINS env var.
_cors_raw = os.environ.get("CORS_ORIGINS", "*").strip()
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
_cors_wildcard = (len(_cors_origins) == 1 and _cors_origins[0] == "*")
# When wildcard is requested with credentials, browsers will reject anyway.
# We default to credentials=False on wildcard to eliminate the config smell.
_cors_allow_credentials = not _cors_wildcard

app.add_middleware(
    CORSMiddleware,
    allow_credentials=_cors_allow_credentials,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept"],
    expose_headers=["Content-Encoding", "Content-Length"],
    max_age=600,
)

# Transparent response compression: negotiates gzip with clients that send
# Accept-Encoding: gzip. Huge wire-size reduction on JSON payloads that embed
# base64 image data (discover, matches, /me, etc.).
app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=6)


@app.middleware("http")
async def security_headers(request, call_next):
    """
    Adds baseline security response headers on every request:
    - nosniff: stop MIME sniffing that enables XSS via bad Content-Type
    - frame-deny: stops clickjacking embedding
    - referrer-policy: limits leakage to external sites
    - permissions-policy: disables unused device APIs by default
    Left CSP intentionally loose for now (CRA + data: photos) — hardening
    later via report-only first.
    """
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "geolocation=(self), camera=(self), microphone=(self), payment=(), usb=()",
    )
    return response
# NOTE: Couple invite/accept/decline/revoke/unlink/me + PATCH /me/persona-b
# have been moved to routers/couples.py (imported at bottom of this file).
# Helpers (_normalize_persona_b, _persona_b_public, _get_partner_user,
# _couple_people_for_chat, _couple_identity_ids) stay here for now.


