"""Honey-Pot subsystem.

A honey-pot profile is an internal trap account that real users must never see
or interact with. Bots and scrapers, however, will reach them via direct ID
references or by hammering /discover until they get a hit.

Core mechanics:
  1. **Filter**: every public listing (`/discover`, `/users/{id}`, `/visits`,
     match candidates, search) excludes profiles flagged `is_honeypot=True`
     unless the viewer is staff.
  2. **Trigger**: when a non-staff user performs an interaction targeting a
     honey-pot (like, message, visit, profile fetch via known-id) we
     immediately *shadow-ban* the actor and write a moderation flag with
     `kind="honeypot_trigger"`.
  3. **Shadow-ban**: the shadow-banned user keeps believing their actions
     work — likes, messages, visits all return success — but the system
     drops the side effects: no fan-out, no chat delivery, no presence
     leak. The flag is queued for human moderation review.

Public API surface (used by routers):

    is_honeypot(doc) -> bool
    is_shadow_banned(doc) -> bool
    is_staff(doc) -> bool
    visibility_filter_for(viewer) -> dict
        # MongoDB query fragment that hides honeypots & shadow-banned users
        # from this viewer (returns {} for staff and shadow-banned themselves).
    trigger_honeypot(viewer, target, action, meta=None) -> bool
        # If `target` is a honeypot AND `viewer` is not staff/honeypot, applies
        # a shadow ban and returns True. Otherwise returns False. Idempotent.

Implementation notes:
  - Helpers stay free of `app`/router state so they can be imported anywhere.
  - All DB writes go via `db` from server (passed in or imported lazily).
  - Audit + admin-broadcast are best-effort; failures must not break the
    user-visible action.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger("app.honeypot")

# Roles that bypass honey-pot filters and can interact with traps without
# tripping the shadow-ban (so moderators can review the trap profiles).
_STAFF_ROLES = {"admin", "superadmin", "moderator", "content_reviewer", "support"}


def is_honeypot(doc: Optional[Dict[str, Any]]) -> bool:
    return bool(doc and doc.get("is_honeypot"))


def is_shadow_banned(doc: Optional[Dict[str, Any]]) -> bool:
    return bool(doc and doc.get("shadow_banned"))


def is_staff(doc: Optional[Dict[str, Any]]) -> bool:
    return bool(doc and doc.get("role") in _STAFF_ROLES)


def visibility_filter_for(viewer: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Mongo query fragment that hides honeypots & shadow-banned users.

    Returns `{}` for staff (full visibility for moderation work) and for the
    shadow-banned user themselves (so their own profile pages still load —
    they should not "feel" the ban).

    Use:
        cursor = db.users.find({**base_query, **visibility_filter_for(user)})
    """
    if is_staff(viewer):
        return {}
    me_id = (viewer or {}).get("id")
    fragment: Dict[str, Any] = {"is_honeypot": {"$ne": True}}
    # A shadow-banned user shouldn't see *other* shadow-banned users either,
    # because it would let bots learn the ban ring. But they should still see
    # themselves.
    if me_id:
        fragment["$or"] = [
            {"shadow_banned": {"$ne": True}},
            {"id": me_id},
        ]
    else:
        fragment["shadow_banned"] = {"$ne": True}
    return fragment


async def trigger_honeypot(db, viewer: Dict[str, Any], target: Dict[str, Any],
                           action: str, meta: Optional[Dict[str, Any]] = None) -> bool:
    """Shadow-ban `viewer` if they just interacted with a honey-pot.

    Returns True when the trigger fired. Safe to call before or after the
    side-effecting action — the function is idempotent (already-banned users
    accumulate trigger entries instead of re-banning).
    """
    if not (viewer and target):
        return False
    if not is_honeypot(target):
        return False
    if is_staff(viewer) or is_honeypot(viewer):
        # Staff and honeypots themselves never trigger.
        return False
    if (viewer.get("id") == target.get("id")):
        return False  # paranoia
    now_iso = datetime.now(timezone.utc).isoformat()
    trigger_entry = {
        "honeypot_user_id": target.get("id"),
        "action": action,
        "at": now_iso,
        "meta": meta or {},
    }
    update: Dict[str, Any] = {
        "$set": {
            "shadow_banned": True,
            "shadow_banned_at": viewer.get("shadow_banned_at") or now_iso,
            "shadow_ban_reason": "honeypot_trigger",
        },
        "$push": {"shadow_ban_triggers": trigger_entry},
    }
    try:
        await db.users.update_one({"id": viewer["id"]}, update)
    except Exception as ex:
        logger.warning("Honeypot shadow-ban write failed for %s: %s", viewer.get("id"), ex)
        return False
    # Mutate in-memory so subsequent code in the same request sees the ban.
    viewer["shadow_banned"] = True
    viewer["shadow_ban_reason"] = "honeypot_trigger"
    triggers = list(viewer.get("shadow_ban_triggers") or [])
    triggers.append(trigger_entry)
    viewer["shadow_ban_triggers"] = triggers
    logger.info("Honeypot triggered: viewer=%s honeypot=%s action=%s",
                viewer.get("id"), target.get("id"), action)
    return True


async def record_honeypot_flag(db, viewer_id: str, honeypot_id: str,
                                action: str, meta: Optional[Dict] = None) -> None:
    """Insert a moderation flag so admins can triage the new shadow-ban.

    Stored in `moderation_flags` with kind=`honeypot_trigger`. Admins can
    approve (hard-ban) or dismiss (lift shadow-ban). Best-effort; never raises.
    """
    try:
        await db.moderation_flags.insert_one({
            "kind": "honeypot_trigger",
            "user_id": viewer_id,
            "honeypot_id": honeypot_id,
            "action": action,
            "meta": meta or {},
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as ex:
        logger.warning("Honeypot flag write failed: %s", ex)
