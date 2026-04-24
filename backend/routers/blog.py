"""Blog routes (public list/detail/tags + admin CRUD).

All helpers (`_sanitize_blog_html`, `_slugify`, `_blog_reading_time`,
`_blog_public`) remain in `server.py` for now — we only move the route
handlers. This keeps the refactor low-risk and easy to reason about while
still shrinking the monolith.
"""

from typing import Dict, Optional
import uuid

from fastapi import Depends, HTTPException, Query

from server import (
    api_router,
    db,
    now_utc,
    _require_user,
    _optional_user,
    _require_role,
    _audit,
    _sanitize_blog_html,
    _slugify,
    _blog_reading_time,
    _blog_public,
    BLOG_ALLOWED_STATUSES,
)


@api_router.get("/blog/posts")
async def public_list_blog_posts(
    user=Depends(_optional_user),
    tag: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50),
    skip: int = Query(0, ge=0),
):
    """Public listing of published blog posts – accessible to guests."""
    q: Dict = {"status": "published"}
    if tag:
        q["tags"] = tag
    cursor = db.blog_posts.find(q).sort("published_at", -1).skip(skip).limit(limit)
    posts = await cursor.to_list(length=limit)
    author_ids = list({p.get("author_id") for p in posts if p.get("author_id")})
    authors: Dict[str, dict] = {}
    if author_ids:
        async for u in db.users.find({"id": {"$in": author_ids}}, {"id": 1, "display_name": 1, "role": 1}):
            authors[u["id"]] = u
    out = [_blog_public(p, authors.get(p.get("author_id"))) for p in posts]
    # Strip heavy HTML from list view
    for o in out:
        o.pop("content_html", None)
    total = await db.blog_posts.count_documents(q)
    return {"posts": out, "total": total, "has_more": (skip + len(out)) < total}


@api_router.get("/blog/tags")
async def blog_tags(user=Depends(_optional_user)):
    tags = await db.blog_posts.distinct("tags", {"status": "published"})
    return {"tags": sorted([t for t in tags if t])}


@api_router.get("/blog/posts/{slug}")
async def public_blog_post(slug: str, user=Depends(_optional_user)):
    doc = await db.blog_posts.find_one({"slug": slug})
    if not doc:
        raise HTTPException(404, "Post nicht gefunden")
    is_staff = bool(user) and user.get("role") in {"admin", "moderator", "superadmin", "content_reviewer", "support"}
    if doc.get("status") != "published" and not is_staff:
        raise HTTPException(404, "Post nicht gefunden")
    author = None
    if doc.get("author_id"):
        author = await db.users.find_one({"id": doc["author_id"]}, {"id": 1, "display_name": 1, "role": 1})
    return _blog_public(doc, author)


# ----- Admin / author endpoints -----
@api_router.get("/admin/blog/posts")
async def admin_list_blog_posts(
    user=Depends(_require_user),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    await _require_role(user, ["admin", "moderator", "superadmin", "content_reviewer"])
    q: Dict = {}
    if status_filter and status_filter in BLOG_ALLOWED_STATUSES:
        q["status"] = status_filter
    cursor = db.blog_posts.find(q).sort("updated_at", -1).limit(300)
    posts = await cursor.to_list(length=300)
    return {"posts": [_blog_public(p) for p in posts]}


@api_router.post("/admin/blog/posts")
async def admin_create_blog_post(payload: dict, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin", "content_reviewer"])
    title = (payload.get("title") or "").strip()
    if not title or len(title) > 200:
        raise HTTPException(400, "Titel erforderlich (max. 200 Zeichen)")
    content_html = payload.get("content_html") or ""
    if len(content_html) > 200000:
        raise HTTPException(400, "Inhalt zu groß (max. 200KB)")
    content_html = _sanitize_blog_html(content_html)
    slug = _slugify(payload.get("slug") or title)
    # Ensure unique slug
    base = slug
    i = 2
    while await db.blog_posts.find_one({"slug": slug}):
        slug = f"{base}-{i}"
        i += 1
    status = payload.get("status") or "draft"
    if status not in BLOG_ALLOWED_STATUSES:
        raise HTTPException(400, "Ungültiger Status")
    doc = {
        "id": str(uuid.uuid4()),
        "slug": slug,
        "title": title,
        "excerpt": (payload.get("excerpt") or "").strip()[:500] or None,
        "content_html": content_html,
        "cover_image": payload.get("cover_image") or None,
        "tags": [t.strip().lower() for t in (payload.get("tags") or []) if t and isinstance(t, str)][:10],
        "status": status,
        "author_id": user["id"],
        "author_name": user.get("display_name"),
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
        "published_at": now_utc().isoformat() if status == "published" else None,
        "reading_minutes": _blog_reading_time(content_html),
    }
    await db.blog_posts.insert_one(doc)
    await _audit(user["id"], "blog_post_create", doc["id"], {"title": title, "status": status})
    return _blog_public(doc, {"display_name": user.get("display_name")})


@api_router.patch("/admin/blog/posts/{post_id}")
async def admin_update_blog_post(post_id: str, payload: dict, user=Depends(_require_user)):
    await _require_role(user, ["admin", "moderator", "superadmin", "content_reviewer"])
    existing = await db.blog_posts.find_one({"id": post_id})
    if not existing:
        raise HTTPException(404, "Post nicht gefunden")
    updates: Dict = {}
    if "title" in payload:
        t = (payload["title"] or "").strip()
        if not t or len(t) > 200:
            raise HTTPException(400, "Ungültiger Titel")
        updates["title"] = t
    if "excerpt" in payload:
        updates["excerpt"] = (payload["excerpt"] or "").strip()[:500] or None
    if "content_html" in payload:
        html = payload["content_html"] or ""
        if len(html) > 200000:
            raise HTTPException(400, "Inhalt zu groß")
        html = _sanitize_blog_html(html)
        updates["content_html"] = html
        updates["reading_minutes"] = _blog_reading_time(html)
    if "cover_image" in payload:
        updates["cover_image"] = payload["cover_image"] or None
    if "tags" in payload:
        updates["tags"] = [t.strip().lower() for t in (payload["tags"] or []) if t and isinstance(t, str)][:10]
    if "slug" in payload and payload["slug"]:
        new_slug = _slugify(payload["slug"])
        if new_slug != existing.get("slug"):
            # ensure unique
            base = new_slug
            i = 2
            while await db.blog_posts.find_one({"slug": new_slug, "id": {"$ne": post_id}}):
                new_slug = f"{base}-{i}"
                i += 1
            updates["slug"] = new_slug
    if "status" in payload:
        st = payload["status"]
        if st not in BLOG_ALLOWED_STATUSES:
            raise HTTPException(400, "Ungültiger Status")
        updates["status"] = st
        if st == "published" and not existing.get("published_at"):
            updates["published_at"] = now_utc().isoformat()
    updates["updated_at"] = now_utc().isoformat()
    await db.blog_posts.update_one({"id": post_id}, {"$set": updates})
    await _audit(user["id"], "blog_post_update", post_id, {"fields": list(updates.keys())})
    doc = await db.blog_posts.find_one({"id": post_id})
    return _blog_public(doc)


@api_router.delete("/admin/blog/posts/{post_id}")
async def admin_delete_blog_post(post_id: str, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    res = await db.blog_posts.delete_one({"id": post_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Post nicht gefunden")
    await _audit(user["id"], "blog_post_delete", post_id)
    return {"ok": True}
