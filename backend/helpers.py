"""Misc helpers: geo distance, serialization, discovery filter build."""
from datetime import datetime, timezone
from math import radians, sin, cos, asin, sqrt
from typing import Any, Optional


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def haversine_km(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
    lng1, lat1, lng2, lat2 = map(radians, [lng1, lat1, lng2, lat2])
    dlng = lng2 - lng1
    dlat = lat2 - lat1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return 2 * 6371 * asin(sqrt(a))


def rounded_distance_km(km: float) -> int:
    """Round to 1km for <5km, 5km buckets for <50, 10km buckets above."""
    if km < 1:
        return 1
    if km < 5:
        return int(round(km))
    if km < 50:
        return int(round(km / 5) * 5)
    return int(round(km / 10) * 10)


def serialize_doc(doc: Any) -> Any:
    """Recursively convert datetimes to ISO and strip MongoDB _id."""
    if isinstance(doc, list):
        return [serialize_doc(x) for x in doc]
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            if k == "_id":
                continue
            out[k] = serialize_doc(v)
        return out
    if isinstance(doc, datetime):
        return doc.isoformat()
    return doc


def parse_dt(x: Any) -> Optional[datetime]:
    if isinstance(x, datetime):
        return x
    if isinstance(x, str):
        try:
            return datetime.fromisoformat(x.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def user_is_online(last_active: Any) -> bool:
    dt = parse_dt(last_active)
    if not dt:
        return False
    # consider online if active in last 5 minutes
    delta = (now_utc() - dt.astimezone(timezone.utc)).total_seconds()
    return delta <= 300


def public_user_from_doc(doc: dict, viewer_location: Optional[list] = None,
                         privacy: Optional[dict] = None) -> dict:
    photos = doc.get("photos", []) or []
    loc = doc.get("location") or {}
    distance_km = None
    if viewer_location and loc.get("coordinates"):
        try:
            lng1, lat1 = viewer_location
            lng2, lat2 = loc["coordinates"]
            distance_km = rounded_distance_km(haversine_km(lng1, lat1, lng2, lat2))
        except Exception:
            distance_km = None
    # online status respects privacy
    owner_privacy = doc.get("privacy", {}) or {}
    is_online = user_is_online(doc.get("last_active"))
    if not owner_privacy.get("show_online_status", True):
        is_online = False
    return {
        "id": doc["id"],
        "display_name": doc.get("display_name", ""),
        "age": doc.get("age", 0),
        "gender_identity": doc.get("gender_identity"),
        "pronouns": doc.get("pronouns"),
        "orientation": doc.get("orientation"),
        "bio": doc.get("bio"),
        "photos": photos,
        "verified": bool(doc.get("verified", False)),
        "distance_km": distance_km,
        "is_online": is_online,
        "relationship_types": doc.get("relationship_types", []),
        "seeking_roles": doc.get("seeking_roles", []),
        "kinks": doc.get("kinks", []),
        "role": doc.get("role", "user"),
    }
