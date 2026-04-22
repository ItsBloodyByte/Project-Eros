"""Seed demo users for end-to-end testing.

Creates:
  - admin@eros.app (role=admin)
  - alice@eros.app (woman 28 seeks man 30-40)
  - werner@eros.app (man 35 seeks woman 25-32) -> mutual with Alice
  - bob@eros.app (man 45 seeks woman 18-30) -> NOT mutual with Alice
  - sam@eros.app (nonbinary 26 seeks nonbinary 24-35)

All share password: Passw0rd!2025
All placed in Berlin area for geo matching.
"""
import sys
import asyncio
import base64
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).parent / "backend"
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from auth import hash_password  # noqa: E402
from helpers import now_utc  # noqa: E402
from moderation import moderate_image  # noqa: E402

MONGO_URL = os.environ["MONGO_URL"]
DB = os.environ["DB_NAME"]

DEMO = [
    {
        "email": "admin@eros.app", "display_name": "Admin", "age": 30,
        "role": "admin", "gender_identity": "nonbinary", "pronouns": "they/them",
        "orientation": "queer",
        "seeking_genders": ["woman", "man", "nonbinary"],
        "age_min": 18, "age_max": 99,
        "coords": [13.405, 52.520],
        "photo_url": "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=640&q=80",
    },
    {
        "email": "alice@eros.app", "display_name": "Alice", "age": 28,
        "role": "user", "gender_identity": "woman", "pronouns": "she/her",
        "orientation": "bisexual",
        "seeking_genders": ["man", "woman"],
        "age_min": 30, "age_max": 40,
        "relationship_types": ["serious", "casual"],
        "coords": [13.405, 52.520],
        "photo_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=640&q=80",
        "bio": "Art historian, slow mornings, loud laugh.",
    },
    {
        "email": "werner@eros.app", "display_name": "Werner", "age": 35,
        "role": "user", "gender_identity": "man", "pronouns": "he/him",
        "orientation": "straight",
        "seeking_genders": ["woman"],
        "age_min": 25, "age_max": 32,
        "relationship_types": ["serious"],
        "coords": [13.410, 52.525],
        "photo_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=640&q=80",
        "bio": "Architect. Bikes. Books. Real coffee.",
    },
    {
        "email": "bob@eros.app", "display_name": "Bob", "age": 45,
        "role": "user", "gender_identity": "man", "pronouns": "he/him",
        "orientation": "straight",
        "seeking_genders": ["woman"],
        "age_min": 18, "age_max": 30,  # Bob wants Alice but Alice wants 30-40 -> Bob 45 out
        "relationship_types": ["casual"],
        "coords": [13.420, 52.530],
        "photo_url": "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=640&q=80",
        "bio": "Chef, night-owl.",
    },
    {
        "email": "sam@eros.app", "display_name": "Sam", "age": 26,
        "role": "user", "gender_identity": "nonbinary", "pronouns": "they/them",
        "orientation": "pansexual",
        "seeking_genders": ["nonbinary", "woman", "man"],
        "age_min": 24, "age_max": 35,
        "relationship_types": ["friendship", "open"],
        "coords": [13.400, 52.515],
        "photo_url": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=640&q=80",
        "bio": "Composer. Rollerblades. Vintage synths.",
    },
]


async def fetch_data_url(url: str) -> str:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(url)
        r.raise_for_status()
        b64 = base64.b64encode(r.content).decode()
        return f"data:image/jpeg;base64,{b64}"


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB]
    pw_hash = hash_password("Passw0rd!2025")

    import uuid as _u
    for spec in DEMO:
        existing = await db.users.find_one({"email": spec["email"]})
        if existing:
            print(f"Skip (exists): {spec['email']}")
            continue
        user_id = str(_u.uuid4())
        photo_data_url = await fetch_data_url(spec["photo_url"])
        mod = await moderate_image(photo_data_url, session_tag=f"seed-{spec['email']}")
        photo = {
            "id": str(_u.uuid4()),
            "data": photo_data_url,
            "nsfw_score": mod["nsfw_score"],
            "has_face": mod["has_face"],
            "category": mod["category"],
            "labels": mod["labels"],
            "is_primary": True,
            "created_at": now_utc().isoformat(),
        }
        doc = {
            "id": user_id,
            "email": spec["email"],
            "password_hash": pw_hash,
            "display_name": spec["display_name"],
            "age": spec["age"],
            "gender_identity": spec["gender_identity"],
            "pronouns": spec["pronouns"],
            "orientation": spec["orientation"],
            "bio": spec.get("bio", ""),
            "location": {"type": "Point", "coordinates": spec["coords"]},
            "photos": [photo],
            "preferences": {
                "age_min": spec["age_min"], "age_max": spec["age_max"],
                "seeking_genders": spec["seeking_genders"],
                "radius_km": 50,
                "relationship_types": spec.get("relationship_types", []),
                "seeking_roles": [], "kinks": [],
                "only_with_photos": True, "only_face_photo": False,
                "only_verified": False, "hide_seen": True, "online_only": False,
            },
            "privacy": {
                "read_receipts": True, "show_online_status": True, "show_typing": True,
                "hidden_mode": False, "screenshot_notifications": True,
            },
            "relationship_types": spec.get("relationship_types", []),
            "seeking_roles": [],
            "kinks": [],
            "verified": spec["role"] != "user",
            "banned": False,
            "role": spec["role"],
            "consents": {"terms": True, "privacy": True, "sensitive_data": True,
                          "nsfw_view": True, "accepted_at": now_utc().isoformat(), "version": 1},
            "seen_user_ids": [],
            "created_at": now_utc().isoformat(),
            "last_active": now_utc().isoformat(),
        }
        await db.users.insert_one(doc)
        print(f"Created: {spec['email']}  (photo face={photo['has_face']} nsfw={photo['nsfw_score']:.2f})")

    client.close()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
