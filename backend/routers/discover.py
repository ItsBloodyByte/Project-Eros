"""The /discover endpoint: bidirectional matching + geospatial queries.
This is the single most performance-sensitive route in the backend.

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
    _get_platform_config,
    _is_user_premium,
    _require_user,
    api_router,
    db,
    now_utc,
    public_user_from_doc,
)

logger = logging.getLogger("app.routers.discover")


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


