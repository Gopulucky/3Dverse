"""A buyer needs to know what they are getting before paying: the file's type and
size, and how the creator says to print it. The creator's print settings used to
be dropped silently on save. The paid file itself must stay private."""
import importlib
import pkgutil
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import app.main  # noqa: F401
import app.models
from app.api import deps
from app.core.database import Base
from app.main import app as fastapi_app
from app.models.product import Product, ProductVersion
from app.models.user import User, UserRole
from app.schemas.product import ProductUpdate


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
    maker = User(email="maker@example.com", hashed_password="x", role=UserRole.creator, is_active=True, company_name="Maker")
    db.add(maker)
    db.commit()
    product = Product(title="Pendant", creator_id=maker.id, price=149, currency="INR", status="published",
                      is_mode_2_active=True, digital_download_enabled=True)
    db.add(product)
    db.flush()
    db.add(ProductVersion(product_id=product.id, file_url="/private/secret-pendant.stl", file_name="secret-pendant.stl",
                          file_size=84_000, version_number=1, is_latest=True))
    db.commit()
    fastapi_app.dependency_overrides[deps.get_db] = lambda: db
    fastapi_app.dependency_overrides[deps.get_current_active_user] = lambda: maker
    yield SimpleNamespace(client=TestClient(fastapi_app), db=db, product=product)
    fastapi_app.dependency_overrides.clear()
    db.close()


def test_print_settings_a_creator_saves_are_kept_and_shown_to_buyers(env):
    settings = {"layer_height": 0.2, "supports_required": False, "recommended_materials": ["PLA", "PETG"]}
    saved = env.client.put(f"/api/products/{env.product.id}", json={"print_settings": settings})
    assert saved.status_code == 200, saved.text
    assert saved.json()["print_settings"] == settings

    public = env.client.get(f"/api/marketplace/products/{env.product.id}").json()
    assert public["print_settings"] == settings


def test_buyers_see_the_file_type_and_size_but_not_the_file(env):
    public = env.client.get(f"/api/marketplace/products/{env.product.id}")
    version = public.json()["versions"][0]
    assert version["file_format"] == "STL"
    assert version["file_size"] == 84_000
    assert "file_url" not in version and "file_name" not in version
    assert "secret-pendant" not in public.text


def test_only_known_print_settings_with_sensible_values_are_accepted():
    cleaned = ProductUpdate(print_settings={
        "layer_height": 50, "infill_percentage": 15, "supports_required": "yes", "raft_brim_required": True,
        "recommended_materials": ["  PLA ", "", 7, "x" * 60], "script": "<b>no</b>",
    }).print_settings
    assert cleaned == {"infill_percentage": 15, "raft_brim_required": True, "recommended_materials": ["PLA"]}


def test_settings_written_by_the_catalogue_importer_survive():
    imported = {"layer_height": "0.2mm", "infill": "15%", "supports": "none"}
    assert ProductUpdate(print_settings=imported).print_settings == imported
