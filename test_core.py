"""
POC Test: validates two core concerns for the dating app before building it out.
1. Gemini Vision image moderation (NSFW score + face detection) via Emergent LLM key.
2. Bidirectional filter MongoDB query logic (Alice-Werner principle).

Run: python /app/test_core.py
"""
import asyncio
import base64
import json
import os
import re
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).parent / "backend"
load_dotenv(ROOT / ".env")

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent  # noqa: E402

LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"] + "_poc"

# Two real test images (safe) to validate pipeline without policy-blocked content.
SAFE_PORTRAIT_URL = (
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=640&q=80"  # woman face
)
LANDSCAPE_URL = (
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=640&q=80"  # lake landscape
)


async def fetch_b64(url: str) -> str:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(url)
        r.raise_for_status()
        return base64.b64encode(r.content).decode("utf-8")


MODERATION_SYSTEM = (
    "You are an image moderation classifier for a dating platform. "
    "Given a single image, respond with STRICT JSON and no prose: "
    '{"nsfw_score": <float 0..1>, "has_face": <bool>, '
    '"category": "face" | "individual" | "nsfw", '
    '"labels": [<short strings>]}. '
    "Use 'face' when a clear human face is the dominant subject; "
    "'individual' when a person is visible but face is not dominant (or no face but human-focused); "
    "'nsfw' when sexual/explicit content is present. "
    "nsfw_score 0.0 = fully safe, 1.0 = explicit. has_face = true only if a recognizable face is visible."
)


def _parse_json(text: str) -> dict:
    # Strip code fences if present
    s = text.strip()
    s = re.sub(r"^```(?:json)?", "", s).strip()
    s = re.sub(r"```$", "", s).strip()
    # Extract first {...}
    m = re.search(r"\{.*\}", s, re.DOTALL)
    if not m:
        raise ValueError(f"No JSON in response: {text[:400]}")
    return json.loads(m.group(0))


async def moderate_image(label: str, b64: str) -> dict:
    chat = LlmChat(
        api_key=LLM_KEY,
        session_id=f"moderation-{label}",
        system_message=MODERATION_SYSTEM,
    ).with_model("gemini", "gemini-2.5-flash")
    msg = UserMessage(
        text="Classify this image. Respond ONLY with JSON matching the schema.",
        file_contents=[ImageContent(image_base64=b64)],
    )
    resp = await chat.send_message(msg)
    parsed = _parse_json(resp)
    # Normalize
    score = float(parsed.get("nsfw_score", 0.0))
    has_face = bool(parsed.get("has_face", False))
    category = parsed.get("category", "individual")
    if category not in {"face", "individual", "nsfw"}:
        category = "individual"
    return {"nsfw_score": score, "has_face": has_face, "category": category, "labels": parsed.get("labels", [])}


async def test_ai_moderation() -> bool:
    print("\n=== POC #1: Gemini Vision image moderation ===")
    safe_b64 = await fetch_b64(SAFE_PORTRAIT_URL)
    landscape_b64 = await fetch_b64(LANDSCAPE_URL)

    portrait_res = await moderate_image("portrait", safe_b64)
    landscape_res = await moderate_image("landscape", landscape_b64)

    print("Portrait result:", portrait_res)
    print("Landscape result:", landscape_res)

    ok_portrait = (
        portrait_res["has_face"] is True
        and portrait_res["nsfw_score"] < 0.5
        and portrait_res["category"] in {"face", "individual"}
    )
    ok_landscape = (
        landscape_res["has_face"] is False
        and landscape_res["nsfw_score"] < 0.3
    )
    if not ok_portrait:
        print("FAIL: portrait expected has_face=true, low nsfw.")
    if not ok_landscape:
        print("FAIL: landscape expected has_face=false, low nsfw.")
    ok = ok_portrait and ok_landscape
    print("AI moderation:", "PASS" if ok else "FAIL")
    return ok


async def test_bidirectional_filter() -> bool:
    print("\n=== POC #2: Bidirectional (Alice-Werner) filter in MongoDB ===")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.users.drop()

    # 3 users, all in Berlin near each other.
    users = [
        {
            "_id": "alice", "display_name": "Alice", "age": 28,
            "gender_identity": "woman",
            "seeking_genders": ["man"],
            "age_min": 30, "age_max": 40,
            "location": {"type": "Point", "coordinates": [13.4050, 52.5200]},
            "hidden": False, "has_photo": True, "has_face_photo": True, "verified": True,
        },
        {
            "_id": "werner", "display_name": "Werner", "age": 35,
            "gender_identity": "man",
            "seeking_genders": ["woman"],
            "age_min": 25, "age_max": 32,
            "location": {"type": "Point", "coordinates": [13.4100, 52.5250]},
            "hidden": False, "has_photo": True, "has_face_photo": True, "verified": False,
        },
        {
            "_id": "bob", "display_name": "Bob", "age": 45,
            "gender_identity": "man",
            "seeking_genders": ["woman"],
            "age_min": 18, "age_max": 30,  # Would want Alice…
            "location": {"type": "Point", "coordinates": [13.4200, 52.5300]},
            "hidden": False, "has_photo": True, "has_face_photo": False, "verified": False,
        },
    ]
    await db.users.insert_many(users)
    await db.users.create_index([("location", "2dsphere")])

    # From Alice's perspective, the filter must enforce bidirectionality:
    alice = await db.users.find_one({"_id": "alice"})
    query = {
        "_id": {"$ne": alice["_id"]},
        "hidden": False,
        # one-way: Alice's requirements
        "gender_identity": {"$in": alice["seeking_genders"]},
        "age": {"$gte": alice["age_min"], "$lte": alice["age_max"]},
        # bidirectional: their requirements about Alice
        "seeking_genders": alice["gender_identity"],
        "age_min": {"$lte": alice["age"]},
        "age_max": {"$gte": alice["age"]},
        # radius 5km
        "location": {
            "$near": {
                "$geometry": alice["location"],
                "$maxDistance": 5000,
            }
        },
    }
    results = await db.users.find(query, {"_id": 1, "display_name": 1}).to_list(10)
    print("Candidates for Alice:", results)

    ids = {r["_id"] for r in results}
    # Werner should match (Alice 28 ∈ [25..32], Werner 35 ∈ [30..40], genders mutual).
    # Bob should NOT match (Bob 45 > Alice.age_max 40).
    ok = ids == {"werner"}
    print("Bidirectional filter:", "PASS" if ok else f"FAIL (got {ids})")
    await db.users.drop()
    client.close()
    return ok


async def main() -> int:
    r1 = await test_ai_moderation()
    r2 = await test_bidirectional_filter()
    print("\n=== SUMMARY ===")
    print("AI moderation:", "PASS" if r1 else "FAIL")
    print("Bidirectional filter:", "PASS" if r2 else "FAIL")
    return 0 if (r1 and r2) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
