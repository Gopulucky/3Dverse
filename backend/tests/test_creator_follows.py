"""Creator pages, following, new-design alerts, image captions and the country preference.

Uses the same in-memory SQLite set-up as the partner route tests (see conftest:
no real database, Redis or network).
"""
import importlib
import os
import pkgutil
from types import SimpleNamespace

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient
from pydantic import ValidationError

import app.main  # noqa: F401
import app.models
from app.api import deps
from app.core.database import Base
from app.main import app as fastapi_app
from app.models.notification import Notification
from app.models.product import Product, ProductMedia, ProductStatus
from app.models.user import User, UserRole
from app.schemas.user import AccountProfileUpdate

BACKEND = os.path.dirname(os.path.dirname(__file__))


@pytest.fixture()
def env():
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
    current = {"user": None}
    fastapi_app.dependency_overrides[deps.get_db] = lambda: db
    fastapi_app.dependency_overrides[deps.get_current_active_user] = lambda: current["user"]
    client = TestClient(fastapi_app)

    def make_user(email, role=UserRole.customer, **extra):
        user = User(email=email, hashed_password="x", role=role, is_active=True, **extra)
        db.add(user)
        db.commit()
        return user

    def make_product(creator, title="Dice tower", status=ProductStatus.published):
        product = Product(title=title, creator_id=creator.id, status=status, price=199)
        db.add(product)
        db.commit()
        return product

    def as_user(user):
        current["user"] = user
        return client

    yield SimpleNamespace(db=db, client=client, make_user=make_user, make_product=make_product, as_user=as_user)
    fastapi_app.dependency_overrides.clear()
    db.close()


def creator_with_product(env, email="gopu@example.com", name="Gopu Hardik"):
    creator = env.make_user(email, UserRole.creator, full_name=name, bio="I design tabletop pieces.")
    env.make_product(creator)
    return creator


# --- the creator's public page ------------------------------------------------

def test_profile_shows_public_facts_only(env):
    creator = creator_with_product(env)
    env.make_product(creator, "Draft only", status=ProductStatus.draft)
    body = env.client.get(f"/api/creators/{creator.id}").json()
    assert body["name"] == "Gopu Hardik"
    assert body["bio"] == "I design tabletop pieces."
    assert body["product_count"] == 1, "drafts are not counted"
    assert body["follower_count"] == 0
    assert "email" not in body and "hashed_password" not in body


def test_unknown_or_non_creator_or_empty_creator_is_not_found(env):
    customer = env.make_user("buyer@example.com")
    empty_creator = env.make_user("new@example.com", UserRole.creator)
    for user_id in (9999, customer.id, empty_creator.id):
        assert env.client.get(f"/api/creators/{user_id}").status_code == 404


def test_creator_products_lists_only_published_work_of_that_creator(env):
    creator = creator_with_product(env)
    other = creator_with_product(env, "other@example.com", "Someone Else")
    env.make_product(creator, "Draft only", status=ProductStatus.draft)
    titles = [p["title"] for p in env.client.get(f"/api/creators/{creator.id}/products").json()]
    assert titles == ["Dice tower"]
    assert other.id != creator.id


# --- following -------------------------------------------------------------------

def test_follow_and_unfollow_are_repeatable_and_counted(env):
    creator = creator_with_product(env)
    fan = env.make_user("fan@example.com")
    client = env.as_user(fan)
    assert client.get(f"/api/creators/{creator.id}/follow").json() == {"following": False, "follower_count": 0}
    assert client.post(f"/api/creators/{creator.id}/follow").json() == {"following": True, "follower_count": 1}
    assert client.post(f"/api/creators/{creator.id}/follow").json() == {"following": True, "follower_count": 1}, "following twice is harmless"
    assert client.get(f"/api/creators/{creator.id}/follow").json()["following"] is True
    assert client.delete(f"/api/creators/{creator.id}/follow").json() == {"following": False, "follower_count": 0}
    assert client.delete(f"/api/creators/{creator.id}/follow").json() == {"following": False, "follower_count": 0}


def test_nobody_can_follow_themselves_or_a_page_that_does_not_exist(env):
    creator = creator_with_product(env)
    assert env.as_user(creator).post(f"/api/creators/{creator.id}/follow").status_code == 400
    assert env.as_user(creator).post("/api/creators/9999/follow").status_code == 404


def test_follower_count_is_public(env):
    creator = creator_with_product(env)
    for index in range(3):
        env.as_user(env.make_user(f"fan{index}@example.com")).post(f"/api/creators/{creator.id}/follow")
    assert env.client.get(f"/api/creators/{creator.id}").json()["follower_count"] == 3


# --- new-design alerts -------------------------------------------------------------

def test_followers_get_one_alert_for_a_new_design(env):
    from app.services.follows import notify_followers_of_new_design
    creator = creator_with_product(env)
    fan = env.make_user("fan@example.com")
    stranger = env.make_user("stranger@example.com")
    env.as_user(fan).post(f"/api/creators/{creator.id}/follow")
    product = env.make_product(creator, "Castle keep")

    assert notify_followers_of_new_design(env.db, product) == 1

    alerts = env.db.query(Notification).all()
    assert [a.user_id for a in alerts] == [fan.id]
    assert stranger.id not in [a.user_id for a in alerts]
    alert = alerts[0]
    assert alert.type == "new_design"
    assert "Gopu Hardik" in alert.title
    assert "Castle keep" in alert.message
    assert alert.data == {"product_id": product.id, "creator_id": creator.id}
    assert alert.read is False


