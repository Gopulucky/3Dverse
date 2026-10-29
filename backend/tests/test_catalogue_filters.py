"""Catalogue SQL boundary checks without an external database.
The environment Python lacks sqlite3; compile the real PostgreSQL query instead.
"""
from sqlalchemy.orm import Session
from sqlalchemy.dialects import postgresql

import app.main  # noqa: F401
from app.api.routers import marketplace
from app.models.product import Product
from fastapi.testclient import TestClient
from app.main import app


def sql(**kwargs):
    query = Session().query(Product.id)
    helper = getattr(marketplace, "_catalogue_filters", lambda query, **_: query)
    return str(helper(query, **kwargs).offset(20).limit(21).statement.compile(
        dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


def test_digital_requires_both_offer_and_download_permission():
    statement = sql(format="digital", sort="newest")
    assert "products.is_mode_2_active IS true" in statement
    assert "products.digital_download_enabled IS true" in statement


def test_physical_includes_print_and_custom_print_offers():
    statement = sql(format="physical", sort="newest")
    assert "products.is_mode_3_active IS true OR products.is_mode_4_active IS true" in statement


def test_price_sort_uses_physical_price_and_stable_id_tie_break():
    assert "ORDER BY products.base_print_price ASC, products.id ASC" in sql(format="physical", sort="price_asc")
    assert "ORDER BY products.price DESC, products.id ASC" in sql(format="digital", sort="price_desc")


def test_newest_and_featured_sorts_are_stable_and_paginated():
    statement = sql(sort="newest")
    assert "ORDER BY products.created_at DESC, products.id DESC" in statement
    assert "LIMIT 21 OFFSET 20" in statement
    assert "ORDER BY products.is_featured DESC, products.created_at DESC, products.id DESC" in sql(sort="featured")


def test_cache_cannot_reuse_a_different_format_sort_currency_or_page(monkeypatch):
    keys = []
    monkeypatch.setattr(marketplace, "_cached", lambda key, build: keys.append(key) or [])
    for parameters in [
        dict(format="digital", sort="newest", currency="INR", skip=0),
        dict(format="physical", sort="newest", currency="INR", skip=0),
        dict(format="physical", sort="price_asc", currency="INR", skip=0),
        dict(format="physical", sort="price_asc", currency="USD", skip=0),
        dict(format="physical", sort="price_asc", currency="USD", skip=20),
    ]:
        marketplace.get_products(db=None, limit=21, **parameters)
    assert len(set(keys)) == 5


def test_catalogue_rejects_unknown_format_sort_and_currency():
    client = TestClient(app)
    for parameter in ("format=file", "sort=random", "currency=EUR"):
        assert client.get(f"/api/marketplace/products?{parameter}").status_code == 422
