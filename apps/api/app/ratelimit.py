"""Small in-memory sliding-window rate limiter.

Good enough for a single API instance (StudyFlow's deployment). With several
instances, limits would be per instance; a shared store such as Redis would be
the next step. Keys combine the route name with the caller's session or IP, so
one student can't exhaust another's allowance.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.session import COOKIE_NAME


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_seconds: float) -> float | None:
        """Record a hit; return seconds to wait if over the limit, else None."""

        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                return window_seconds - (now - hits[0])
            hits.append(now)
            if len(self._hits) > 50_000:  # bound memory: drop idle keys
                for stale in [k for k, v in self._hits.items() if not v]:
                    del self._hits[stale]
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()


def client_ip(request: Request) -> str:
    # Uvicorn runs with --proxy-headers behind the hosting proxy, so this is the real client.
    return request.client.host if request.client else "unknown"


def rate_limit(name: str, limit: int, window_seconds: float, by: str = "session"):
    """FastAPI dependency: allow `limit` calls per `window_seconds` per session (or IP)."""

    def dependency(request: Request) -> None:
        identity = request.cookies.get(COOKIE_NAME) if by == "session" else None
        key = f"{name}:{identity or 'ip:' + client_ip(request)}"
        retry_after = limiter.check(key, limit, window_seconds)
        if retry_after is not None:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(max(1, round(retry_after)))},
            )

    return dependency
