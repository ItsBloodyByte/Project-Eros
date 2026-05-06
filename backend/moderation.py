"""AI image moderation — provider-agnostic, optionally fully disabled.

Old behaviour (one fixed provider, one static env var) blocked admins from
either turning moderation off or pointing it at a different vision LLM. Both
are explicit product requirements (Feature #4, 2026-05).

Runtime model
=============
The active config is stored in MongoDB (`platform_settings.ai_moderation`)
with this shape::

    {
      "enabled": true,                # master switch — false ⇒ noop
      "provider": "gemini",           # gemini | openai | anthropic | noop
      "model": "gemini-2.5-flash",
      "mandatory_review": true,       # callers should still flag for human review
      "block_threshold": 0.92,        # NSFW score above which we hard-block
      "provider_keys": {
        "gemini":    {"api_key": "...", "model": "gemini-2.5-flash"},
        "openai":    {"api_key": "sk-...", "model": "gpt-4o-mini"},
        "anthropic": {"api_key": "sk-ant-...", "model": "claude-sonnet-4-5"}
      }
    }

The default config (created on first read) keeps the old Emergent LLM key
behaviour intact, so existing deployments do not change behaviour without an
admin opt-in.

To avoid hitting Mongo on every photo upload we cache the resolved config
in-process for `_CONFIG_TTL_SECONDS`. Admin updates invalidate the cache via
`invalidate_config_cache()` (called from the admin endpoint).
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Optional, Tuple

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

logger = logging.getLogger(__name__)

# Legacy fallback key — used when admin config selects provider "gemini"
# without an explicit api_key (preserves existing deployments).
LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

_CONFIG_TTL_SECONDS = 60
_config_cache: dict = {"loaded_at": 0.0, "config": None}

DEFAULT_CONFIG = {
    "enabled": True,
    "provider": "gemini",
    "model": "gemini-2.5-flash",
    "mandatory_review": True,
    "block_threshold": 0.92,
    "provider_keys": {
        "gemini": {"api_key": "", "model": "gemini-2.5-flash"},
        "openai": {"api_key": "", "model": "gpt-4o-mini"},
        "anthropic": {"api_key": "", "model": "claude-sonnet-4-5-20250929"},
    },
}

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

NOOP_RESULT = {
    "nsfw_score": 0.0,
    "has_face": False,
    "category": "individual",
    "labels": [],
    "provider": "noop",
}


def invalidate_config_cache() -> None:
    """Force the next moderate_image() call to re-read the admin config."""
    _config_cache["loaded_at"] = 0.0
    _config_cache["config"] = None


async def _load_runtime_config(db) -> dict:
    """Return the active AI moderation config, hydrating from defaults."""
    now = time.monotonic()
    cached = _config_cache.get("config")
    if cached is not None and (now - _config_cache.get("loaded_at", 0)) < _CONFIG_TTL_SECONDS:
        return cached
    cfg = dict(DEFAULT_CONFIG)
    try:
        # Source of truth: `db.settings` row with key="ai_moderation". Admin
        # endpoint writes the per-provider key block + master toggle here.
        doc = await db.settings.find_one({"key": "ai_moderation"})
        if doc:
            for k in ("enabled", "provider", "model", "mandatory_review",
                      "block_threshold", "provider_keys", "api_key", "base_url"):
                if k in doc and doc[k] is not None:
                    cfg[k] = doc[k]
            # Legacy: a single top-level api_key — promote into the active
            # provider's slot so callers don't need to special-case it.
            if doc.get("api_key") and isinstance(cfg.get("provider_keys"), dict):
                prov = cfg.get("provider", "gemini")
                cfg["provider_keys"].setdefault(prov, {})
                if not cfg["provider_keys"][prov].get("api_key"):
                    cfg["provider_keys"][prov]["api_key"] = doc["api_key"]
    except Exception as ex:
        logger.warning("AI config load failed, falling back to defaults: %s", ex)
    _config_cache["loaded_at"] = now
    _config_cache["config"] = cfg
    return cfg


def _parse_json(text: str) -> dict:
    s = text.strip()
    s = re.sub(r"^```(?:json)?", "", s).strip()
    s = re.sub(r"```$", "", s).strip()
    m = re.search(r"\{.*\}", s, re.DOTALL)
    if not m:
        raise ValueError(f"No JSON found in moderation output: {text[:200]}")
    return json.loads(m.group(0))


def extract_base64_from_data_url(data_url: str) -> Tuple[str, Optional[str]]:
    if data_url.startswith("data:"):
        try:
            header, b64 = data_url.split(",", 1)
            mime = header.split(";")[0].replace("data:", "")
            return b64, mime
        except ValueError:
            return data_url, None
    return data_url, None


async def _moderate_via_emergent(provider_id: str, model: str, b64: str,
                                  api_key: str, session_tag: str) -> dict:
    """Call any provider that's bridged through the Emergent integrations
    library (Gemini, OpenAI, Anthropic). The library normalises the response
    so we can use a single prompt.
    """
    chat = LlmChat(
        api_key=api_key,
        session_id=session_tag,
        system_message=SYSTEM_PROMPT,
    ).with_model(provider_id, model)
    msg = UserMessage(
        text="Classify this image. Respond ONLY with JSON matching the schema.",
        file_contents=[ImageContent(image_base64=b64)],
    )
    resp = await chat.send_message(msg)
    parsed = _parse_json(resp)
    score = max(0.0, min(1.0, float(parsed.get("nsfw_score", 0.0))))
    category = parsed.get("category", "individual")
    if category not in {"face", "individual", "nsfw"}:
        category = "individual"
    labels = parsed.get("labels") or []
    if not isinstance(labels, list):
        labels = []
    return {
        "nsfw_score": score,
        "has_face": bool(parsed.get("has_face", False)),
        "category": category,
        "labels": [str(x)[:40] for x in labels][:10],
        "provider": provider_id,
        "model": model,
    }


async def moderate_image(data_url: str, session_tag: str = "moderation",
                         db=None) -> dict:
    """Run image moderation respecting the runtime admin config.

    `db` is the Motor handle from server.py; passed by reference so this
    module stays free of import-time dependencies on FastAPI app state.
    """
    if db is None:
        # Late-import to avoid a hard cycle (server depends on moderation).
        try:
            from server import db as _server_db  # type: ignore
            db = _server_db
        except Exception:
            pass
    cfg = await _load_runtime_config(db) if db is not None else DEFAULT_CONFIG
    if not cfg.get("enabled"):
        return {**NOOP_RESULT, "provider": "noop", "reason": "disabled"}
    provider = (cfg.get("provider") or "noop").lower()
    if provider == "noop":
        return {**NOOP_RESULT, "provider": "noop"}
    keys_cfg = (cfg.get("provider_keys") or {}).get(provider) or {}
    model = keys_cfg.get("model") or cfg.get("model") or DEFAULT_CONFIG["model"]
    api_key = keys_cfg.get("api_key") or LLM_KEY
    if not api_key:
        logger.warning("Moderation provider=%s has no api_key configured; skipping.", provider)
        return {**NOOP_RESULT, "provider": "noop", "reason": "missing_key"}
    b64, _mime = extract_base64_from_data_url(data_url)
    try:
        return await _moderate_via_emergent(provider, model, b64, api_key, session_tag)
    except Exception as e:
        logger.exception("moderate_image failed (provider=%s): %s", provider, e)
        # Fail open by default — never block uploads because the AI is down.
        return {**NOOP_RESULT, "provider": provider, "reason": f"error:{str(e)[:80]}"}


async def should_flag_for_review(mod: dict, db=None) -> bool:
    """Decide whether an automated finding should reach the moderator queue.

    When `mandatory_review=False`, only the hardest-of-hard NSFW hits land in
    the queue (>= block_threshold), keeping the team mailbox empty for casual
    uploads. When True (default) we flag anything above 0.5.
    """
    if mod is None:
        return False
    if mod.get("blocked"):
        return True
    if db is not None:
        try:
            cfg = await _load_runtime_config(db)
        except Exception:
            cfg = DEFAULT_CONFIG
    else:
        cfg = DEFAULT_CONFIG
    score = float(mod.get("nsfw_score") or 0.0)
    if cfg.get("mandatory_review", True):
        return score >= 0.50
    return score >= float(cfg.get("block_threshold") or 0.92)
