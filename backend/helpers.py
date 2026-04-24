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


def _penis_category(cm):
    try:
        v = float(cm)
    except (TypeError, ValueError):
        return None
    if v <= 0:
        return None
    if v <= 12:
        return "S"
    if v <= 15:
        return "M"
    if v <= 18:
        return "L"
    if v <= 21:
        return "XL"
    return "XXL"


# --- Link detection (incl. obfuscated variants) ---
import re as _re  # noqa: E402

# TLDs of 3+ chars — safer to match without a dot (just whitespace).
_TLDS_LONG = (
    r"(?:com|net|org|app|info|xyz|top|icu|pro|dev|one|biz|shop|store|online|"
    r"site|tech|link|click|live|cloud|fun|host|party|stream|style|today|page|"
    r"web|news|blog|video|chat|porn|xxx|cam|tube|vip|bet|casino|download)"
)

# All TLDs including 2-char country codes. Only matched when a DOT is present.
_TLDS_ALL = (
    r"(?:com|net|org|de|at|ch|io|app|co|uk|eu|me|biz|tv|gg|shop|store|online|"
    r"site|tech|link|click|live|cloud|tk|ml|ga|cf|fr|es|it|nl|ru|us|ca|au|jp|"
    r"info|name|xyz|top|icu|pro|dev|one|page|web|news|blog|video|chat|porn|"
    r"xxx|cam|tube|vip|bet|casino|download|fun|host|party|stream|style|today)"
)

_DOT_WORDS = _re.compile(r"\s*(?:\(\s*dot\s*\)|\[\s*dot\s*\]|\{\s*dot\s*\}|·|•)\s*", _re.IGNORECASE)


def _normalize_for_link_check(text: str) -> str:
    if not text:
        return ""
    t = text.lower()
    t = _DOT_WORDS.sub(".", t)
    t = _re.sub(r"[ \t]+", " ", t)
    return t


# Dotted form (also tolerates whitespace around the dot). Accepts all TLDs.
_URL_DOTTED_RE = _re.compile(
    r"(?:(?:https?|ftp)\s*:\s*/\s*/\s*)?"
    r"(?:[a-z0-9\-]{2,}\s*\.\s*)+"
    rf"{_TLDS_ALL}(?=[^a-z0-9]|$)",
    _re.IGNORECASE,
)

# Space-only form (no dot) — stricter: requires a 3+char domain label AND a long TLD,
# so common German words ("es", "de", "me") don't trigger false positives.
_URL_SPACED_RE = _re.compile(
    r"(?<![a-z0-9])[a-z0-9\-]{3,}\s+"
    rf"{_TLDS_LONG}(?=[^a-z0-9]|$)",
    _re.IGNORECASE,
)

# Also catch bare email addresses (they imply a contact handoff).
_EMAIL_RE = _re.compile(r"[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}", _re.IGNORECASE)


def contains_link_like(text: str) -> bool:
    """Detect obvious + obfuscated URLs and emails in user text."""
    if not text:
        return False
    norm = _normalize_for_link_check(text)
    if _URL_DOTTED_RE.search(norm) or _URL_SPACED_RE.search(norm) or _EMAIL_RE.search(norm):
        return True
    # Aggressive second pass: remove single spaces between letters (e.g. "g o o g l e . c o m")
    aggressive = _re.sub(r"(?<=[a-z0-9])\s(?=[a-z0-9])", "", norm)
    if aggressive != norm:
        if _URL_DOTTED_RE.search(aggressive) or _EMAIL_RE.search(aggressive):
            return True
    return False


def compute_age(birth_date) -> Optional[int]:
    """Compute current age in years from ISO date string or datetime."""
    if not birth_date:
        return None
    if isinstance(birth_date, datetime):
        bd = birth_date.date()
    else:
        try:
            bd = datetime.strptime(str(birth_date)[:10], "%Y-%m-%d").date()
        except Exception:
            return None
    today = now_utc().date()
    years = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
    return max(0, years)


def is_gay_male_like(doc: Optional[dict]) -> bool:
    """True when a profile qualifies for the gay-male-role feature set.

    Rule (per product decision): gender_identity in {man, trans_man}
    AND orientation in {gay, bisexual, pansexual, queer, questioning}.
    Cis- and trans-male-identifying accounts qualify equally; explicit
    female / non-binary accounts are excluded from this very specific tag.
    """
    if not doc:
        return False
    g = doc.get("gender_identity")
    o = doc.get("orientation")
    return g in {"man", "trans_man"} and o in {"gay", "bisexual", "pansexual", "queer", "questioning"}


