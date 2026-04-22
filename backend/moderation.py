"""AI image moderation via Gemini Vision (Emergent LLM key)."""
import json
import logging
import os
import re
from typing import Optional, Tuple

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

logger = logging.getLogger(__name__)

LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

SYSTEM_PROMPT = (
    "You are an image moderation classifier for a dating platform. "
    "Given a single image, respond with STRICT JSON and no prose: "
    '{"nsfw_score": <float 0..1>, "has_face": <bool>, '
    '"category": "face" | "individual" | "nsfw", '
    '"labels": [<short strings>]}. '
    "Use 'face' when a clear human face is the dominant subject; "
    "'individual' when a person or object is visible but face is not dominant; "
    "'nsfw' when sexual/explicit content is present. "
    "nsfw_score 0.0 = fully safe, 1.0 = explicit. "
    "has_face = true only if a recognizable face is visible."
)


def _parse_json(text: str) -> dict:
    s = text.strip()
    s = re.sub(r"^```(?:json)?", "", s).strip()
    s = re.sub(r"```$", "", s).strip()
    m = re.search(r"\{.*\}", s, re.DOTALL)
    if not m:
        raise ValueError(f"No JSON found in moderation output: {text[:200]}")
    return json.loads(m.group(0))


def extract_base64_from_data_url(data_url: str) -> Tuple[str, Optional[str]]:
    """Return (b64, mime). Accepts either raw b64 or data URL."""
    if data_url.startswith("data:"):
        try:
            header, b64 = data_url.split(",", 1)
            mime = header.split(";")[0].replace("data:", "")
            return b64, mime
        except ValueError:
            return data_url, None
    return data_url, None


async def moderate_image(data_url: str, session_tag: str = "moderation") -> dict:
    """Return {nsfw_score, has_face, category, labels}. Safe fallback on error."""
    if not LLM_KEY:
        logger.warning("EMERGENT_LLM_KEY missing; skipping moderation.")
        return {"nsfw_score": 0.0, "has_face": False, "category": "individual", "labels": []}
    b64, _mime = extract_base64_from_data_url(data_url)
    try:
        chat = LlmChat(
            api_key=LLM_KEY,
            session_id=session_tag,
            system_message=SYSTEM_PROMPT,
        ).with_model("gemini", "gemini-2.5-flash")
        msg = UserMessage(
            text="Classify this image. Respond ONLY with JSON matching the schema.",
            file_contents=[ImageContent(image_base64=b64)],
        )
        resp = await chat.send_message(msg)
        parsed = _parse_json(resp)
        score = float(parsed.get("nsfw_score", 0.0))
        score = max(0.0, min(1.0, score))
        has_face = bool(parsed.get("has_face", False))
        category = parsed.get("category", "individual")
        if category not in {"face", "individual", "nsfw"}:
            category = "individual"
        labels = parsed.get("labels", []) or []
        if not isinstance(labels, list):
            labels = []
        return {
            "nsfw_score": score,
            "has_face": has_face,
            "category": category,
            "labels": [str(x)[:40] for x in labels][:10],
        }
    except Exception as e:
        logger.exception("moderate_image failed: %s", e)
        return {"nsfw_score": 0.0, "has_face": False, "category": "individual", "labels": []}
