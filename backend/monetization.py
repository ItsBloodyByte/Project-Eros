"""Monetization constants — single source of truth for Phase 15 rework.

These values are derived directly from Kapitel 15 of the product concept and
are intentionally stored in code (not in Mongo `settings`) so a product
manager cannot quietly relax them at runtime. Any change requires a code
review and a deploy — that is the "anti-dark-pattern" guarantee.

User-decision overrides (logged in plan.md, Phase 15):
  - Filter (advanced filters such as kinks, orientation, language, position)
    are FREE for everyone. Do NOT add them to PREMIUM_FEATURES_GATED.
  - Student verification stays manual via admin (no SheerID integration).
"""

from typing import Final


# ---------------------------------------------------------------------------
# Free / Premium limits
# ---------------------------------------------------------------------------
# Kapitel 15.1 — Tier-Übersicht. The free tier is intentionally generous;
# limits exist for technical reasons (storage, abuse) not for monetization.

FREE_LIMITS: Final[dict] = {
    "photos": 8,
    "albums": 2,
    "media_per_album": 20,
    "search_radius_km": 50,
    "monthly_album_unlock_requests": 5,
    "monthly_boosts": 1,            # via Sparks; not free
    "stats_history_days": 7,
}

PREMIUM_LIMITS: Final[dict] = {
    "photos": 30,
    "albums": 15,
    "media_per_album": 100,
    "search_radius_km": 300,
    "monthly_album_unlock_requests": None,    # unlimited
    "monthly_boosts": 3,            # included with Premium
    "stats_history_days": 90,
    "travel_mode": True,            # global radius for trips
}


def limits_for(is_premium: bool) -> dict:
    """Return the active limit table for an entitlement state."""
    return PREMIUM_LIMITS if is_premium else FREE_LIMITS


# ---------------------------------------------------------------------------
# Sparks — Belohnungswährung (Kapitel 15.3)
# ---------------------------------------------------------------------------
# Earning rates. Each entry is also the canonical `transaction_type` value
# stored in the sparks_ledger so a single string identifies both reason and
# amount. Negative values are forbidden here — that's the spend table below.

SPARKS_EARN: Final[dict] = {
    "daily_login": 2,                      # idempotent per UTC day
    "profile_complete": 20,                # one-time
    "verify_email": 10,                    # one-time
    "verify_phone": 15,                    # one-time
    "first_match": 10,                     # one-time
    "streak_7": 15,                        # weekly
    "streak_30": 50,                       # monthly
    "report_confirmed": 5,                 # per moderated report
    "profile_quiz": 10,                    # one-time
    "premium_monthly_bonus": 50,           # while subscription active
}

# Spending costs. Single source of truth so the UI never quotes a different
# number than the server enforces.
SPARKS_SPEND: Final[dict] = {
    "boost_1h": 30,
    "very_interested_signal": 10,
    "profile_rewind": 5,
    "extra_unlock_request": 8,
    "ai_chat_starter": 3,
    "profile_highlight_24h": 15,
    "gift_premium_week": 80,
}

# Top-up packages (Stripe). Bonus is awarded as a separate ledger entry so
# every effective top-up appears as two lines: `purchased` + `purchase_bonus`.
SPARKS_PACKAGES: Final[list[dict]] = [
    {"id": "sparks_50",   "sparks": 50,   "bonus": 0,   "price_eur_cents":  299},
    {"id": "sparks_150",  "sparks": 150,  "bonus": 15,  "price_eur_cents":  699},
    {"id": "sparks_400",  "sparks": 400,  "bonus": 50,  "price_eur_cents": 1499},
    {"id": "sparks_1000", "sparks": 1000, "bonus": 200, "price_eur_cents": 2999},
]


# ---------------------------------------------------------------------------
# Subscription billing
# ---------------------------------------------------------------------------
# Prices in EUR cents to avoid floating-point pricing errors.

BILLING_CYCLES: Final[dict] = {
    "monthly": {
        "label": "Monatlich",
        "duration_days": 30,
        "price_eur_cents": 999,
        "savings_pct": 0,
    },
    "biannual": {
        "label": "Halbjährlich",
        "duration_days": 182,
        "price_eur_cents": 4794,
        "monthly_eur_cents": 799,
        "savings_pct": 20,
    },
    "annual": {
        "label": "Jährlich",
        "duration_days": 365,
        "price_eur_cents": 7188,
        "monthly_eur_cents": 599,
        "savings_pct": 40,
    },
    "student": {
        "label": "Studenten (jährlich)",
        "duration_days": 365,
        "price_eur_cents": 4788,
        "monthly_eur_cents": 399,
        "savings_pct": 60,
        "requires_verification": True,
    },
    "duo": {
        "label": "Duo (2 Accounts)",
        "duration_days": 30,
        "price_eur_cents": 799,    # per Account-Paar / Monat (gemeinsam)
        "savings_pct": 20,
        "covers_accounts": 2,
    },
    "gift": {
        "label": "Geschenk (1 Monat)",
        "duration_days": 30,
        "price_eur_cents": 1199,
        "savings_pct": 0,
        "is_gift": True,
    },
}

PAUSE_MAX_DAYS: Final[int] = 90       # 3 Monate
RENEWAL_REMINDER_DAYS: Final[int] = 7
PRICE_GUARANTEE_DAYS: Final[int] = 365


# ---------------------------------------------------------------------------
# Galerie-Algorithmus (Kapitel 15.6)
# ---------------------------------------------------------------------------
# Documented weights so /transparent can quote them verbatim and the gallery
# implementation can reference one canonical block.
GALLERY_WEIGHTS: Final[dict] = {
    "geo_distance": 0.35,
    "activity_24h": 0.25,
    "profile_completeness": 0.20,
    "active_boost": 0.15,
    "new_user_7d": 0.05,
}

BOOST_DURATION_MINUTES: Final[int] = 60


# ---------------------------------------------------------------------------
# Anti-Dark-Pattern Locks (Kapitel 15.4)
# ---------------------------------------------------------------------------
# These are constants instead of Mongo settings on purpose. They cannot be
# disabled at runtime by an admin or PM — only by a code change.

ANTI_DARK_PATTERN: Final[dict] = {
    "forbid_like_bait_notifications": True,    # only notify on real matches
    "require_real_expiry_for_timers": True,    # UI countdowns need a true expires_at
    "max_clicks_to_cancel_subscription": 2,
    "uniform_pricing_across_platforms": True,
    "cancel_keeps_features_until_period_end": True,
    "max_premium_upsell_notifications_per_30d": 1,
    "ab_test_paywall_aggression_disclosure": True,
}
