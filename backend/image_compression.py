"""
Image compression helpers.

Photos are uploaded as base64 data-URLs straight from the browser which
means they can be huge (7+ MB uncompressed PNGs have been observed). These
helpers normalise uploads to a reasonable wire size while preserving visual
quality for dating-style cards.

Strategy:
 1. Decode the data URL into a Pillow image.
 2. Strip EXIF (privacy) but honour EXIF orientation before dropping it.
 3. Resize so the longest edge <= MAX_EDGE px.
 4. Re-encode as JPEG (for photos) or PNG (for images with transparency).
 5. Return a fresh data URL + the decoded byte count.

If Pillow fails for any reason we fall back to the original data URL so the
upload still succeeds.
"""
from __future__ import annotations

import base64
import io
import re
from typing import Tuple

try:
    from PIL import Image, ImageOps
    _PIL_AVAILABLE = True
except Exception:  # pragma: no cover
    _PIL_AVAILABLE = False


MAX_EDGE = 1600          # px
JPEG_QUALITY = 82        # good perceptual quality, big size win
MIN_SHRINK_BYTES = 200_000  # don't bother compressing tiny images

_DATA_URL_RE = re.compile(r"^data:(?P<mime>image/[a-zA-Z0-9.+-]+);base64,(?P<payload>.+)$")


def compress_image_data_url(data_url: str) -> Tuple[str, int]:
    """
    Returns (new_data_url, byte_size_of_new_payload).

    Falls back to the original URL on any failure.
    """
    if not data_url or not data_url.startswith("data:image/") or not _PIL_AVAILABLE:
        return data_url, len(data_url or "")

    m = _DATA_URL_RE.match(data_url)
    if not m:
        return data_url, len(data_url)
    mime = m.group("mime").lower()
    payload = m.group("payload")

    try:
        raw = base64.b64decode(payload)
    except Exception:
        return data_url, len(data_url)

    # If the base64 payload is already small, skip work.
    if len(raw) < MIN_SHRINK_BYTES:
        return data_url, len(data_url)

    try:
        img = Image.open(io.BytesIO(raw))
        # Honour EXIF orientation, then throw EXIF away.
        img = ImageOps.exif_transpose(img)
        # Resize
        w, h = img.size
        longest = max(w, h)
        if longest > MAX_EDGE:
            scale = MAX_EDGE / float(longest)
            new_size = (int(w * scale), int(h * scale))
            img = img.resize(new_size, Image.LANCZOS)

        # Profile photos don't need transparency. Flatten RGBA/LA against
        # a white background and always encode as JPEG to minimise size.
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            img_rgba = img.convert("RGBA")
            bg.paste(img_rgba, mask=img_rgba.split()[-1])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        out = io.BytesIO()
        img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
        out_mime = "image/jpeg"
        new_bytes = out.getvalue()
        # Only replace if we actually made it smaller
        if len(new_bytes) >= len(raw):
            return data_url, len(data_url)
        new_payload = base64.b64encode(new_bytes).decode("ascii")
        new_url = f"data:{out_mime};base64,{new_payload}"
        return new_url, len(new_url)
    except Exception:
        return data_url, len(data_url)
