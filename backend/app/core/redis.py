import json
import logging
import time
from redis import asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

# After a failed connect, don't try again for this long. Without this, every
# request that asks for the client (every rate-limited login/register call)
# paid for a fresh connection attempt and logged an error -- and against a
# remote Redis that is down, each attempt could hang until the OS gave up.
RECONNECT_COOLDOWN_SECONDS = 30
# Hard bounds on a single attempt, so an unreachable Redis costs ~2s, not minutes.
CONNECT_TIMEOUT_SECONDS = 2


class RedisClient:
    def __init__(self):
        self.redis = None
        self._next_attempt_at = 0.0

    async def connect(self):
        try:
            self.redis = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=CONNECT_TIMEOUT_SECONDS,
                socket_timeout=CONNECT_TIMEOUT_SECONDS,
            )
            await self.redis.ping()
            self._next_attempt_at = 0.0
            logger.info("Successfully connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.redis = None
            self._next_attempt_at = time.monotonic() + RECONNECT_COOLDOWN_SECONDS

    async def disconnect(self):
        if self.redis:
            await self.redis.close()
            logger.info("Disconnected from Redis")

    async def get_client(self):
        if not self.redis and time.monotonic() >= self._next_attempt_at:
            await self.connect()
        return self.redis

    async def cache_get(self, key: str):
        if not self.redis:
            return None
        try:
            data = await self.redis.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None

    async def cache_set(self, key: str, value: any, expire: int = 3600):
        if not self.redis:
            return False
        try:
            await self.redis.set(key, json.dumps(value), ex=expire)
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False

    async def cache_delete(self, key: str):
        if not self.redis:
            return False
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return False
            
    async def publish(self, channel: str, message: dict):
        if not self.redis:
            return False
        try:
            await self.redis.publish(channel, json.dumps(message))
            return True
        except Exception as e:
            logger.error(f"Redis publish error: {e}")
            return False

redis_client = RedisClient()

async def get_redis():
    return await redis_client.get_client()
