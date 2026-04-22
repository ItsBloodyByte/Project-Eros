"""
Seed 30 additional diverse user accounts for development/demo.

Run:  python -m seed_extra_users    (from /app/backend)
      python seed_extra_users.py
"""
from __future__ import annotations

import asyncio
import os
import random
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from auth import hash_password

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

# --- Seed definitions ---
FIRST_NAMES = [
    "Mia", "Lena", "Sarah", "Julia", "Anna", "Lea", "Emma", "Hannah", "Leonie", "Sophie",
    "Max", "Lukas", "Leon", "Finn", "Elias", "Paul", "Noah", "Jonas", "David", "Tim",
    "Sam", "Robin", "Alex", "Kim", "Jamie", "Ari", "Charlie", "Morgan", "Taylor", "Casey",
]
CITIES = [
    ("Berlin", 13.4050, 52.5200),
    ("Hamburg", 9.9937, 53.5511),
    ("München", 11.5820, 48.1351),
    ("Köln", 6.9603, 50.9375),
    ("Frankfurt", 8.6821, 50.1109),
    ("Stuttgart", 9.1829, 48.7758),
    ("Leipzig", 12.3731, 51.3397),
    ("Dresden", 13.7373, 51.0504),
    ("Nürnberg", 11.0767, 49.4521),
    ("Düsseldorf", 6.7735, 51.2277),
]
GENDERS_F = ["woman", "nonbinary", "trans_woman"]
GENDERS_M = ["man", "nonbinary", "trans_man"]
GENDERS_OTHER = ["genderqueer", "agender", "other"]
ORIENTATIONS = ["straight", "gay", "lesbian", "bisexual", "pansexual", "queer", "questioning"]
BODY_TYPES = ["slim", "athletic", "average", "curvy", "muscular", "bear", "cub"]
RELS = ["casual", "serious", "friendship", "open", "undecided"]
KINKS = ["dom", "sub", "switch", "sensual", "experimental", "soft", "playful", "exhibitionist"]
INTERESTS = ["art", "music", "hiking", "gaming", "yoga", "cooking", "photography", "reading", "travel", "film", "startups", "gardening", "cycling"]
LANGUAGES = ["de", "en", "fr", "es", "it", "pt", "nl", "pl", "tr"]
SMOKING = ["never", "sometimes", "often", "prefer_not_say"]
DRINKING = ["never", "sometimes", "often", "prefer_not_say"]
DIETS = ["omnivore", "vegetarian", "vegan", "pescetarian", "other"]
STI = ["negative", "positive_undetectable", "prefer_not_say", "on_prep"]

BIOS = [
    "Offen, ehrlich und neugierig. Ich mag echte Gespräche.",
    "Reisen, Kaffee, Bücher — meistens in dieser Reihenfolge.",
    "Auf der Suche nach Menschen, die wissen, was sie wollen.",
    "Musik, lange Nächte und spontane Abenteuer.",
    "Ich lebe bewusst, genieße aber auch gerne.",
    "Kuscheln ja, Drama nein.",
    "Work hard, play harder. Aber immer mit Respekt.",
    "Kreativ, selbstbewusst und nie langweilig.",
    "Ich suche Tiefe, keine Spielchen.",
    "Kaffee, Kunst und gute Laune.",
]

DOB_RANGE_DAYS = (19*365, 48*365)  # 19–48 years old


def pick_photos(gender: str) -> list[dict]:
    """Attach seed photos. We reuse public Unsplash URLs via data: scheme is not possible here,
    so we simulate with plain https URLs (frontend handles both)."""
    male_pics = [
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
        "https://images.unsplash.com/photo-1511367461989-f85a21fda167",
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d",
    ]
    female_pics = [
        "https://images.unsplash.com/photo-1494790108755-2616b612b786",
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80",
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
        "https://images.unsplash.com/photo-1517841905240-472988babdf9",
        "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f",
    ]
    nb_pics = [
        "https://images.unsplash.com/photo-1531123897727-8f129e1688ce",
        "https://images.unsplash.com/photo-1557555187-23d685287bc3",
    ]
    pool = male_pics if gender in {"man", "trans_man"} else female_pics if gender in {"woman", "trans_woman"} else nb_pics
    url = random.choice(pool) + "?w=800&q=80&auto=format&fit=crop"
    return [{
        "id": str(uuid.uuid4()),
        "data": url,
        "nsfw_score": round(random.uniform(0.02, 0.18), 2),
        "has_face": True,
        "category": "face",
        "is_primary": True,
    }]


