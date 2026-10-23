import logging
import threading
import time

from fastapi import HTTPException, Request

from app.core.redis import redis_client

logger = logging.getLogger(__name__)


class _MemoryWindowCounter:
    """Fixed-window counter held in this process.

    Used when Redis is unavailable (the current hosted deploy has none). It is
    per-process, so with N workers an attacker gets N x the limit -- still far
    better than the previous behaviour of no limit at all.
    """

    _MAX_KEYS = 10_000

    def __init__(self):
        self._lock = threading.Lock()
        self._windows: dict[str, tuple[float, int]] = {}

    def hit(self, key: str, window_seconds: int) -> int:
        now = time.monotonic()
        with self._lock:
            expires, count = self._windows.get(key, (0.0, 0))
            if expires <= now:
                expires, count = now + window_seconds, 0
            count += 1
            self._windows[key] = (expires, count)
            if len(self._windows) > self._MAX_KEYS:
                for k in [k for k, (exp, _) in self._windows.items() if exp <= now]:
                    self._windows.pop(k, None)
                if len(self._windows) > self._MAX_KEYS:
                    self._windows.clear()
            return count

    def reset(self) -> None:
        with self._lock:
            self._windows.clear()


memory_counter = _MemoryWindowCounter()


def client_ip(request: Request) -> str:
    # X-Forwarded-For is "client, proxy1, proxy2, ..." -- each hop appends
    # the address it received the request from. The FIRST entry is
    # whatever the client sent and is trivially spoofable (a different
    # value per request defeats the limiter entirely); only the LAST
    # entry is the one our own trusted reverse proxy appended. If the
    # request didn't come through a proxy at all, fall back to the
    # socket's peer address.
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(action: str, limit: int, window_seconds: int):
    """
    Fixed-window limiter keyed on client IP.

    Used on credential endpoints so an attacker cannot grind passwords or mass-
    register accounts. Backed by Redis when available; otherwise (or if Redis
    errors) it falls back to an in-process counter, so the limit still applies
    and losing the cache does not take authentication offline.
    """

    async def limiter(request: Request) -> None:
        key = f"ratelimit:{action}:{client_ip(request)}"
        hits = None

        client = await redis_client.get_client()
        if client is not None:
            try:
                hits = await client.incr(key)
                if hits == 1:
                    await client.expire(key, window_seconds)
            except Exception as e:
                logger.warning("Rate limit check failed for %s: %s", action, e)
                hits = None

        if hits is None:
            hits = memory_counter.hit(key, window_seconds)

        if hits > limit:
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please wait a moment and try again.",
            )

    return limiter
