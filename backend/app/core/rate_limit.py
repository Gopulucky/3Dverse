import logging

from fastapi import HTTPException, Request

from app.core.redis import redis_client

logger = logging.getLogger(__name__)


def rate_limit(action: str, limit: int, window_seconds: int):
    """
    Fixed-window limiter keyed on client IP, backed by Redis.

    Used on credential endpoints so an attacker cannot grind passwords or mass-
    register accounts. If Redis is unavailable the request is allowed through --
    losing the cache should not take authentication offline with it.
    """

    async def limiter(request: Request) -> None:
        client = await redis_client.get_client()
        if client is None:
            logger.warning("Rate limiting disabled for %s: Redis unavailable", action)
            return

        # X-Forwarded-For is "client, proxy1, proxy2, ..." -- each hop appends
        # the address it received the request from. The FIRST entry is
        # whatever the client sent and is trivially spoofable (a different
        # value per request defeats the limiter entirely); only the LAST
        # entry is the one our own trusted reverse proxy appended. If the
        # request didn't come through a proxy at all, fall back to the
        # socket's peer address.
        forwarded_for = request.headers.get("x-forwarded-for", "")
        ip = (
            forwarded_for.split(",")[-1].strip()
            if forwarded_for
            else (request.client.host if request.client else "unknown")
        )
        key = f"ratelimit:{action}:{ip}"

        try:
            hits = await client.incr(key)
            if hits == 1:
                await client.expire(key, window_seconds)
        except Exception as e:
            logger.warning("Rate limit check failed for %s: %s", action, e)
            return

        if hits > limit:
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please wait a moment and try again.",
            )

    return limiter
