"""Offline payment boundary regressions; no Stripe account or live DB is used."""
from datetime import datetime
from types import SimpleNamespace as NS
import hashlib
import hmac
import json
import time

import pytest
from fastapi import HTTPException


def payments():
    from app.services import payments as service
    return service


def product(**changes):
    values = dict(id=1, title="Model", currency="INR", price=29.005,
                  base_print_price=120.50, is_mode_2_active=True,
                  digital_download_enabled=True, is_mode_3_active=True,
                  status="published", safety_review_status="approved")
    values.update(changes)
    return NS(**values)


def line(kind="digital", **changes):
    return NS(product=product(**changes), product_id=1, quantity=2,
              selected_config={"purchase_type": kind})


def order(**changes):
    values = dict(id=7, customer_id=3, amount_minor=5802, currency="INR",
                  stripe_payment_intent_id="pi_bound", status="pending_payment",
                  payment_verified_at=None, status_history=[])
    values.update(changes)
    return NS(**values)


def intent(**changes):
    values = dict(id="pi_bound", amount=5802, amount_received=5802, currency="inr",
                  status="succeeded", metadata={"order_id": "7", "customer_id": "3"})
    values.update(changes)
    return values


def test_decimal_unit_rounding_and_selected_format_price():
    service = payments()
    assert service.minor_units("29.005") == 2901
    assert service.price_line(line())["line_minor"] == 5802
    assert service.price_line(line("physical"))["line_minor"] == 24100


@pytest.mark.parametrize("kind,changes", [
    ("digital", {"currency": "USD"}),
    ("digital", {"digital_download_enabled": False}),
    ("physical", {"base_print_price": 0}),
    (None, {}), ("mode_2", {}),
    ("digital", {"status": "draft"}),
])
def test_checkout_rejects_unavailable_or_ambiguous_lines(kind, changes):
    with pytest.raises(HTTPException):
        payments().price_line(line(kind, **changes))


def test_digital_has_no_shipping_and_physical_needs_configured_price(monkeypatch):
    service = payments()
    monkeypatch.setattr(service.settings, "CHECKOUT_SHIPPING_INR", None)
    assert service.shipping_minor(False, "standard") == 0
    with pytest.raises(HTTPException) as failure:
        service.shipping_minor(True, "standard")
    assert failure.value.status_code == 503
    monkeypatch.setattr(service.settings, "CHECKOUT_SHIPPING_INR", "79.50")
    assert service.shipping_minor(True, "standard") == 7950


@pytest.mark.parametrize("changes", [
    {"amount": 5801}, {"amount_received": 0}, {"currency": "usd"},
    {"id": "pi_other"}, {"metadata": {"order_id": "8", "customer_id": "3"}},
    {"metadata": {"order_id": "7", "customer_id": "4"}},
    {"status": "processing"},
])
def test_success_must_match_entire_order_binding(changes):
    pending = order()
    with pytest.raises(HTTPException):
        payments().settle_payment(pending, intent(**changes), "payment_intent.succeeded")
    assert pending.status == "pending_payment"
    assert pending.payment_verified_at is None


def test_duplicate_and_out_of_order_payment_events_do_not_regress_paid_order():
    service = payments()
    pending = order()
    assert service.settle_payment(pending, intent(), "payment_intent.succeeded")
    verified = pending.payment_verified_at
    assert pending.status == "paid"
    assert not service.settle_payment(pending, intent(), "payment_intent.succeeded")
    assert not service.settle_payment(pending, intent(status="requires_payment_method"), "payment_intent.payment_failed")
    assert pending.status == "paid"
    assert pending.payment_verified_at == verified
    assert len(pending.status_history) == 1


def test_failure_can_be_retried_then_settled():
    pending = order()
    payments().settle_payment(pending, intent(status="requires_payment_method"), "payment_intent.payment_failed")
    assert pending.status == "pending_payment"
    payments().settle_payment(pending, intent(), "payment_intent.succeeded")
    assert pending.status == "paid"


