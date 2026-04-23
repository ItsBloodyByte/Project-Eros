"""
Lightweight in-process rate limiter for sensitive endpoints.

We deliberately avoid adding slowapi/redis here to keep the footprint tiny.
A single-worker uvicorn setup is assumed (matches our supervisor config);
if you move to multi-worker, swap this for a shared-state implementation.
"""
from __future__ import annotations

import time
import asyncio
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

from fastapi import HTTPException, Request


class _Bucket:
    __slots__ = ("events", "capacity", "window")

    def __init__(self, capacity: int, window_seconds: float):
        self.events: Deque[float] = deque()
        self.capacity = capacity
        self.window = window_seconds

    def hit(self) -> Tuple[bool, float]:
        now = time.monotonic()
        # purge
        while self.events and (now - self.events[0]) > self.window:
            self.events.popleft()
        if len(self.events) >= self.capacity:
            retry_after = self.window - (now - self.events[0])
            return False, max(1.0, retry_after)
        self.events.append(now)
        return True, 0.0


class RateLimiter:
    def __init__(self):
        self._buckets: Dict[str, _Bucket] = {}
        self._lock = asyncio.Lock()

    async def check(self, key: str, capacity: int, window_seconds: float,
                    raise_on_limit: bool = True) -> bool:
        async with self._lock:
            b = self._buckets.get(key)
            if b is None:
                b = _Bucket(capacity, window_seconds)
                self._buckets[key] = b
            ok, retry = b.hit()
        if not ok:
            if raise_on_limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"Zu viele Anfragen. Bitte in ~{int(retry)}s erneut versuchen.",
                    headers={"Retry-After": str(int(retry))},
                )
            return False
        return True


def client_ip(request: Request | None) -> str:
    if request is None:
        return "unknown"
    # Kubernetes ingress -> honour X-Forwarded-For first hop
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


rate_limiter = RateLimiter()