def build_user(i: int) -> dict:
    first = FIRST_NAMES[i % len(FIRST_NAMES)]
    suffix = random.choice(["", "_", ".s", "."+str(random.randint(10,99))])
    name = f"{first}{suffix}".replace(".s", "S")
    email = f"seed.{first.lower()}.{i}@eros.app"
    gender_bucket = random.choice([GENDERS_F, GENDERS_M, GENDERS_OTHER])
    gender = random.choice(gender_bucket)
    orient = random.choice(ORIENTATIONS)
    city, lng, lat = random.choice(CITIES)
    # Small random jitter so markers aren't stacked.
    lng += random.uniform(-0.08, 0.08)
    lat += random.uniform(-0.06, 0.06)
    days_old = random.randint(*DOB_RANGE_DAYS)
    birth = datetime.now(timezone.utc) - timedelta(days=days_old)
    age = int(days_old / 365)
    is_premium = random.random() < 0.25
    premium_exp = (datetime.now(timezone.utc) + timedelta(days=random.randint(7, 90))).isoformat() if is_premium else None

    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password("Seed123!"),
        "display_name": name,
        "age": age,
        "birth_date": birth.date().isoformat(),
        "gender_identity": gender,
        "pronouns": random.choice(["she/her", "he/him", "they/them", None]),
        "orientation": orient,
        "bio": random.choice(BIOS),
        "location": {"type": "Point", "coordinates": [round(lng, 5), round(lat, 5)], "city": city},
        "photos": pick_photos(gender),
        "preferences": {
            "age_min": max(18, age - 10),
            "age_max": age + 12,
            "seeking_genders": random.sample([g for bucket in (GENDERS_F, GENDERS_M, GENDERS_OTHER) for g in bucket], k=random.randint(1, 3)),
            "radius_km": random.choice([10, 25, 50, 75, 100]),
            "relationship_types": random.sample(RELS, k=random.randint(1, 2)),
            "seeking_roles": [],
            "kinks": random.sample(KINKS, k=random.randint(0, 3)),
            "only_with_photos": True,
            "only_face_photo": random.random() < 0.3,
            "only_verified": random.random() < 0.15,
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
        "relationship_types": random.sample(RELS, k=random.randint(1, 2)),
        "seeking_roles": [],
        "kinks": random.sample(KINKS, k=random.randint(0, 3)),
        "interests": random.sample(INTERESTS, k=random.randint(2, 5)),
        "languages": random.sample(LANGUAGES, k=random.randint(1, 3)),
        "height_cm": random.randint(155, 195),
        "body_type": random.choice(BODY_TYPES),
        "smoking": random.choice(SMOKING),
        "drinking": random.choice(DRINKING),
        "diet": random.choice(DIETS),
        "sti_status": random.choice(STI),
        "verified": random.random() < 0.5,
        "id_verified": random.random() < 0.35,
        "email_verified": True,
        "banned": False,
        "role": "user",
        "is_premium": is_premium,
        "premium_expires_at": premium_exp,
        "consents": {
            "terms": True, "privacy": True, "sensitive_data": True, "nsfw_view": random.random() < 0.4,
            "accepted_at": datetime.now(timezone.utc).isoformat(), "version": 1,
        },
        "seen_user_ids": [],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 120))).isoformat(),
        "last_active": (datetime.now(timezone.utc) - timedelta(minutes=random.randint(1, 60 * 24 * 7))).isoformat(),
    }
    # woman-specific / man-specific metrics
    if gender in {"woman", "trans_woman"}:
        doc["cup_size"] = random.choice(["A", "B", "C", "D", "DD"])
    if gender in {"man", "trans_man"}:
        doc["penis_length_cm"] = random.choice([12, 14, 15, 17, 19])
        doc["penis_girth_cm"] = random.choice([10, 11, 12, 13])
    return doc


async def main():
    created = 0
    updated = 0
    random.seed(42)
    for i in range(30):
        u = build_user(i)
        exists = await db.users.find_one({"email": u["email"]}, {"id": 1})
        if exists:
            u["id"] = exists["id"]
            await db.users.update_one({"id": exists["id"]}, {"$set": u})
            updated += 1
        else:
            await db.users.insert_one(u)
            created += 1
    print(f"Seed extra: created={created}, updated={updated}")


if __name__ == "__main__":
    asyncio.run(main())
