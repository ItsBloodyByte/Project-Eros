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
from helpers import now_utc, public_user_from_doc, rounded_distance_km, haversine_km, serialize_doc
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
        logger.info("Mongo indexes ensured.")
    except Exception as e:
        logger.exception("Index creation failed: %s", e)


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
        "gender_identity": None,
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
            "hide_seen": True,
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
    }


@api_router.patch("/me")
async def update_me(body: ProfileUpdate, user=Depends(_require_user)):
    update: Dict = {}
    for field in [
        "display_name", "age", "gender_identity", "pronouns", "orientation",
        "bio", "relationship_types", "seeking_roles", "kinks",
    ]:
        val = getattr(body, field)
        if val is not None:
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

    query: Dict = {
        "id": {"$ne": user["id"]},
        "banned": {"$ne": True},
        "privacy.hidden_mode": {"$ne": True},
        "age": {
            "$gte": prefs.get("age_min", 18),
            "$lte": prefs.get("age_max", 99),
        },
    }

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
        query["id"] = {"$ne": user["id"], "$nin": list(seen)}

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
    for d in docs:
        pub = public_user_from_doc(d, viewer_location=viewer_coords)
        pub["boosted"] = (d.get("boost_expires_at") or "") > now_iso
        pub["is_premium"] = (d.get("premium_expires_at") or "") > now_iso
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
    return {**pub, "i_liked": bool(my_like), "they_liked": bool(their_like), "match_id": match}


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
@api_router.post("/reports", response_model=ReportPublic)
async def create_report(body: ReportCreate, user=Depends(_require_user)):
    r = {
        "id": str(uuid.uuid4()),
        "reporter_id": user["id"],
        "target_type": body.target_type,
        "target_id": body.target_id,
        "reason": body.reason,
        "detail": body.detail,
        "status": "open",
        "created_at": now_utc().isoformat(),
    }
    await db.reports.insert_one(r)
    await _audit(user["id"], "report_created", r["id"], {"target": body.target_id})
    return ReportPublic(**{**r, "created_at": now_utc()})


@api_router.get("/admin/reports")
async def admin_list_reports(user=Depends(_require_user), status: Optional[str] = None):
    await _require_role(user, ["admin", "moderator", "superadmin"])
    q: Dict = {}
    if status:
        q["status"] = status
    cursor = db.reports.find(q).sort("created_at", -1)
    items = await cursor.to_list(length=500)
    return {"reports": serialize_doc(items)}


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
async def admin_list_users(user=Depends(_require_user), q: Optional[str] = None):
    await _require_role(user, ["admin", "moderator", "superadmin"])
    query: Dict = {}
    if q:
        query["$or"] = [{"email": {"$regex": q, "$options": "i"}},
                         {"display_name": {"$regex": q, "$options": "i"}}]
    cursor = db.users.find(query, {"password_hash": 0}).limit(200)
    items = await cursor.to_list(length=200)
    return {"users": serialize_doc(items)}


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


# ---------- Discover: boost-aware ordering ----------
# Patch the existing discover endpoint to prefer boosted profiles.


# ---------- Wire ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
