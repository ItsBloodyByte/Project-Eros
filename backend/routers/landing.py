"""Public landing-page configuration + admin editor.

A guest hitting `/` should see a welcoming, admin-editable marketing page
(hero, sections, blog teaser, CTA buttons). Authenticated users skip this
entirely and land in /discover.

The config lives in `db.settings` under `key="landing_page"`. We seed a
sensible default on first read so the page is never blank.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException

from server import (
    api_router,
    db,
    now_utc,
    _require_user,
    _require_role,
    _audit,
    _blog_public,
)

logger = logging.getLogger("app.routers.landing")

LANDING_KEY = "landing_page"
DEFAULT_LANDING = {
    "hero": {
        "eyebrow": "Eros",
        "headline": "Verbinde dich mit Menschen, die dich wirklich sehen.",
        "subheadline": "Inklusiv, sicher und werbefrei. Eros ist die moderne Dating-Plattform für offene Köpfe.",
        "cta_primary": {"label": "Kostenlos starten", "href": "/auth/register"},
        "cta_secondary": {"label": "Anmelden", "href": "/auth/login"},
        "image_url": None,
    },
    "sections": [
        {
            "id": "values",
            "title": "Warum Eros?",
            "items": [
                {"icon": "Shield", "title": "Sicher",
                 "body": "Verifizierte Profile, NSFW-Schutz und transparente Moderation."},
                {"icon": "Users", "title": "Inklusiv",
                 "body": "Alle Geschlechtsidentitäten und Orientierungen sind willkommen."},
                {"icon": "Sparkles", "title": "Werbefrei",
                 "body": "Premium-Features ohne Tracking, ohne Pop-ups."},
            ],
        },
    ],
    "show_blog_teaser": True,
    "blog_teaser_count": 3,
    "footer_note": "© Eros. Alle Rechte vorbehalten.",
}


async def _load_landing_config() -> Dict[str, Any]:
    doc = await db.settings.find_one({"key": LANDING_KEY})
    if doc:
        cfg = {**DEFAULT_LANDING}
        for k, v in doc.items():
            if k not in {"_id", "key", "updated_at", "updated_by"}:
                cfg[k] = v
        return cfg
    return DEFAULT_LANDING


@api_router.get("/landing")
async def get_landing():
    """Public endpoint: returns the active landing config + optional blog teaser."""
    cfg = await _load_landing_config()
    out: Dict[str, Any] = {"landing": cfg}
    if cfg.get("show_blog_teaser", True):
        try:
            limit = max(1, min(8, int(cfg.get("blog_teaser_count") or 3)))
            posts = await db.blog_posts.find(
                {"status": "published"},
                {"_id": 0},
            ).sort("published_at", -1).limit(limit).to_list(length=limit)
            teaser: List[Dict[str, Any]] = []
            for p in posts:
                pub = _blog_public(p)
                pub.pop("content_html", None)  # never inline body in teaser
                teaser.append(pub)
            out["blog_teaser"] = teaser
        except Exception as ex:
            logger.warning("Landing blog teaser failed: %s", ex)
            out["blog_teaser"] = []
    return out


@api_router.put("/admin/landing")
async def update_landing(body: Dict[str, Any], user=Depends(_require_user)):
    """Admin (or content_reviewer) updates the landing-page config.

    Accepts a partial body — fields not supplied keep their current values.
    Validates that the hero block stays present and CTA hrefs are app-relative
    or http(s) URLs (no `javascript:` / `data:` payloads).
    """
    await _require_role(user, ["admin", "superadmin", "content_reviewer"])
    body = body or {}
    existing = await _load_landing_config()
    merged: Dict[str, Any] = {**existing}

    if "hero" in body and isinstance(body["hero"], dict):
        hero = {**(existing.get("hero") or {}), **body["hero"]}
        for key in ("cta_primary", "cta_secondary"):
            if key in hero and isinstance(hero[key], dict):
                href = (hero[key].get("href") or "").strip()
                if href and not (href.startswith("/") or href.startswith("http://") or href.startswith("https://")):
                    raise HTTPException(400, f"hero.{key}.href muss relativ oder http(s) sein")
        if not (hero.get("headline") or "").strip():
            raise HTTPException(400, "hero.headline darf nicht leer sein")
        merged["hero"] = hero
    if "sections" in body and isinstance(body["sections"], list):
        # Light validation: each section must have title + items list.
        cleaned: List[Dict] = []
        for s in body["sections"][:8]:  # cap to 8 sections
            if not isinstance(s, dict):
                continue
            title = (s.get("title") or "").strip()[:120]
            if not title:
                continue
            items = []
            for it in (s.get("items") or [])[:8]:
                if isinstance(it, dict):
                    items.append({
                        "icon": str(it.get("icon") or "")[:30],
                        "title": str(it.get("title") or "")[:80],
                        "body": str(it.get("body") or "")[:300],
                    })
            cleaned.append({
                "id": str(s.get("id") or "")[:30] or f"sec{len(cleaned)+1}",
                "title": title,
                "items": items,
            })
        merged["sections"] = cleaned
    for scalar in ("show_blog_teaser", "blog_teaser_count", "footer_note"):
        if scalar in body:
            merged[scalar] = body[scalar]

    await db.settings.update_one(
        {"key": LANDING_KEY},
        {"$set": {**merged, "key": LANDING_KEY,
                   "updated_at": now_utc().isoformat(),
                   "updated_by": user["id"]}},
        upsert=True,
    )
    await _audit(user["id"], "landing_update", LANDING_KEY,
                 {"sections": len(merged.get("sections") or []),
                  "show_blog_teaser": merged.get("show_blog_teaser")})
    return {"ok": True, "landing": merged}
