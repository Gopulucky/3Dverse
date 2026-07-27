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

        ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
            request.client.host if request.client else "unknown"
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
