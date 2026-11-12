"""The cart and orders pages were slow because each product on them fired several
lazy queries (media, versions, printability reports, creator), and every query
crosses from the API to the database. The number of queries must not grow with
the number of items, and the responses must not carry paths to paid files."""
import importlib
import pkgutil
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

import app.main  # noqa: F401
import app.models
from app.api import deps
from app.core.database import Base
from app.main import app as fastapi_app
from app.models.cart import Cart, CartItem
from app.models.order import Order, OrderItem
from app.models.product import PrintabilityReport, Product, ProductMedia, ProductVersion
from app.models.user import User, UserRole

QUERY_BUDGET = 4  # user lookup + three batched queries (cart, lines with products, images), whatever the size


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
    buyer = User(email="buyer@example.com", hashed_password="x", role=UserRole.customer, is_active=True)
    maker = User(email="maker@example.com", hashed_password="x", role=UserRole.creator, is_active=True, company_name="Maker")
    db.add_all([buyer, maker])
    db.commit()
    fastapi_app.dependency_overrides[deps.get_db] = lambda: db
    fastapi_app.dependency_overrides[deps.get_current_active_user] = lambda: buyer
    counter = {"n": 0}

    @event.listens_for(engine, "before_cursor_execute")
    def count(*_args):
        counter["n"] += 1

    def make_products(n):
        products = []
        for i in range(n):
            p = Product(title=f"Model {i}", creator_id=maker.id, price=100 + i, base_print_price=250, currency="INR",
                        status="published", is_mode_2_active=True, digital_download_enabled=True, is_mode_3_active=True)
            db.add(p)
            db.flush()
            db.add(ProductMedia(product_id=p.id, media_url=f"/m{i}.png", media_type="image", is_primary=True))
            v = ProductVersion(product_id=p.id, file_url=f"/private/secret-{i}.stl", file_name="f.stl", file_size=1, version_number=1, is_latest=True)
            db.add(v)
            db.flush()
            db.add(PrintabilityReport(version_id=v.id, status="pass", issues=[]))
            products.append(p)
        db.commit()
        return products

    def fill_cart(products):
        cart = db.query(Cart).filter(Cart.user_id == buyer.id).first() or Cart(user_id=buyer.id)
        db.add(cart)
        db.flush()
        for p in products:
            db.add(CartItem(cart_id=cart.id, product_id=p.id, quantity=1, selected_config={"purchase_type": "digital"}))
        db.commit()

    def fill_orders(products, orders):
        for _ in range(orders):
            o = Order(customer_id=buyer.id, status="paid", total=300, currency="INR")
            db.add(o)
            db.flush()
            for p in products:
                db.add(OrderItem(order_id=o.id, product_id=p.id, quantity=1, price_at_purchase=100,
                                 selected_config={"purchase_type": "digital"}))
        db.commit()

    def measure(path):
        db.expire_all()
        counter["n"] = 0
        response = TestClient(fastapi_app).get(path)
        assert response.status_code == 200, response.text
        return response, counter["n"]

    yield SimpleNamespace(db=db, make_products=make_products, fill_cart=fill_cart, fill_orders=fill_orders, measure=measure)
    fastapi_app.dependency_overrides.clear()
    db.close()


def test_cart_query_count_does_not_grow_with_items(env):
    env.fill_cart(env.make_products(1))
    _, small = env.measure("/api/cart/")
    env.fill_cart(env.make_products(8))
    response, large = env.measure("/api/cart/")
    assert len(response.json()["items"]) == 9
    assert large == small, f"cart queries grew with items: {small} -> {large}"
    assert large <= QUERY_BUDGET, f"cart used {large} queries"


def test_orders_query_count_does_not_grow_with_orders(env):
    products = env.make_products(2)
    env.fill_orders(products, 1)
    _, small = env.measure("/api/orders/")
    env.fill_orders(products, 6)
    response, large = env.measure("/api/orders/")
    assert len(response.json()) == 7
    assert large == small, f"orders queries grew with orders: {small} -> {large}"
    assert large <= QUERY_BUDGET, f"orders used {large} queries"


def test_cart_and_orders_never_expose_paid_file_paths(env):
    products = env.make_products(2)
    env.fill_cart(products)
    env.fill_orders(products, 1)
    for path in ("/api/cart/", "/api/orders/"):
        response, _ = env.measure(path)
        assert "secret-" not in response.text, f"{path} leaks a source file path"
        assert "file_url" not in response.text, f"{path} leaks file_url"


def test_cart_lines_still_carry_what_the_page_needs(env):
    env.fill_cart(env.make_products(1))
    response, _ = env.measure("/api/cart/")
    item = response.json()["items"][0]
    product = item["product"]
    assert item["selected_config"] == {"purchase_type": "digital"}
    for key in ("id", "title", "price", "base_print_price", "currency", "is_mode_2_active", "is_mode_3_active",
                "is_mode_4_active", "digital_download_enabled", "media"):
        assert key in product, key
    assert product["media"][0]["media_url"] == "/m0.png"


def test_orders_come_newest_first_with_item_images(env):
    products = env.make_products(1)
    env.fill_orders(products, 3)
    response, _ = env.measure("/api/orders/")
    orders = response.json()
    assert [o["id"] for o in orders] == sorted((o["id"] for o in orders), reverse=True)
    assert orders[0]["items"][0]["product"]["media"][0]["media_url"] == "/m0.png"
    assert orders[0]["items"][0]["product"]["title"] == "Model 0"