@pytest.mark.parametrize("key", [None, "sk_test_fake", "sk_test_real_example"])
def test_production_never_falls_back_to_mock_or_test_charge(monkeypatch, key):
    service = payments()
    monkeypatch.setattr(service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(service.settings, "STRIPE_SECRET_KEY", key)
    with pytest.raises(HTTPException) as failure:
        service.payment_key()
    assert failure.value.status_code == 503


def test_webhook_requires_real_signature_and_raw_payload(monkeypatch):
    service = payments()
    monkeypatch.setattr(service.settings, "STRIPE_WEBHOOK_SECRET", "whsec_offline_test")
    monkeypatch.setattr(service.settings, "ENVIRONMENT", "development")
    payload = json.dumps({"object": "event", "id": "evt_1", "type": "payment_intent.succeeded", "livemode": False, "data": {"object": intent()}}).encode()
    with pytest.raises(HTTPException) as failure:
        service.verify_webhook(payload, "t=1,v1=not-a-signature")
    assert failure.value.status_code == 400
    timestamp = int(time.time())
    signature = hmac.new(b"whsec_offline_test", str(timestamp).encode() + b"." + payload, hashlib.sha256).hexdigest()
    event = service.verify_webhook(payload, f"t={timestamp},v1={signature}")
    assert event["id"] == "evt_1"


def test_indian_address_requires_real_contact_and_state():
    service = payments()
    address = dict(name="A Customer", street="10 Lake Road", city="Pune", state="Maharashtra",
                   zip="411001", country="IN", phone="9876543210")
    assert service.validate_address(address, "buyer@example.com")["phone"] == "9876543210"
    for changes in ({"phone": ""}, {"country": "US"}, {"zip": "000000"}, {"state": ""}):
        with pytest.raises(HTTPException):
            service.validate_address({**address, **changes}, "buyer@example.com")


@pytest.fixture
def payment_db(monkeypatch):
    # Real relational persistence, offline. PostgreSQL row-lock contention is
    # separately exercised in deployment integration checks, not by SQLite.
    import importlib
    import pkgutil
    import app.models
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.core.database import Base
    from app.core import invoice
    # Receipt rendering is tested separately; persistence tests must not leave
    # files in the application's actual uploads directory.
    monkeypatch.setattr(invoice, "generate_invoice_pdf", lambda *a, **k: "/uploads/invoices/test-receipt.pdf")
    for module in pkgutil.iter_modules(app.models.__path__):
        importlib.import_module(f"app.models.{module.name}")
    try:
        import sqlite3 as sqlite
    except ModuleNotFoundError:
        # This Windows Python install includes the native driver but omits
        # the stdlib wrapper. Use that same driver with its DB-API metadata.
        import _sqlite3
        sqlite = NS(**vars(_sqlite3))
        sqlite.paramstyle = "qmark"
        sqlite.sqlite_version_info = tuple(map(int, sqlite.sqlite_version.split(".")))
    engine = create_engine("sqlite://", module=sqlite)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        yield db


def seed_cart(db):
    from app.models.user import User
    from app.models.product import Product
    from app.models.cart import Cart, CartItem
    user = User(email="buyer@example.com", hashed_password="unused")
    db.add(user)
    db.flush()
    item = Product(title="Model", creator_id=user.id, currency="INR", price=29.005,
                   base_print_price=120.50, status="published", safety_review_status="approved",
                   is_mode_2_active=True, digital_download_enabled=True, is_mode_3_active=True)
    db.add(item)
    db.flush()
    cart = Cart(user_id=user.id)
    db.add(cart)
    db.flush()
    db.add(CartItem(cart_id=cart.id, product_id=item.id, quantity=2, selected_config={"purchase_type": "digital"}))
    db.commit()
    return user, item


def test_retry_after_provider_timeout_reuses_committed_snapshot(payment_db, monkeypatch):
    service = payments()
    from app.api.routers.checkout import CheckoutRequest
    from app.models.order import Order
    from app.models.cart import CartItem
    user, _ = seed_cart(payment_db)
    monkeypatch.setattr(service.settings, "STRIPE_SECRET_KEY", "sk_test_offline_fixture_only")
    monkeypatch.setattr(service.settings, "STRIPE_WEBHOOK_SECRET", "whsec_offline")
    calls = []
    def create(**args):
        snapshot = payment_db.query(Order).one()
        # The durable amount, not a mutable cart, is sent to the provider.
        assert snapshot.status == "pending_payment"
        assert args["amount"] == 5802
        assert args["currency"] == "inr"
        calls.append(args["idempotency_key"])
        if len(calls) == 1:
            raise service.stripe.APIConnectionError("offline timeout")
        return intent(id="pi_created", amount=5802, client_secret="secret_fixture",
                      metadata={"order_id": str(snapshot.id), "customer_id": str(user.id)})
    monkeypatch.setattr(service.stripe.PaymentIntent, "create", create)
    request = CheckoutRequest(idempotency_key="stable-attempt")
    with pytest.raises(HTTPException) as failure:
        service.start_payment(payment_db, user, request)
    assert failure.value.status_code == 503
    assert payment_db.query(Order).count() == 1
    uncertain = payment_db.query(Order).one()
    # The provider may have created an intent despite the timeout. Cancelling
    # locally would release inventory while that intent could still settle.
    with pytest.raises(HTTPException) as cancellation:
        service.cancel_pending_order(payment_db, uncertain)
    assert cancellation.value.status_code == 409
    assert uncertain.status == "pending_payment"
    result = service.start_payment(payment_db, user, request)
    assert result["total"] == 58.02
    assert result["shipping_cost"] == 0
    assert calls == [f"checkout-order-{result['order_id']}"] * 2
    assert payment_db.query(Order).count() == 1
    assert payment_db.query(CartItem).count() == 0
    assert payment_db.query(Order).one().payment_verified_at is None


def test_persisted_duplicate_webhooks_and_late_failure(payment_db):
    service = payments()
    from app.api.routers.checkout import CheckoutRequest
    from app.models.payment import PaymentEvent
    user, _ = seed_cart(payment_db)
    snapshot = service.prepare_order(payment_db, user, CheckoutRequest(idempotency_key="webhook-attempt"))
    snapshot.stripe_payment_intent_id = "pi_bound"
    payment_db.commit()
    payload = intent(metadata={"order_id": str(snapshot.id), "customer_id": str(user.id)})
    event = {"id": "evt_success", "type": "payment_intent.succeeded", "data": {"object": payload}}
    service.process_event(payment_db, event)
    service.process_event(payment_db, event)
    service.process_event(payment_db, {"id": "evt_failure", "type": "payment_intent.payment_failed", "data": {"object": payload}})
    assert snapshot.status == "paid"
    assert snapshot.payment_verified_at is not None
    assert payment_db.query(PaymentEvent).count() == 2
    assert len(snapshot.status_history) == 1


def test_cart_keeps_digital_and_physical_variants_separate(payment_db):
    from app.api.routers.cart import add_cart_item
    from app.schemas.cart import CartItemCreate
    from app.models.cart import CartItem
    user, item = seed_cart(payment_db)
    add_cart_item(CartItemCreate(product_id=item.id, selected_config={"purchase_type": "physical"}), payment_db, user)
    add_cart_item(CartItemCreate(product_id=item.id, selected_config={"purchase_type": "digital"}), payment_db, user)
    rows = payment_db.query(CartItem).all()
    assert sorted((row.selected_config["purchase_type"], row.quantity) for row in rows) == [("digital", 3), ("physical", 1)]


def test_legacy_customer_confirmation_cannot_mark_paid():
    from app.api.routers.orders import confirm_order
    from app.schemas.order import OrderCreate
    with pytest.raises(HTTPException) as failure:
        confirm_order(OrderCreate(shipping_address={}), current_user=NS(id=1))
    assert failure.value.status_code == 410


def test_new_entitlements_require_verified_payment_and_digital_purchase(payment_db):
    from app.services.entitlements import has_purchased
    from app.api.routers.checkout import CheckoutRequest
    user, product = seed_cart(payment_db)
    snapshot = payments().prepare_order(payment_db, user, CheckoutRequest(idempotency_key="entitlement-attempt"))
    snapshot.status = "paid"  # an imported/unverified state must not grant access
    payment_db.commit()
    assert not has_purchased(payment_db, user.id, product.id)
    snapshot.payment_verified_at = datetime.utcnow()
    payment_db.commit()
    assert has_purchased(payment_db, user.id, product.id, digital_only=True)

    snapshot.items[0].selected_config = {"purchase_type": "physical"}
    payment_db.commit()
    assert has_purchased(payment_db, user.id, product.id)
    assert not has_purchased(payment_db, user.id, product.id, digital_only=True)
    snapshot.currency = "USD"
    snapshot.payment_verified_at = None
    payment_db.commit()
    assert has_purchased(payment_db, user.id, product.id, digital_only=True)


def test_resume_only_retrieves_own_existing_payment(payment_db, monkeypatch):
    service = payments()
    from app.api.routers.checkout import CheckoutRequest
    user, _ = seed_cart(payment_db)
    snapshot = service.prepare_order(payment_db, user, CheckoutRequest(idempotency_key="resume-attempt"))
    snapshot.stripe_payment_intent_id = "pi_bound"
    payment_db.commit()
    monkeypatch.setattr(service.settings, "STRIPE_SECRET_KEY", "sk_test_offline_fixture_only")
    monkeypatch.setattr(service.settings, "STRIPE_WEBHOOK_SECRET", "whsec_offline")
    def retrieve(intent_id, **kwargs):
        assert intent_id == "pi_bound"
        return intent(client_secret="secret_existing", metadata={"order_id": str(snapshot.id), "customer_id": str(user.id)})
    monkeypatch.setattr(service.stripe.PaymentIntent, "retrieve", retrieve)
    response = service.resume_payment(payment_db, user, snapshot.id)
    assert response["client_secret"] == "secret_existing"
    assert response["payment_status"] == "succeeded"
    assert response["items"] == [{"title": "Model", "purchase_type": "digital", "quantity": 2, "unit_price": 29.01}]
    with pytest.raises(HTTPException) as failure:
        service.resume_payment(payment_db, NS(id=user.id + 1), snapshot.id)
    assert failure.value.status_code == 404


def test_receipt_uses_recorded_currency_and_shows_discount(monkeypatch):
    from app.core import invoice
    from reportlab.platypus import Table
    stories = []
    monkeypatch.setattr(invoice, "SimpleDocTemplate", lambda *a, **k: NS(build=stories.append))
    monkeypatch.setattr(invoice, "store_local_file", lambda path, folder, extension: "https://private.example/receipt.pdf", raising=False)
    receipt = invoice.generate_invoice_pdf(1, "Buyer <example>", [{"title": "Model", "quantity": 1, "price": 100}],
                                 100, 0, 90, currency="INR")
    assert receipt == "https://private.example/receipt.pdf"
    table = next(item for item in stories[0] if isinstance(item, Table))
    assert ["", "", "Discount:", "INR 10.00"] in table._cellvalues
    assert ["", "", "Total:", "INR 90.00"] in table._cellvalues
