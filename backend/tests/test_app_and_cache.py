"""App-level checks: security headers, static caching, and the marketplace cache.
No database is touched (the routes under test don't use one)."""
import os
import uuid

from fastapi.testclient import TestClient

from app.api.routers import marketplace
from app.main import app, uploads_dir

client = TestClient(app)  # not used as a context manager: skips lifespan (Redis connect)


def test_health_endpoint_and_nosniff_header():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    assert r.headers["x-content-type-options"] == "nosniff"


def test_public_uploads_are_served_with_long_lived_cache_headers():
    name = f"_test_{uuid.uuid4().hex}.png"
    path = os.path.join(uploads_dir, "images", name)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + b"0" * 32)
    try:
        r = client.get(f"/uploads/images/{name}")
        assert r.status_code == 200
        assert "immutable" in r.headers["cache-control"]
        assert r.headers["x-content-type-options"] == "nosniff"
    finally:
        os.remove(path)


def test_missing_upload_is_404_and_not_cached_as_immutable():
    r = client.get("/uploads/images/does-not-exist.png")
    assert r.status_code == 404
    assert "immutable" not in r.headers.get("cache-control", "")


def test_private_upload_folders_are_not_publicly_mounted():
    # Paid models, invoices and submitted designs must only be reachable through
    # the entitlement-checked /api/downloads endpoints.
    for private in ("models", "invoices", "designs", "submissions"):
        assert client.get(f"/uploads/{private}/anything.stl").status_code == 404


def test_unknown_error_responses_do_not_leak_internals():
    r = client.get("/api/marketplace/products/not-a-number")
    assert r.status_code == 422
    assert "Traceback" not in r.text and "sqlalchemy" not in r.text.lower()


# --- TTL cache -------------------------------------------------------------------
def test_cache_serves_repeat_calls_without_rebuilding(monkeypatch):
    marketplace.clear_marketplace_cache()
    clock = {"now": 100.0}
    monkeypatch.setattr(marketplace.time, "monotonic", lambda: clock["now"])
    calls = []

    def build():
        calls.append(1)
        return {"n": len(calls)}

    assert marketplace._cached("k", build) == {"n": 1}
    assert marketplace._cached("k", build) == {"n": 1}
    assert len(calls) == 1

    clock["now"] += marketplace.MARKETPLACE_CACHE_TTL + 1
    assert marketplace._cached("k", build) == {"n": 2}, "an expired entry must be rebuilt"


def test_cache_is_bounded_so_search_terms_cannot_grow_memory_forever(monkeypatch):
    marketplace.clear_marketplace_cache()
    for i in range(marketplace._CACHE_MAX_ENTRIES * 3):
        marketplace._cached(f"q{i}", lambda: 1)
    assert len(marketplace._cache) <= marketplace._CACHE_MAX_ENTRIES


def test_clear_marketplace_cache_forces_a_rebuild():
    marketplace.clear_marketplace_cache()
    calls = []
    marketplace._cached("k", lambda: calls.append(1) or 1)
    marketplace.clear_marketplace_cache()
    marketplace._cached("k", lambda: calls.append(1) or 1)
    assert len(calls) == 2


def test_pagination_bounds_are_validated():
    # Used to reach Postgres as OFFSET -1 and come back as a 500.
    assert client.get("/api/marketplace/products?skip=-1").status_code == 422
    assert client.get("/api/marketplace/products?limit=0").status_code == 422
    assert client.get("/api/marketplace/products?limit=101").status_code == 422
