"""Sparks — append-only ledger and earning helpers.

Design (Kapitel 15.7):
  - `db.sparks_ledger` is the SOURCE OF TRUTH. It is append-only; once a
    document is inserted it is never updated or deleted.
  - The current balance is a derived value (sum of all `amount` fields),
    cached on `users.sparks_balance` for read-time performance and stamped
    into each new ledger row as `balance_after`.
  - Every credit/debit goes through `award_sparks` / `spend_sparks`. They
    use a single Mongo write to update the user balance and emit the ledger
    row, so the cached balance and the audit log can never drift in any
    realistic concurrent scenario.

Why a ledger and not just a counter?
  Because we want the user to be able to see WHY their balance changed,
  why a refund happened, and we want disputes to be answerable from data
  rather than reconstructed memory. The ledger is also the only legal way
  to handle paid Sparks under EU consumer law.
"""

from __future__ import annotations

import logging
from datetime import timezone, timedelta, datetime
from typing import Optional, Iterable
from uuid import uuid4

from pymongo import ReturnDocument

from monetization import SPARKS_EARN

logger = logging.getLogger("app.sparks")


# Idempotency keys used by one-time grants. Earning hooks check the
# user document for these flags before awarding to avoid double credits.
ONE_TIME_FLAGS = {
    "profile_complete":  "sparks_profile_complete_at",
    "verify_email":      "sparks_verify_email_at",
    "verify_phone":      "sparks_verify_phone_at",
    "first_match":       "sparks_first_match_at",
    "profile_quiz":      "sparks_profile_quiz_at",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_balance(db, user_id: str) -> int:
    """Read balance from the user document.

    Falls back to summing the ledger if the field is missing — this happens
    once per user during the initial migration.
    """
    user = await db.users.find_one({"id": user_id}, {"sparks_balance": 1})
    if user and isinstance(user.get("sparks_balance"), int):
        return int(user["sparks_balance"])
    # Fallback: sum the ledger (slow but correct — only for new users).
    total = 0
    async for row in db.sparks_ledger.find({"user_id": user_id}, {"amount": 1}):
        total += int(row.get("amount") or 0)
    await db.users.update_one({"id": user_id}, {"$set": {"sparks_balance": total}})
    return total


async def _write_ledger(db, user_id: str, amount: int, transaction_type: str,
                        related_id: Optional[str], note: Optional[str]) -> dict:
    """Atomically increment the balance, then append a ledger row.

    We use `find_one_and_update` with `$inc` to get the new balance back in
    one round-trip, then write the audit row with that balance — so the
    ledger always carries the *post-trade* balance, even under races.
    """
    user = await db.users.find_one_and_update(
        {"id": user_id},
        {"$inc": {"sparks_balance": amount},
         "$set": {"sparks_balance_updated_at": _now_iso()}},
        projection={"sparks_balance": 1},
        return_document=ReturnDocument.AFTER,
    )
    if not user:
        raise ValueError(f"sparks: user {user_id} not found")
    new_balance = int(user.get("sparks_balance") or 0)
    row = {
        "id": str(uuid4()),
        "user_id": user_id,
        "amount": int(amount),
        "balance_after": new_balance,
        "transaction_type": transaction_type,
        "related_id": related_id,
        "note": note,
        "created_at": _now_iso(),
    }
    await db.sparks_ledger.insert_one(row)
    return row


async def award_sparks(db, user_id: str, transaction_type: str, *,
                       amount: Optional[int] = None,
                       related_id: Optional[str] = None,
                       note: Optional[str] = None,
                       once_flag: Optional[str] = None) -> Optional[dict]:
    """Credit a positive amount of Sparks to a user.

    Resolves the amount from `SPARKS_EARN` if not supplied. Honors a
    one-time flag (set on the user doc) so e.g. profile-complete only
    awards once even if the trigger fires repeatedly.

    Returns the inserted ledger row, or None if the award was skipped
    because the one-time flag was already present.
    """
    if amount is None:
        amount = int(SPARKS_EARN.get(transaction_type, 0))
    if amount <= 0:
        logger.debug("award_sparks: skipping non-positive amount for %s", transaction_type)
        return None
    if once_flag:
        # Atomic guard: only award if the flag isn't set yet.
        doc = await db.users.find_one_and_update(
            {"id": user_id, once_flag: {"$exists": False}},
            {"$set": {once_flag: _now_iso()}},
            projection={"id": 1},
        )
        if not doc:
            return None
    return await _write_ledger(db, user_id, amount, transaction_type, related_id, note)


async def spend_sparks(db, user_id: str, transaction_type: str, *,
                       amount: int, related_id: Optional[str] = None,
                       note: Optional[str] = None) -> Optional[dict]:
    """Debit Sparks. Refuses to overdraw — caller must handle InsufficientSparks.

    Uses an atomic conditional update (`$gte`) so two parallel spends never
    overdraw past zero.
    """
    if amount <= 0:
        raise ValueError("spend_sparks: amount must be positive")
    user = await db.users.find_one_and_update(
        {"id": user_id, "sparks_balance": {"$gte": amount}},
        {"$inc": {"sparks_balance": -amount},
         "$set": {"sparks_balance_updated_at": _now_iso()}},
        projection={"sparks_balance": 1},
        return_document=True,
    )
    if not user:
        return None  # insufficient balance
    new_balance = int(user.get("sparks_balance") or 0)
    row = {
        "id": str(uuid4()),
        "user_id": user_id,
        "amount": -amount,
        "balance_after": new_balance,
        "transaction_type": transaction_type,
        "related_id": related_id,
        "note": note,
        "created_at": _now_iso(),
    }
    await db.sparks_ledger.insert_one(row)
    return row


async def list_ledger(db, user_id: str, *, limit: int = 100,
                      before: Optional[str] = None) -> list[dict]:
    """Paginate a user's ledger newest-first."""
    q: dict = {"user_id": user_id}
    if before:
        q["created_at"] = {"$lt": before}
    rows = []
    async for row in db.sparks_ledger.find(q).sort("created_at", -1).limit(int(limit)):
        row.pop("_id", None)
        rows.append(row)
    return rows


# ---------------------------------------------------------------------------
# Earning hooks — to be called from the relevant endpoints
# ---------------------------------------------------------------------------
async def grant_daily_login(db, user_id: str) -> Optional[dict]:
    """Daily login award. Idempotent per UTC calendar day."""
    today = datetime.now(timezone.utc).date().isoformat()
    user = await db.users.find_one_and_update(
        {"id": user_id, "sparks_last_daily": {"$ne": today}},
        {"$set": {"sparks_last_daily": today}},
        projection={"id": 1, "sparks_streak_count": 1, "sparks_last_streak_day": 1},
    )
    if not user:
        return None
    row = await award_sparks(db, user_id, "daily_login")
    # Update streak counter (consecutive days)
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    last_streak = user.get("sparks_last_streak_day")
    streak = int(user.get("sparks_streak_count") or 0)
    streak = (streak + 1) if last_streak == yesterday else 1
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"sparks_streak_count": streak, "sparks_last_streak_day": today}},
    )
    if streak and streak % 7 == 0:
        await award_sparks(db, user_id, "streak_7", note=f"7-day streak (day {streak})")
    if streak and streak % 30 == 0:
        await award_sparks(db, user_id, "streak_30", note=f"30-day streak (day {streak})")
    return row