def public_user_from_doc(doc: dict, viewer_location: Optional[list] = None,
                         privacy: Optional[dict] = None,
                         list_mode: bool = False) -> dict:
    """
    Build the public user payload.

    When `list_mode=True`, only the primary photo (or the first photo) is
    returned. This keeps list responses like /discover and /matches small –
    each user document can carry up to 5 base64-encoded photos (~1–2 MB each)
    which bloats the wire size dramatically. Detail endpoints still call
    without `list_mode` and receive every photo.
    """
    photos = doc.get("photos", []) or []
    if list_mode and photos:
        primary = next((p for p in photos if p.get("is_primary")), None) or photos[0]
        photos = [primary]
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
    # Role badge: staff can hide their platform role from their public profile.
    role_value = doc.get("role", "user") or "user"
    if role_value != "user" and owner_privacy.get("role_badge_visible", True) is False:
        role_value = "user"
    penis_len = doc.get("penis_length_cm")
    # Prefer birth_date-derived age when available; fall back to stored `age`.
    derived_age = compute_age(doc.get("birth_date"))
    if derived_age is None:
        derived_age = doc.get("age", 0)
    return {
        "id": doc["id"],
        "display_name": doc.get("display_name", ""),
        "age": derived_age,
        "gender_identity": doc.get("gender_identity"),
        "pronouns": doc.get("pronouns"),
        "orientation": doc.get("orientation"),
        "bio": doc.get("bio"),
        "photos": photos,
        "verified": bool(doc.get("verified", False)),
        "id_verified": bool(doc.get("id_verified", False)),
        "distance_km": distance_km,
        "city": loc.get("city") if isinstance(loc, dict) else None,
        "is_online": is_online,
        "relationship_types": doc.get("relationship_types", []) or [],
        "seeking_roles": doc.get("seeking_roles", []) or [],
        "kinks": doc.get("kinks", []) or [],
        "role": role_value,
        # Phase 4 extended (always returned; frontend hides empties)
        "height_cm": doc.get("height_cm"),
        "body_type": doc.get("body_type"),
        "ethnicity": doc.get("ethnicity"),
        "languages": doc.get("languages", []) or [],
        "interests": doc.get("interests", []) or [],
        "smoking": doc.get("smoking"),
        "drinking": doc.get("drinking"),
        "diet": doc.get("diet"),
        "sti_status": doc.get("sti_status"),
        "sti_tested_on": doc.get("sti_tested_on"),
        "cup_size": doc.get("cup_size"),
        "penis_length_cm": penis_len,
        "penis_girth_cm": doc.get("penis_girth_cm"),
        "penis_category": _penis_category(penis_len),
        # Partner-profile identifiers (the actual partner record is attached separately)
        "account_type": doc.get("account_type") or "single",
        "couple_id": doc.get("couple_id"),
        "partner_user_id": doc.get("partner_user_id"),
        # Opt-out flag: when False, other users cannot send couple invites.
        # Surfaced publicly so profile pages can hide the "Als Partner verknüpfen" button.
        "allow_couple_invites": owner_privacy.get("allow_couple_invites", True),
        "persona_b": _persona_b_public(doc.get("persona_b"), list_mode=list_mode) if doc.get("account_type") == "duo" else None,
        "current_mood": doc.get("current_mood"),
        "relationship_status": doc.get("relationship_status"),
        # NSFW acceptance signal (True / False / None=no opinion). Always public.
        "accept_nsfw": doc.get("accept_nsfw"),
        # Gay-male role/position — only surfaced for qualifying accounts so we
        # don't inadvertently tag other identities with a gay-specific label.
        "gay_position": doc.get("gay_position") if is_gay_male_like(doc) else None,
    }


def _persona_b_public(p: Optional[dict], list_mode: bool = False) -> Optional[dict]:
    """Strip private fields of persona_b (single-account duo). Returns dict or None."""
    if not isinstance(p, dict):
        return None
    derived_age = compute_age(p.get("birth_date"))
    if derived_age is None:
        derived_age = p.get("age")
    penis_len = p.get("penis_length_cm")
    photos = p.get("photos") or []
    if list_mode and photos:
        primary = next((x for x in photos if x.get("is_primary")), None) or photos[0]
        photos = [primary]
    return {
        "display_name": p.get("display_name") or "",
        "age": derived_age,
        "gender_identity": p.get("gender_identity"),
        "pronouns": p.get("pronouns"),
        "orientation": p.get("orientation"),
        "bio": p.get("bio"),
        "photos": photos,
        "height_cm": p.get("height_cm"),
        "body_type": p.get("body_type"),
        "ethnicity": p.get("ethnicity"),
        "smoking": p.get("smoking"),
        "drinking": p.get("drinking"),
        "diet": p.get("diet"),
        "languages": p.get("languages") or [],
        "interests": p.get("interests") or [],
        "kinks": p.get("kinks") or [],
        "sti_status": p.get("sti_status"),
        "sti_tested_on": p.get("sti_tested_on"),
        "cup_size": p.get("cup_size"),
        "penis_length_cm": penis_len,
        "penis_girth_cm": p.get("penis_girth_cm"),
        "penis_category": _penis_category(penis_len),
    }
