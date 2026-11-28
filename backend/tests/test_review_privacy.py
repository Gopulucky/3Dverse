"""Reviews are public. They must name the reviewer politely and nothing more: the
response used to carry the buyer's whole account, email and pincode included.
And the product page's form (rating and text only) has to be accepted."""
import importlib
import pkgutil
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import app.main  # noqa: F401
import app.models
from app.api import deps
from app.api.routers import reviews as reviews_router
from app.core.database import Base
from app.main import app as fastapi_app
from app.models.product import Product
from app.models.review import Review
from app.models.user import User, UserRole


@pytest.fixture()
def env(monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from sqlalchemy.pool import StaticPool
    for module in pkgutil.iter_modules(app.models.__path__):
        importlib.import_module(f"app.models.{module.name}")
    try:
        import sqlite3 as sqlite
    except ModuleNotFoundError:
        import _sqlite3
        sqlite = SimpleNamespace(**vars(_sqlite3))
        sqlite.paramstyle = "qmark"
        sqlite.sqlite_version_info = tuple(map(int, sqlite.sqlite_version.split(".")))
    engine = create_engine("sqlite://", module=sqlite, connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = Session(engine)
    maker = User(email="maker@example.com", hashed_password="x", role=UserRole.creator, is_active=True)
    named = User(email="private.person@example.com", hashed_password="x", role=UserRole.customer, is_active=True,
                 full_name="Asha Verma", pincode="411001")
    unnamed = User(email="no.name@example.com", hashed_password="x", role=UserRole.customer, is_active=True)
    db.add_all([maker, named, unnamed])
    db.commit()
    product = Product(title="Pendant", creator_id=maker.id, price=149, currency="INR", status="published")
    db.add(product)
    db.commit()
    db.add(Review(product_id=product.id, user_id=named.id, rating=5, text="Prints cleanly.", images=[]))
    db.commit()
    fastapi_app.dependency_overrides[deps.get_db] = lambda: db
    fastapi_app.dependency_overrides[deps.get_current_active_user] = lambda: unnamed
    monkeypatch.setattr(reviews_router, "has_purchased", lambda *_: True)
    yield SimpleNamespace(client=TestClient(fastapi_app), product=product)
    fastapi_app.dependency_overrides.clear()
    db.close()


def test_public_reviews_carry_a_first_name_and_nothing_else_about_the_buyer(env):
    response = env.client.get(f"/api/reviews/{env.product.id}")
    assert response.status_code == 200
    (review,) = response.json()
    assert review["reviewer_name"] == "Asha"
    assert "user" not in review and "user_id" not in review
    for private in ("private.person", "example.com", "411001", "Verma"):
        assert private not in response.text, private


def test_a_buyer_without_a_name_is_a_verified_buyer_and_the_page_form_is_accepted(env):
    # Exactly what the product page sends: no product_id in the body.
    posted = env.client.post(f"/api/reviews/{env.product.id}", json={"rating": 4, "text": "Good fit on my printer."})
    assert posted.status_code == 200, posted.text
    assert posted.json()["reviewer_name"] == "Verified buyer"
    assert "no.name" not in posted.text
