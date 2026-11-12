"""Product photos used to be shown at the size they were uploaded (up to 25MB),
on cards that are a few hundred pixels wide. Each uploaded image now gets a small
WebP copy; the original stays for the product page."""
import importlib
import io
import pkgutil
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import app.main  # noqa: F401
import app.models
from app.api import deps
from app.core import storage
from app.core.database import Base
from app.core.images import THUMB_MAX_SIDE, make_thumbnail
from app.main import app as fastapi_app
from app.models.product import Product
from app.models.user import User, UserRole


def png_bytes(size=(2000, 1000), mode="RGB", color=(200, 30, 30)):
    buffer = io.BytesIO()
    Image.new(mode, size, color).save(buffer, "PNG")
    return buffer.getvalue()


def decode(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


def test_thumbnail_is_a_small_webp_that_keeps_the_aspect_ratio():
    original = png_bytes((2000, 1000))
    thumb = make_thumbnail(io.BytesIO(original))
    image = decode(thumb)
    assert image.format == "WEBP"
    assert image.size == (THUMB_MAX_SIDE, THUMB_MAX_SIDE // 2)
    assert len(thumb) < len(original)


def test_small_images_are_not_enlarged():
    image = decode(make_thumbnail(io.BytesIO(png_bytes((200, 100)))))
    assert image.size == (200, 100)


def test_transparent_png_and_gif_are_supported():
    assert decode(make_thumbnail(io.BytesIO(png_bytes((800, 800), "RGBA", (0, 0, 0, 0))))).format == "WEBP"
    buffer = io.BytesIO()
    Image.new("P", (900, 600)).save(buffer, "GIF")
    assert decode(make_thumbnail(io.BytesIO(buffer.getvalue()))).size[0] == THUMB_MAX_SIDE


def test_unreadable_or_oversized_images_give_no_thumbnail_instead_of_an_error():
    assert make_thumbnail(io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"not really an image")) is None
    assert make_thumbnail(io.BytesIO(b"")) is None


@pytest.fixture()
def env(tmp_path, monkeypatch):
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
    db.add(maker)
    db.commit()
    product = Product(title="Lamp", creator_id=maker.id, price=100, currency="INR", status="draft")
    db.add(product)
    db.commit()
    monkeypatch.setattr(storage, "LOCAL_UPLOADS_DIR", str(tmp_path))
    monkeypatch.setattr(storage, "get_s3_client", lambda: None)
    fastapi_app.dependency_overrides[deps.get_db] = lambda: db
    fastapi_app.dependency_overrides[deps.get_current_active_user] = lambda: maker
    yield SimpleNamespace(client=TestClient(fastapi_app), product=product, root=tmp_path, db=db)
    fastapi_app.dependency_overrides.clear()
    db.close()


def upload(env, data, name="photo.png", content_type="image/png", primary=True):
    return env.client.post(
        f"/api/products/{env.product.id}/upload-media",
        files={"file": (name, data, content_type)},
        data={"is_primary": "true" if primary else "false"},
    )


def test_uploading_an_image_stores_the_original_and_a_thumbnail(env):
    original = png_bytes((2000, 1000))
    response = upload(env, original)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["media_url"].endswith(".png")
    assert body["thumb_url"].startswith("/uploads/media/") and body["thumb_url"].endswith(".webp")
    assert body["thumb_url"] != body["media_url"]
    thumb_path = env.root / "media" / body["thumb_url"].rsplit("/", 1)[1]
    original_path = env.root / "media" / body["media_url"].rsplit("/", 1)[1]
    assert decode(thumb_path.read_bytes()).size[0] == THUMB_MAX_SIDE
    assert original_path.read_bytes() == original, "the original is stored untouched"


def test_a_broken_image_still_uploads_just_without_a_thumbnail(env):
    response = upload(env, b"\x89PNG\r\n\x1a\n" + b"truncated")
    assert response.status_code == 200, response.text
    assert response.json()["thumb_url"] is None


def test_videos_get_no_thumbnail(env):
    response = upload(env, b"\x00\x00\x00\x18ftypmp42" + b"0" * 64, "clip.mp4", "video/mp4", primary=False)
    assert response.status_code == 200, response.text
    assert response.json()["thumb_url"] is None


# ---- backfill of images uploaded before thumbnails existed ----
from app.models.product import ProductMedia  # noqa: E402
from app.services.media_thumbnails import backfill_thumbnails  # noqa: E402


def add_media(env, url, media_type="image", thumb_url=None):
    media = ProductMedia(product_id=env.product.id, media_url=url, media_type=media_type, thumb_url=thumb_url)
    env.db.add(media)
    env.db.commit()
    return media


def test_backfill_counts_without_changing_anything_by_default(env):
    add_media(env, "/uploads/media/a.png")
    stored = []
    report = backfill_thumbnails(env.db, apply=False, fetch=lambda url: png_bytes(), store=lambda data: stored.append(data) or "x")
    assert (report.candidates, report.created, report.failed) == (1, 0, 0)
    assert stored == []
    assert env.db.query(ProductMedia).one().thumb_url is None


def test_backfill_creates_thumbnails_skips_done_and_videos_and_survives_a_bad_image(env):
    good = add_media(env, "/uploads/media/good.png")
    bad = add_media(env, "/uploads/media/missing.png")
    add_media(env, "/uploads/media/done.png", thumb_url="/uploads/media/done.webp")
    add_media(env, "/uploads/media/clip.mp4", media_type="video")
    fetch = lambda url: png_bytes() if "good" in url else None  # noqa: E731
    report = backfill_thumbnails(env.db, apply=True, fetch=fetch, store=lambda data: "/uploads/media/new.webp")
    assert (report.candidates, report.created, report.failed) == (2, 1, 1)
    env.db.refresh(good)
    env.db.refresh(bad)
    assert good.thumb_url == "/uploads/media/new.webp"
    assert bad.thumb_url is None
    again = backfill_thumbnails(env.db, apply=True, fetch=fetch, store=lambda data: "/uploads/media/new2.webp")
    assert (again.candidates, again.created) == (1, 0), "only the one that failed is retried"


def test_backfill_script_refuses_a_remote_database_unless_told_otherwise():
    from scripts.backfill_thumbnails import assert_local_target
    assert_local_target("localhost:5433")
    assert_local_target("127.0.0.1")
    with pytest.raises(SystemExit):
        assert_local_target("db.example.supabase.co:5432")
    assert_local_target("db.example.supabase.co:5432", allow_remote=True)
