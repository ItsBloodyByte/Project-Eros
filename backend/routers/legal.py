"""Legal pages routes (ToS, Datenschutz, Impressum, …).

Public readers: `GET /api/legal`, `GET /api/legal/{key}`.
Admin editor:   `PUT /api/admin/legal/{key}`.

The default-content seeding (`_ensure_default_legal_pages`) lives in
`server.py` because it is also invoked during app startup. We just import
the helper here; no seeding logic is duplicated.
"""

from fastapi import Depends, HTTPException

from server import (
    api_router,
    db,
    now_utc,
    _require_user,
    _require_role,
    _audit,
    _ensure_default_legal_pages,
    LEGAL_PAGE_KEYS,
)
from models import LegalPageUpdate


@api_router.get("/legal")
async def list_legal():
    """Public: list available legal pages (key + title only)."""
    await _ensure_default_legal_pages()
    items = await db.legal_pages.find(
        {}, {"_id": 0, "key": 1, "title": 1, "updated_at": 1}
    ).to_list(50)
    return {"pages": items}


@api_router.get("/legal/{key}")
async def get_legal(key: str):
    """Public: fetch a legal page by key."""
    if key not in LEGAL_PAGE_KEYS:
        raise HTTPException(404, "Unbekannte Seite")
    await _ensure_default_legal_pages()
    doc = await db.legal_pages.find_one({"key": key})
    if not doc:
        raise HTTPException(404, "Seite nicht gefunden")
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/legal/{key}")
async def admin_update_legal(key: str, body: LegalPageUpdate, user=Depends(_require_user)):
    await _require_role(user, ["admin", "superadmin"])
    if key not in LEGAL_PAGE_KEYS:
        raise HTTPException(404, "Unbekannte Seite")
    upd = {
        "key": key,
        "title": body.title,
        "content_markdown": body.content_markdown,
        "updated_at": now_utc().isoformat(),
        "updated_by": user["id"],
    }
    await db.legal_pages.update_one({"key": key}, {"$set": upd}, upsert=True)
    await _audit(
        user["id"],
        "legal_update",
        key,
        {"title": body.title, "length": len(body.content_markdown)},
    )
    return {"ok": True}