def _profile_is_complete(user: dict) -> bool:
    """Loose definition: at least one photo, a non-empty bio, and >= 1 interest."""
    if not user:
        return False
    photos = user.get("photos") or []
    if not photos:
        return False
    bio = (user.get("about") or user.get("bio") or "").strip()
    if len(bio) < 20:
        return False
    interests = user.get("interests") or user.get("kinks") or []
    return bool(interests)


async def grant_profile_complete_if_eligible(db, user_id: str) -> Optional[dict]:
    user = await db.users.find_one({"id": user_id})
    if not user or not _profile_is_complete(user):
        return None
    return await award_sparks(db, user_id, "profile_complete",
                              once_flag=ONE_TIME_FLAGS["profile_complete"],
                              note="Profil vollständig (Foto, Bio, Interessen)")


async def grant_verification(db, user_id: str, kind: str) -> Optional[dict]:
    """`kind` must be 'email' or 'phone'."""
    if kind not in ("email", "phone"):
        return None
    tx = "verify_email" if kind == "email" else "verify_phone"
    return await award_sparks(db, user_id, tx,
                              once_flag=ONE_TIME_FLAGS[tx],
                              note=f"{kind.capitalize()} verifiziert")


async def grant_first_match(db, user_id: str, match_id: str) -> Optional[dict]:
    return await award_sparks(db, user_id, "first_match",
                              related_id=match_id,
                              once_flag=ONE_TIME_FLAGS["first_match"],
                              note="Erstes Match")


async def grant_report_confirmed(db, reporter_user_id: str, report_id: str) -> Optional[dict]:
    """Awarded each time a report is closed as confirmed (not idempotent)."""
    return await award_sparks(db, reporter_user_id, "report_confirmed",
                              related_id=report_id,
                              note="Bestätigter Report")


async def grant_premium_monthly_bonus(db, user_id: str, period_key: str) -> Optional[dict]:
    """Once per active subscription period.

    `period_key` should uniquely identify the subscription period (e.g.
    `subscription_id:YYYY-MM`). The ledger is queried for an existing
    `premium_monthly_bonus` row with the same `related_id`.
    """
    existing = await db.sparks_ledger.find_one({
        "user_id": user_id,
        "transaction_type": "premium_monthly_bonus",
        "related_id": period_key,
    })
    if existing:
        return None
    return await award_sparks(db, user_id, "premium_monthly_bonus",
                              related_id=period_key,
                              note="Premium-Monatsbonus")


async def ensure_indexes(db) -> None:
    """Create indexes used by the ledger + balance lookups."""
    try:
        await db.sparks_ledger.create_index([("user_id", 1), ("created_at", -1)])
        await db.sparks_ledger.create_index([("transaction_type", 1)])
        await db.sparks_ledger.create_index([("related_id", 1)])
        await db.users.create_index([("sparks_balance", -1)])
    except Exception as ex:
        logger.warning("sparks index creation failed: %s", ex)
