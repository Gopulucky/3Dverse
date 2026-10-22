import asyncio

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core import rate_limit as rl
from app.core import redis as redis_mod


class FakeRedis:
    def __init__(self):
        self.counts, self.expiries = {}, {}

    async def incr(self, key):
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    async def expire(self, key, seconds):
        self.expiries[key] = seconds


class Holder:
    """Stand-in for the module-level redis_client used by the limiter."""
    def __init__(self, client):
        self.client = client

    async def get_client(self):
        return self.client


def make_request(forwarded_for=None, peer="10.0.0.1"):
    headers = [(b"x-forwarded-for", forwarded_for.encode())] if forwarded_for else []
    return Request({"type": "http", "headers": headers, "client": (peer, 1234), "method": "POST", "path": "/"})


def run(coro):
    return asyncio.run(coro)


def test_allows_up_to_the_limit_then_returns_429(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(rl, "redis_client", Holder(fake))
    limiter = rl.rate_limit("login", limit=3, window_seconds=60)
    req = make_request(peer="1.1.1.1")

    for _ in range(3):
        run(limiter(req))
    with pytest.raises(HTTPException) as exc:
        run(limiter(req))
    assert exc.value.status_code == 429
    assert fake.expiries["ratelimit:login:1.1.1.1"] == 60


def test_different_clients_have_separate_counters(monkeypatch):
    monkeypatch.setattr(rl, "redis_client", Holder(FakeRedis()))
    limiter = rl.rate_limit("login", limit=1, window_seconds=60)
    run(limiter(make_request(peer="1.1.1.1")))
    run(limiter(make_request(peer="2.2.2.2")))  # a different IP is not penalised


def test_spoofed_first_forwarded_for_entry_cannot_dodge_the_limit(monkeypatch):
    # An attacker varies the FIRST entry per request; only the LAST (appended by
    # our own proxy) is trusted, so all of these share one counter.
    monkeypatch.setattr(rl, "redis_client", Holder(FakeRedis()))
    limiter = rl.rate_limit("login", limit=2, window_seconds=60)
    run(limiter(make_request(forwarded_for="9.9.9.1, 5.5.5.5")))
    run(limiter(make_request(forwarded_for="9.9.9.2, 5.5.5.5")))
    with pytest.raises(HTTPException):
        run(limiter(make_request(forwarded_for="9.9.9.3, 5.5.5.5")))


def test_fails_open_when_redis_is_unavailable(monkeypatch):
    monkeypatch.setattr(rl, "redis_client", Holder(None))
    limiter = rl.rate_limit("login", limit=1, window_seconds=60)
    for _ in range(5):
        run(limiter(make_request()))  # must not raise: auth stays up without Redis


def test_fails_open_when_redis_errors_mid_request(monkeypatch):
    class Broken(FakeRedis):
        async def incr(self, key):
            raise ConnectionError("boom")

    monkeypatch.setattr(rl, "redis_client", Holder(Broken()))
    run(rl.rate_limit("login", limit=1, window_seconds=60)(make_request()))


# --- reconnect cooldown (the per-request reconnect fix) --------------------------
def test_unavailable_redis_is_not_reconnected_on_every_request(monkeypatch):
    attempts = []

    def failing_from_url(*args, **kwargs):
        attempts.append(kwargs)
        raise ConnectionError("redis is down")

    clock = {"now": 1000.0}
    monkeypatch.setattr(redis_mod.aioredis, "from_url", failing_from_url)
    monkeypatch.setattr(redis_mod.time, "monotonic", lambda: clock["now"])

    client = redis_mod.RedisClient()
    for _ in range(20):
        assert run(client.get_client()) is None
    assert len(attempts) == 1, "a down Redis must cost one attempt per cooldown, not one per request"

    clock["now"] += redis_mod.RECONNECT_COOLDOWN_SECONDS + 1
    assert run(client.get_client()) is None
    assert len(attempts) == 2, "after the cooldown it should try again"


def test_connection_attempts_are_time_bounded(monkeypatch):
    seen = {}

    class Dummy:
        async def ping(self):
            return True

    def capture(*args, **kwargs):
        seen.update(kwargs)
        return Dummy()

    monkeypatch.setattr(redis_mod.aioredis, "from_url", capture)
    client = redis_mod.RedisClient()
    run(client.connect())
    assert seen["socket_connect_timeout"] == redis_mod.CONNECT_TIMEOUT_SECONDS
    assert seen["socket_timeout"] == redis_mod.CONNECT_TIMEOUT_SECONDS
    assert client.redis is not None


def test_cache_helpers_are_noops_when_redis_is_down():
    client = redis_mod.RedisClient()
    assert run(client.cache_get("k")) is None
    assert run(client.cache_set("k", {"a": 1})) is False
    assert run(client.cache_delete("k")) is False