def test_no_followers_means_no_alerts(env):
    from app.services.follows import notify_followers_of_new_design
    creator = creator_with_product(env)
    assert notify_followers_of_new_design(env.db, env.make_product(creator, "Quiet one")) == 0
    assert env.db.query(Notification).count() == 0


def test_publishing_through_the_api_alerts_followers_once(env):
    creator = env.make_user("gopu@example.com", UserRole.creator, full_name="Gopu Hardik")
    env.make_product(creator, "First", status=ProductStatus.published)
    fan = env.make_user("fan@example.com")
    env.as_user(fan).post(f"/api/creators/{creator.id}/follow")
    draft = env.make_product(creator, "Second", status=ProductStatus.draft)
    draft.safety_review_status = "approved"
    draft.fulfillment_status = "self"
    env.db.add(ProductMedia(product_id=draft.id, media_url="/m/a.png", media_type="image", is_primary=True))
    env.db.commit()

    client = env.as_user(creator)
    assert client.put(f"/api/products/{draft.id}", json={"status": "published"}).status_code == 200
    assert env.db.query(Notification).filter(Notification.user_id == fan.id).count() == 1

    # Unpublishing and publishing again must not alert everyone a second time.
    assert client.put(f"/api/products/{draft.id}", json={"status": "draft"}).status_code == 200
    assert client.put(f"/api/products/{draft.id}", json={"status": "published"}).status_code == 200
    assert env.db.query(Notification).filter(Notification.user_id == fan.id).count() == 1


# --- image captions ----------------------------------------------------------------

def test_a_creator_can_describe_each_image(env):
    creator = creator_with_product(env)
    product = env.db.query(Product).first()
    media = ProductMedia(product_id=product.id, media_url="/m/a.png", media_type="image")
    env.db.add(media)
    env.db.commit()
    client = env.as_user(creator)
    reply = client.put(f"/api/products/{product.id}/media/{media.id}", json={"caption": "  Front view, printed in PETG  "})
    assert reply.status_code == 200
    assert reply.json()["caption"] == "Front view, printed in PETG"
    assert client.put(f"/api/products/{product.id}/media/{media.id}", json={"caption": "   "}).json()["caption"] is None
    assert client.put(f"/api/products/{product.id}/media/{media.id}", json={"caption": "x" * 201}).status_code == 422


def test_only_the_owner_can_caption_and_the_image_must_belong_to_the_product(env):
    creator = creator_with_product(env)
    product = env.db.query(Product).first()
    media = ProductMedia(product_id=product.id, media_url="/m/a.png", media_type="image")
    env.db.add(media)
    env.db.commit()
    intruder = env.make_user("intruder@example.com", UserRole.creator)
    assert env.as_user(intruder).put(f"/api/products/{product.id}/media/{media.id}", json={"caption": "mine"}).status_code == 403
    assert env.as_user(creator).put(f"/api/products/{product.id}/media/9999", json={"caption": "x"}).status_code == 404


def test_captions_are_part_of_the_public_product(env):
    creator = creator_with_product(env)
    product = env.db.query(Product).first()
    env.db.add(ProductMedia(product_id=product.id, media_url="/m/a.png", media_type="image", caption="Side view"))
    env.db.commit()
    body = env.client.get(f"/api/marketplace/products/{product.id}").json()
    assert body["media"][0]["caption"] == "Side view"
    assert body["creator_id"] == creator.id


# --- country preference ---------------------------------------------------------------

def test_country_is_a_two_letter_code_stored_in_capitals():
    assert AccountProfileUpdate(country=" au ").country == "AU"
    assert AccountProfileUpdate().country is None
    for bad in ("AUS", "A", "1N", "", "India"):
        with pytest.raises(ValidationError):
            AccountProfileUpdate(country=bad)


def test_country_is_saved_on_the_account_and_returned(env):
    fan = env.make_user("fan@example.com")
    client = env.as_user(fan)
    assert client.get("/api/users/me").json()["country"] is None
    assert client.put("/api/users/me", json={"country": "us"}).json()["country"] == "US"
    assert env.db.get(User, fan.id).country == "US"


# --- migration -----------------------------------------------------------------------

def test_new_migration_extends_the_chain_additively():
    cfg = Config(os.path.join(BACKEND, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND, "alembic"))
    scripts = ScriptDirectory.from_config(cfg)
    assert len(scripts.get_heads()) == 1
    head = scripts.get_revision(scripts.get_current_head())
    assert head.down_revision == "b7d2e4f1a905"
    source = open(head.path, encoding="utf8").read()
    for expected in ("creator_follows", "caption", "country"):
        assert expected in source
    upgrade = source.split("def upgrade")[1].split("def downgrade")[0]
    assert "drop_" not in upgrade and "alter_column" not in upgrade, "upgrade only adds things"
    assert "def downgrade" in source
