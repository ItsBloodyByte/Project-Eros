# -------- Eros Backend (FastAPI + Motor + MongoDB) --------
# Python 3.11 slim keeps the image lean while still carrying the
# native extensions Pillow / bcrypt / cryptography / opencv-headless need.
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# Runtime system packages for Pillow, bcrypt, OpenCV headless, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libjpeg-dev zlib1g-dev libpng-dev libwebp-dev libtiff-dev \
        libfreetype6-dev liblcms2-dev libopenjp2-7-dev \
        libffi-dev libssl-dev \
        curl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first so the large dependency layer caches aggressively.
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# Copy the application source
COPY . /app

# Security: drop privileges
RUN useradd --create-home --uid 1001 erosapp && chown -R erosapp:erosapp /app
USER erosapp

EXPOSE 8001

# tini handles zombie reaping; uvicorn serves the FastAPI app.
# Single worker keeps our in-process rate-limiter and WS-broadcast state
# consistent. Scale horizontally with a sticky ingress + redis if needed.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--proxy-headers", "--forwarded-allow-ips", "*"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8001/api/legal/terms >/dev/null || exit 1
