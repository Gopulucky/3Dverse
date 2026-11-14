"""Offline payment boundary regressions; no Razorpay account or live DB is used."""
from datetime import datetime, timedelta
from types import SimpleNamespace as NS
import asyncio
import hashlib
import hmac
import json

import pytest
from fastapi import HTTPException

KEY_ID = "rzp_test_offlineFixture1"
KEY_SECRET = "offline_secret_fixture_only"
WEBHOOK_SECRET = "whsec_offline_test"


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
                  razorpay_order_id="order_bound", razorpay_payment_id=None, status="pending_payment",
                  payment_verified_at=None, status_history=[])
    values.update(changes)
    return NS(**values)


def payment(**changes):
    values = dict(id="pay_1", order_id="order_bound", amount=5802, currency="INR", status="captured")
    values.update(changes)
    return values


def webhook_event(event_type="payment.captured", entity=None, event_id="evt_1"):
    return {"id": event_id, "event": event_type, "payload": {"payment": {"entity": entity or payment()}}}


def signed(secret, payload: bytes) -> str:
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def checkout_signature(order_id, payment_id, secret=KEY_SECRET):
    return signed(secret, f"{order_id}|{payment_id}".encode())


@pytest.fixture
def configured(monkeypatch):
    service = payments()
    monkeypatch.setattr(service.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(service.settings, "RAZORPAY_KEY_ID", KEY_ID)
    monkeypatch.setattr(service.settings, "RAZORPAY_KEY_SECRET", KEY_SECRET)
    monkeypatch.setattr(service.settings, "RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET)
    return service


class FakeRazorpay:
    """Stands in for the Razorpay REST API. Every call goes through service._request."""

    def __init__(self, service):
        self.service = service
        self.orders, self.payments, self.calls, self.refunds = {}, {}, [], []
        self.fail_next_create = False

    def __call__(self, method, path, *, json=None, params=None):
        self.calls.append((method, path))
        parts = path.strip("/").split("/")
        if (method, parts) == ("POST", ["orders"]):
            if self.fail_next_create:
                self.fail_next_create = False
                raise self.service.ProviderError("offline timeout")
            created = {"id": f"order_{len(self.orders) + 1}", "status": "created", "amount_paid": 0, **json}
            self.orders[created["id"]] = created
            return created
        if (method, parts) == ("GET", ["orders"]):
            wanted = (params or {}).get("receipt")
            return {"items": [o for o in self.orders.values() if o.get("receipt") == wanted]}
        if method == "GET" and parts[0] == "orders" and len(parts) == 2:
            return self.orders[parts[1]]
        if method == "GET" and parts[0] == "orders" and parts[2:] == ["payments"]:
            return {"items": [p for p in self.payments.values() if p["order_id"] == parts[1]]}
        if method == "GET" and parts[0] == "payments" and len(parts) == 2:
            return self.payments[parts[1]]
        if method == "POST" and parts[0] == "payments" and parts[2:] == ["refund"]:
            self.refunds.append((parts[1], json))
            return {"id": "rfnd_1", "payment_id": parts[1], **json}
        raise AssertionError(f"unexpected provider call {method} {path}")


@pytest.fixture
def razorpay(configured, monkeypatch):
    fake = FakeRazorpay(configured)
    monkeypatch.setattr(configured, "_request", fake)
    return fake


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
    {"amount": 5801}, {"amount": 0}, {"currency": "USD"}, {"order_id": "order_other"},
])
def test_success_must_match_entire_order_binding(changes):
    pending = order()
    with pytest.raises(HTTPException):
        payments().settle_payment(pending, payment(**changes))
    assert pending.status == "pending_payment"
    assert pending.payment_verified_at is None


@pytest.mark.parametrize("status", ["created", "authorized", "failed"])
def test_only_a_captured_payment_marks_the_order_paid(status):
    pending = order()
    assert not payments().settle_payment(pending, payment(status=status))
    assert pending.status == "pending_payment"
    assert pending.payment_verified_at is None


def test_duplicate_and_out_of_order_payment_events_do_not_regress_paid_order():
    service = payments()
    pending = order()
    assert service.settle_payment(pending, payment())
    verified = pending.payment_verified_at
    assert pending.status == "paid"
    assert pending.razorpay_payment_id == "pay_1"
    assert not service.settle_payment(pending, payment())
    assert not service.settle_payment(pending, payment(id="pay_2", status="failed"))
    assert pending.status == "paid"
    assert pending.payment_verified_at == verified
    assert pending.razorpay_payment_id == "pay_1"
    assert len(pending.status_history) == 1


def test_failure_can_be_retried_then_settled():
    pending = order()
    payments().settle_payment(pending, payment(status="failed"))
    assert pending.status == "pending_payment"
    payments().settle_payment(pending, payment(id="pay_2"))
    assert pending.status == "paid"


@pytest.mark.parametrize("key_id,key_secret,webhook", [
    (None, KEY_SECRET, WEBHOOK_SECRET),
    (KEY_ID, None, WEBHOOK_SECRET),
    ("rzp_test_fakefixture1", KEY_SECRET, WEBHOOK_SECRET),
    (KEY_ID, "short", WEBHOOK_SECRET),
    (KEY_ID, KEY_SECRET, None),
    (KEY_ID, KEY_SECRET, "short"),
    ("sk_test_not_razorpay_key1", KEY_SECRET, WEBHOOK_SECRET),
])
def test_unconfigured_or_malformed_credentials_disable_checkout(monkeypatch, key_id, key_secret, webhook):
    service = payments()
    monkeypatch.setattr(service.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(service.settings, "RAZORPAY_KEY_ID", key_id)
    monkeypatch.setattr(service.settings, "RAZORPAY_KEY_SECRET", key_secret)
    monkeypatch.setattr(service.settings, "RAZORPAY_WEBHOOK_SECRET", webhook)
    with pytest.raises(HTTPException) as failure:
        service.credentials()
    assert failure.value.status_code == 503


def test_production_never_accepts_test_keys_and_development_never_accepts_live(configured, monkeypatch):
    monkeypatch.setattr(configured.settings, "ENVIRONMENT", "production")
    with pytest.raises(HTTPException) as failure:
        configured.credentials()
    assert failure.value.status_code == 503
    monkeypatch.setattr(configured.settings, "RAZORPAY_KEY_ID", "rzp_live_offlineFixture1")
    assert configured.credentials() == ("rzp_live_offlineFixture1", KEY_SECRET)
    monkeypatch.setattr(configured.settings, "ENVIRONMENT", "development")
    with pytest.raises(HTTPException):
        configured.credentials()


def test_webhook_requires_real_signature_over_the_raw_payload(configured):
    payload = json.dumps(webhook_event()).encode()
    for bad in (None, "", "not-a-signature", signed("another-secret", payload)):
        with pytest.raises(HTTPException) as failure:
            configured.verify_webhook(payload, bad, "evt_header")
        assert failure.value.status_code == 400
    with pytest.raises(HTTPException):
        configured.verify_webhook(payload + b" ", signed(WEBHOOK_SECRET, payload), "evt_header")
    event = configured.verify_webhook(payload, signed(WEBHOOK_SECRET, payload), "evt_header")
    assert event["event"] == "payment.captured"
    assert event["id"] == "evt_header"


def test_webhook_without_an_event_id_header_still_gets_a_stable_replay_key(configured):
    payload = json.dumps(webhook_event()).encode()
    first = configured.verify_webhook(payload, signed(WEBHOOK_SECRET, payload), None)
    second = configured.verify_webhook(payload, signed(WEBHOOK_SECRET, payload), "")
    assert first["id"] == second["id"] and first["id"]


def test_webhook_rejects_non_json_and_unconfigured_secret(configured, monkeypatch):
    garbage = b"not json"
    with pytest.raises(HTTPException) as failure:
        configured.verify_webhook(garbage, signed(WEBHOOK_SECRET, garbage), "evt")
    assert failure.value.status_code == 400
    monkeypatch.setattr(configured.settings, "RAZORPAY_WEBHOOK_SECRET", None)
    with pytest.raises(HTTPException) as failure:
        configured.verify_webhook(garbage, "x", "evt")
    assert failure.value.status_code == 503


def test_checkout_signature_covers_order_and_payment_ids(configured):
    good = checkout_signature("order_bound", "pay_1")
    assert configured.checkout_signature_valid("order_bound", "pay_1", good)
    assert not configured.checkout_signature_valid("order_bound", "pay_2", good)
    assert not configured.checkout_signature_valid("order_other", "pay_1", good)
    assert not configured.checkout_signature_valid("order_bound", "pay_1", "")
    assert not configured.checkout_signature_valid("order_bound", "pay_1", checkout_signature("order_bound", "pay_1", "wrong-secret-value"))


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


def bound_order(db, service, user, key="bound-attempt", provider_id="order_bound"):
    from app.api.routers.checkout import CheckoutRequest
    snapshot = service.prepare_order(db, user, CheckoutRequest(idempotency_key=key))
    snapshot.razorpay_order_id = provider_id
    db.commit()
    return snapshot


def test_retry_after_provider_timeout_reuses_committed_snapshot(payment_db, razorpay):
    service = payments()
    from app.api.routers.checkout import CheckoutRequest
    from app.models.order import Order
    from app.models.cart import CartItem
    user, _ = seed_cart(payment_db)
    razorpay.fail_next_create = True
    request = CheckoutRequest(idempotency_key="stable-attempt")
    with pytest.raises(HTTPException) as failure:
        service.start_payment(payment_db, user, request)
    assert failure.value.status_code == 503
    assert payment_db.query(Order).count() == 1
    uncertain = payment_db.query(Order).one()
    # The provider may have created an order despite the timeout. Cancelling
    # locally would release inventory while that order could still settle.
    with pytest.raises(HTTPException) as cancellation:
        service.cancel_pending_order(payment_db, uncertain)
    assert cancellation.value.status_code == 409
    assert uncertain.status == "pending_payment"
    result = service.start_payment(payment_db, user, request)
    created = next(iter(razorpay.orders.values()))
    # The durable amount, not a mutable cart, is what the provider is asked to collect.
    assert created["amount"] == 5802 and created["currency"] == "INR"
    assert created["receipt"] == f"3dv-{result['order_id']}"
    assert created["notes"] == {"order_id": str(result["order_id"]), "customer_id": str(user.id)}
    assert result["razorpay_order_id"] == created["id"]
    assert result["key_id"] == KEY_ID and result["amount_minor"] == 5802
    assert KEY_SECRET not in json.dumps(result, default=str)
    assert result["total"] == 58.02 and result["shipping_cost"] == 0
    assert result["payment_status"] == "created"
    assert payment_db.query(Order).count() == 1
    assert payment_db.query(CartItem).count() == 1  # the cart is kept until payment is confirmed
    assert payment_db.query(Order).one().payment_verified_at is None


def test_retry_adopts_a_provider_order_that_was_created_before_the_timeout(payment_db, razorpay):
    service = payments()
    from app.api.routers.checkout import CheckoutRequest
    user, _ = seed_cart(payment_db)
    request = CheckoutRequest(idempotency_key="adopt-attempt")
    snapshot = service.prepare_order(payment_db, user, request)
    razorpay.orders["order_orphan"] = {"id": "order_orphan", "status": "created", "amount_paid": 0, "amount": 5802,
        "currency": "INR", "receipt": f"3dv-{snapshot.id}", "notes": {"order_id": str(snapshot.id), "customer_id": str(user.id)}}
    snapshot.status_history = [{"status": "payment_preparing"}]
    payment_db.commit()
    result = service.start_payment(payment_db, user, request)
    assert result["razorpay_order_id"] == "order_orphan"
    assert ("POST", "/orders") not in razorpay.calls


def test_resume_never_binds_a_provider_order_that_disagrees_with_the_snapshot(payment_db, razorpay):
    service = payments()
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user)
    razorpay.orders["order_bound"] = {"id": "order_bound", "status": "created", "amount_paid": 0, "amount": 1,
        "currency": "INR", "receipt": f"3dv-{snapshot.id}", "notes": {"order_id": str(snapshot.id), "customer_id": str(user.id)}}
    with pytest.raises(HTTPException) as failure:
        service.resume_payment(payment_db, user, snapshot.id)
    assert failure.value.status_code == 400


def test_persisted_duplicate_webhooks_and_late_failure(payment_db):
    service = payments()
    from app.models.payment import PaymentEvent
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user)
    service.process_event(payment_db, webhook_event("payment.captured", event_id="evt_success"))
    service.process_event(payment_db, webhook_event("payment.captured", event_id="evt_success"))
    service.process_event(payment_db, webhook_event("order.paid", event_id="evt_order_paid"))
    service.process_event(payment_db, webhook_event("payment.failed", payment(id="pay_2", status="failed"), "evt_failure"))
    assert snapshot.status == "paid"
    assert snapshot.payment_verified_at is not None
    assert snapshot.razorpay_payment_id == "pay_1"
    assert payment_db.query(PaymentEvent).count() == 3
    assert len(snapshot.status_history) == 1


def test_webhook_for_a_payment_that_is_not_ours_is_acknowledged_and_ignored(payment_db):
    # The same Razorpay account may host a Payment Page (/support) or other products.
    service = payments()
    from app.models.payment import PaymentEvent
    result = service.process_event(payment_db, webhook_event(entity=payment(order_id="order_somebody_else")))
    assert result == {"received": True}
    assert payment_db.query(PaymentEvent).count() == 0
    assert service.process_event(payment_db, webhook_event(entity=payment(order_id=None))) == {"received": True}
    assert service.process_event(payment_db, {"id": "evt_x", "event": "refund.processed", "payload": {}}) == {"received": True}


def test_webhook_with_wrong_amount_for_our_order_is_rejected_not_settled(payment_db):
    service = payments()
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user)
    with pytest.raises(HTTPException) as failure:
        service.process_event(payment_db, webhook_event(entity=payment(amount=100)))
    assert failure.value.status_code == 400
    assert snapshot.status == "pending_payment" and snapshot.payment_verified_at is None


def test_webhook_route_reads_razorpay_headers_and_acknowledges(configured, payment_db):
    from app.api.routers.checkout import payment_webhook
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, payments(), user)
    body = json.dumps(webhook_event("payment.captured", event_id="unused")).encode()

    def request_with(headers):
        class StubRequest:
            async def body(self):
                return body
        stub = StubRequest()
        stub.headers = headers
        return stub

    genuine = {"x-razorpay-signature": signed(WEBHOOK_SECRET, body), "x-razorpay-event-id": "evt_route"}
    assert asyncio.run(payment_webhook(request_with(genuine), payment_db)) == {"received": True}
    assert snapshot.status == "paid"
    with pytest.raises(HTTPException) as failure:
        asyncio.run(payment_webhook(request_with({"x-razorpay-signature": "forged"}), payment_db))
    assert failure.value.status_code == 400


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


def test_resume_only_retrieves_own_existing_payment(payment_db, razorpay):
    service = payments()
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user)
    razorpay.orders["order_bound"] = {"id": "order_bound", "status": "attempted", "amount_paid": 0, "amount": 5802,
        "currency": "INR", "receipt": f"3dv-{snapshot.id}", "notes": {"order_id": str(snapshot.id), "customer_id": str(user.id)}}
    response = service.resume_payment(payment_db, user, snapshot.id)
    assert response["razorpay_order_id"] == "order_bound"
    assert response["payment_status"] == "attempted"
    assert response["items"] == [{"title": "Model", "purchase_type": "digital", "quantity": 2, "unit_price": 29.01}]
    with pytest.raises(HTTPException) as failure:
        service.resume_payment(payment_db, NS(id=user.id + 1), snapshot.id)
    assert failure.value.status_code == 404


def test_resume_recovers_a_payment_whose_webhook_never_arrived(payment_db, razorpay):
    service = payments()
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user)
    razorpay.orders["order_bound"] = {"id": "order_bound", "status": "paid", "amount_paid": 5802, "amount": 5802,
        "currency": "INR", "receipt": f"3dv-{snapshot.id}", "notes": {"order_id": str(snapshot.id), "customer_id": str(user.id)}}
    razorpay.payments["pay_1"] = payment()
    with pytest.raises(HTTPException) as failure:  # now settled: nothing left to pay
        service.resume_payment(payment_db, user, snapshot.id)
    assert failure.value.status_code == 409
    assert snapshot.status == "paid" and snapshot.payment_verified_at is not None


def test_verify_checkout_marks_paid_only_after_signature_and_provider_confirmation(payment_db, razorpay):
    service = payments()
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user)
    razorpay.payments["pay_1"] = payment()
    sig = checkout_signature("order_bound", "pay_1")
    result = service.verify_checkout(payment_db, user, snapshot.id, "order_bound", "pay_1", sig)
    assert result == {"order_id": snapshot.id, "status": "paid"}
    assert snapshot.status == "paid" and snapshot.razorpay_payment_id == "pay_1"
    assert snapshot.invoice_url == "/uploads/invoices/test-receipt.pdf"
    # A repeated confirmation is harmless.
    assert service.verify_checkout(payment_db, user, snapshot.id, "order_bound", "pay_1", sig)["status"] == "paid"
    assert len(snapshot.status_history) == 1


def test_verify_checkout_rejects_forged_or_foreign_confirmations(payment_db, razorpay):
    service = payments()
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user)
    razorpay.payments["pay_1"] = payment()
    good = checkout_signature("order_bound", "pay_1")
    for args in (("order_bound", "pay_1", "forged"), ("order_other", "pay_1", checkout_signature("order_other", "pay_1"))):
        with pytest.raises(HTTPException) as failure:
            service.verify_checkout(payment_db, user, snapshot.id, *args)
        assert failure.value.status_code == 400
    assert ("GET", "/payments/pay_1") not in razorpay.calls  # never asks the provider about unsigned input
    with pytest.raises(HTTPException) as failure:
        service.verify_checkout(payment_db, NS(id=user.id + 1), snapshot.id, "order_bound", "pay_1", good)
    assert failure.value.status_code == 404
    # A genuinely signed payment that belongs to a different provider order is not accepted.
    razorpay.payments["pay_9"] = payment(id="pay_9", order_id="order_unrelated")
    with pytest.raises(HTTPException) as failure:
        service.verify_checkout(payment_db, user, snapshot.id, "order_bound", "pay_9", checkout_signature("order_bound", "pay_9"))
    assert failure.value.status_code == 400
    assert snapshot.status == "pending_payment" and snapshot.payment_verified_at is None


def test_verify_checkout_leaves_an_uncaptured_payment_pending_for_the_webhook(payment_db, razorpay):
    service = payments()
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user)
    razorpay.payments["pay_1"] = payment(status="authorized")
    result = service.verify_checkout(payment_db, user, snapshot.id, "order_bound", "pay_1", checkout_signature("order_bound", "pay_1"))
    assert result == {"order_id": snapshot.id, "status": "pending"}
    assert snapshot.status == "pending_payment" and snapshot.payment_verified_at is None


def test_cancel_refuses_while_a_payment_is_in_flight_and_releases_otherwise(payment_db, razorpay):
    service = payments()
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user)
    razorpay.payments["pay_1"] = payment(status="authorized")
    with pytest.raises(HTTPException) as failure:
        service.cancel_pending_order(payment_db, snapshot)
    assert failure.value.status_code == 409 and snapshot.status == "pending_payment"
    razorpay.payments["pay_1"] = payment(status="failed")
    service.cancel_pending_order(payment_db, snapshot)
    assert snapshot.status == "cancelled"


def test_cancel_settles_instead_when_the_payment_had_already_been_captured(payment_db, razorpay):
    service = payments()
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user)
    razorpay.payments["pay_1"] = payment()
    with pytest.raises(HTTPException) as failure:
        service.cancel_pending_order(payment_db, snapshot)
    assert failure.value.status_code == 409
    assert snapshot.status == "paid"


def test_cancel_with_unreachable_provider_keeps_the_order_payable(payment_db, razorpay, monkeypatch):
    service = payments()
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user)
    def down(*args, **kwargs):
        raise service.ProviderError("offline")
    monkeypatch.setattr(service, "_request", down)
    with pytest.raises(HTTPException) as failure:
        service.cancel_pending_order(payment_db, snapshot)
    assert failure.value.status_code == 409 and snapshot.status == "pending_payment"


def test_money_captured_for_a_cancelled_order_is_refunded_not_stranded(payment_db, razorpay):
    service = payments()
    from app.models.payment import PaymentEvent
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user)
    service.cancel_pending_order(payment_db, snapshot)
    payment_db.commit()
    assert snapshot.status == "cancelled"
    service.process_event(payment_db, webhook_event("payment.captured", event_id="evt_late"))
    assert razorpay.refunds == [("pay_1", {"amount": 5802, "notes": {"order_id": str(snapshot.id), "reason": "order was cancelled before payment"}})]
    assert snapshot.status == "cancelled" and snapshot.payment_verified_at is None
    assert payment_db.query(PaymentEvent).count() == 1
    service.process_event(payment_db, webhook_event("payment.captured", event_id="evt_late"))
    service.process_event(payment_db, webhook_event("order.paid", event_id="evt_late_2"))
    assert len(razorpay.refunds) == 1  # replays and the sibling event never refund twice


def test_failed_refund_is_retried_by_the_provider_instead_of_swallowed(payment_db, razorpay, monkeypatch):
    service = payments()
    from app.models.payment import PaymentEvent
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user)
    service.cancel_pending_order(payment_db, snapshot)
    payment_db.commit()
    real = razorpay
    def flaky(method, path, **kwargs):
        if path.endswith("/refund"):
            raise service.ProviderError("offline")
        return real(method, path, **kwargs)
    monkeypatch.setattr(service, "_request", flaky)
    with pytest.raises(HTTPException) as failure:
        service.process_event(payment_db, webhook_event("payment.captured", event_id="evt_late"))
    assert failure.value.status_code == 503
    assert payment_db.query(PaymentEvent).count() == 0  # not marked processed, so the retry runs again


# ---- Checkout hold: the cart is kept, one live hold per customer, expiry on demand ----

ADDRESS = dict(name="A Customer", street="10 Lake Road", city="Pune", state="Maharashtra",
               zip="411001", country="IN", phone="9876543210")


def start(db, user, key, **extra):
    from app.api.routers.checkout import CheckoutRequest
    return payments().start_payment(db, user, CheckoutRequest(idempotency_key=key, **extra))


def set_cart_quantity(db, quantity):
    from app.models.cart import CartItem
    db.query(CartItem).one().quantity = quantity
    db.commit()


def age(db, order_id, minutes=20):
    from app.models.order import Order
    db.get(Order, order_id).created_at = datetime.utcnow() - timedelta(minutes=minutes)
    db.commit()


def test_cart_survives_checkout_and_only_the_paid_quantity_leaves_it(payment_db, razorpay):
    service = payments()
    from app.models.cart import CartItem
    user, _ = seed_cart(payment_db)
    result = start(payment_db, user, "cart-stays-1")
    assert payment_db.query(CartItem).one().quantity == 2
    set_cart_quantity(payment_db, 3)  # the customer keeps shopping while the hold is open
    service.process_event(payment_db, webhook_event(entity=payment(order_id=result["razorpay_order_id"])))
    assert payment_db.query(CartItem).one().quantity == 1  # only the 2 that were paid for are gone


def test_paying_an_unchanged_cart_empties_it(payment_db, razorpay):
    from app.models.cart import CartItem
    user, _ = seed_cart(payment_db)
    result = start(payment_db, user, "cart-empties-1")
    payments().process_event(payment_db, webhook_event(entity=payment(order_id=result["razorpay_order_id"])))
    assert payment_db.query(CartItem).count() == 0


def test_second_checkout_with_the_same_cart_reuses_the_live_hold(payment_db, razorpay):
    from app.models.order import Order
    user, _ = seed_cart(payment_db)
    first = start(payment_db, user, "tab-one-key1")
    second = start(payment_db, user, "tab-two-key2")
    assert first["order_id"] == second["order_id"] and first["razorpay_order_id"] == second["razorpay_order_id"]
    assert payment_db.query(Order).count() == 1
    assert razorpay.calls.count(("POST", "/orders")) == 1


def test_changing_the_cart_replaces_the_hold(payment_db, razorpay):
    from app.models.order import Order
    user, _ = seed_cart(payment_db)
    first = start(payment_db, user, "first-attempt1")
    set_cart_quantity(payment_db, 3)
    second = start(payment_db, user, "second-attempt")
    assert second["order_id"] != first["order_id"] and second["amount_minor"] == 8703
    assert payment_db.get(Order, first["order_id"]).status == "cancelled"
    assert payment_db.get(Order, second["order_id"]).status == "pending_payment"


def test_replacing_a_hold_is_refused_while_a_payment_is_in_flight(payment_db, razorpay):
    from app.models.order import Order
    user, _ = seed_cart(payment_db)
    first = start(payment_db, user, "first-attempt1")
    razorpay.payments["pay_1"] = payment(order_id=first["razorpay_order_id"], status="authorized")
    set_cart_quantity(payment_db, 3)
    with pytest.raises(HTTPException) as failure:
        start(payment_db, user, "second-attempt")
    assert failure.value.status_code == 409
    assert payment_db.get(Order, first["order_id"]).status == "pending_payment"
    assert payment_db.query(Order).count() == 1


def test_expired_hold_returns_the_coupon_and_is_cancelled(payment_db, razorpay):
    service = payments()
    from app.models.coupon import Coupon
    from app.models.order import Order
    user, _ = seed_cart(payment_db)
    payment_db.add(Coupon(code="TEN", percent_off=10))
    payment_db.commit()
    result = start(payment_db, user, "coupon-attempt1", coupon_code="TEN")
    coupon, order = payment_db.query(Coupon).one(), payment_db.get(Order, result["order_id"])
    assert coupon.times_used == 1 and order.coupon_id == coupon.id
    assert service.expire_stale_holds(payment_db) == 0  # a fresh hold is left alone
    age(payment_db, order.id)
    assert service.expire_stale_holds(payment_db) == 1
    assert order.status == "cancelled" and coupon.times_used == 0
    assert order.status_history[-1]["note"] == "hold expired"


def test_expiry_settles_instead_when_razorpay_already_captured_the_payment(payment_db, razorpay):
    service = payments()
    from app.models.order import Order
    user, _ = seed_cart(payment_db)
    result = start(payment_db, user, "captured-attempt")
    razorpay.payments["pay_1"] = payment(order_id=result["razorpay_order_id"])
    age(payment_db, result["order_id"])
    assert service.expire_stale_holds(payment_db) == 0
    order = payment_db.get(Order, result["order_id"])
    assert order.status == "paid" and order.payment_verified_at is not None


def test_expiry_leaves_the_hold_alone_while_money_may_be_moving(payment_db, razorpay, monkeypatch):
    service = payments()
    from app.models.order import Order
    user, _ = seed_cart(payment_db)
    result = start(payment_db, user, "inflight-attempt")
    razorpay.payments["pay_1"] = payment(order_id=result["razorpay_order_id"], status="authorized")
    age(payment_db, result["order_id"])
    assert service.expire_stale_holds(payment_db) == 0
    assert payment_db.get(Order, result["order_id"]).status == "pending_payment"
    razorpay.payments.clear()
    def down(*args, **kwargs):
        raise service.ProviderError("offline")
    monkeypatch.setattr(service, "_request", down)
    assert service.expire_stale_holds(payment_db) == 0  # cannot confirm: try again later
    assert payment_db.get(Order, result["order_id"]).status == "pending_payment"


def test_expiry_releases_a_hold_that_never_reached_the_provider(payment_db, razorpay):
    service = payments()
    from app.models.order import Order
    user, _ = seed_cart(payment_db)
    snapshot = bound_order(payment_db, service, user, provider_id=None)
    age(payment_db, snapshot.id)
    assert service.expire_stale_holds(payment_db) == 1
    assert payment_db.get(Order, snapshot.id).status == "cancelled"


def test_a_stale_hold_on_the_last_units_does_not_block_the_next_buyer(payment_db, razorpay, monkeypatch):
    service = payments()
    monkeypatch.setattr(service.settings, "CHECKOUT_SHIPPING_INR", "60")
    from app.models.cart import Cart, CartItem
    from app.models.order import Order
    from app.models.product import Product
    from app.models.stock import StockItem
    from app.models.user import User
    seller = User(email="seller@example.com", hashed_password="unused")
    first_buyer, second_buyer = (User(email=f"buyer{n}@example.com", hashed_password="unused") for n in (1, 2))
    payment_db.add_all([seller, first_buyer, second_buyer])
    payment_db.flush()
    product = Product(title="Desk stand", creator_id=seller.id, currency="INR", price=0, base_print_price=100,
                      status="published", safety_review_status="approved", is_mode_3_active=True)
    payment_db.add(product)
    payment_db.flush()
    stock_row = StockItem(product_id=product.id, seller_id=seller.id, on_hand=2)
    payment_db.add(stock_row)
    for buyer in (first_buyer, second_buyer):
        cart = Cart(user_id=buyer.id)
        payment_db.add(cart)
        payment_db.flush()
        payment_db.add(CartItem(cart_id=cart.id, product_id=product.id, quantity=2, selected_config={"purchase_type": "physical"}))
    payment_db.commit()
    first = start(payment_db, first_buyer, "first-buyer-1", shipping_address=ADDRESS)
    with pytest.raises(HTTPException) as failure:  # the first buyer's hold is live, so the units really are taken
        start(payment_db, second_buyer, "second-buyer1", shipping_address=ADDRESS)
    assert failure.value.status_code == 409
    age(payment_db, first["order_id"])
    second = start(payment_db, second_buyer, "second-buyer1", shipping_address=ADDRESS)
    assert payment_db.get(Order, first["order_id"]).status == "cancelled"
    assert payment_db.get(Order, second["order_id"]).status == "pending_payment"
    assert stock_row.reserved == 2


# ---- API surface: hold endpoint, phone callback, Orders list, cart availability ----

def test_hold_endpoint_reports_a_live_hold_and_nothing_once_it_expires(payment_db, razorpay):
    from app.api.routers.checkout import get_hold
    user, _ = seed_cart(payment_db)
    assert get_hold(payment_db, user) == {"hold": None}
    result = start(payment_db, user, "hold-endpoint1")
    hold = get_hold(payment_db, user)["hold"]
    assert hold == {"order_id": result["order_id"], "hold_expires_at": result["hold_expires_at"],
                    "total": 58.02, "currency": "INR"}
    assert hold["hold_expires_at"].endswith("Z")
    age(payment_db, result["order_id"])
    assert get_hold(payment_db, user) == {"hold": None}


def callback_request(**fields):
    class StubRequest:
        async def form(self):
            return fields
    return StubRequest()


def test_phone_callback_verifies_with_razorpay_then_sends_the_customer_to_the_return_page(payment_db, razorpay):
    from app.api.routers.checkout import payment_callback
    from app.models.order import Order
    user, _ = seed_cart(payment_db)
    result = start(payment_db, user, "callback-attempt")
    razorpay.payments["pay_1"] = payment(order_id=result["razorpay_order_id"])
    fields = dict(razorpay_order_id=result["razorpay_order_id"], razorpay_payment_id="pay_1",
                  razorpay_signature=checkout_signature(result["razorpay_order_id"], "pay_1"))
    for _attempt in range(2):  # a replayed POST is harmless
        response = asyncio.run(payment_callback(callback_request(**fields), payment_db))
        assert response.status_code == 303
        assert response.headers["location"].endswith(f"/checkout/return?order_id={result['order_id']}")
    order = payment_db.get(Order, result["order_id"])
    assert order.status == "paid" and [e["status"] for e in order.status_history].count("paid") == 1


def test_phone_callback_ignores_forged_or_unknown_posts_without_reflecting_them(payment_db, razorpay):
    from app.api.routers.checkout import payment_callback
    from app.models.order import Order
    user, _ = seed_cart(payment_db)
    result = start(payment_db, user, "forged-callback")
    razorpay.payments["pay_1"] = payment(order_id=result["razorpay_order_id"])
    good = result["razorpay_order_id"]
    for fields in (dict(razorpay_order_id=good, razorpay_payment_id="pay_1", razorpay_signature="forged"),
                   dict(razorpay_order_id="order_unknown", razorpay_payment_id="pay_1",
                        razorpay_signature=checkout_signature("order_unknown", "pay_1")),
                   dict(razorpay_order_id="<script>", razorpay_payment_id="pay_1", razorpay_signature=""), {}):
        response = asyncio.run(payment_callback(callback_request(**fields), payment_db))
        assert response.status_code == 303
        assert response.headers["location"].endswith("/orders") and "script" not in response.headers["location"]
    assert payment_db.get(Order, result["order_id"]).status == "pending_payment"


def test_phone_callback_with_razorpay_unreachable_still_returns_the_customer_and_leaves_it_to_the_webhook(payment_db, razorpay, monkeypatch):
    from app.api.routers.checkout import payment_callback
    from app.models.order import Order
    service = payments()
    user, _ = seed_cart(payment_db)
    result = start(payment_db, user, "offline-callback")
    def down(*args, **kwargs):
        raise service.ProviderError("offline")
    monkeypatch.setattr(service, "_request", down)
    fields = dict(razorpay_order_id=result["razorpay_order_id"], razorpay_payment_id="pay_1",
                  razorpay_signature=checkout_signature(result["razorpay_order_id"], "pay_1"))
    response = asyncio.run(payment_callback(callback_request(**fields), payment_db))
    assert response.headers["location"].endswith(f"/checkout/return?order_id={result['order_id']}")
    assert payment_db.get(Order, result["order_id"]).status == "pending_payment"


def test_orders_list_hides_unpaid_attempts_but_keeps_real_orders(payment_db):
    from app.api.routers.orders import get_orders
    from app.models.order import Order
    user, _ = seed_cart(payment_db)
    def add(status, verified):
        order = Order(customer_id=user.id, status=status, currency="INR", amount_minor=100, total=1, subtotal=1,
                      payment_verified_at=datetime.utcnow() if verified else None)
        payment_db.add(order)
        payment_db.flush()
        return order.id
    hidden = [add("pending_payment", False), add("cancelled", False), add("pending", False), add("failed", False)]
    shown = [add("cancelled", True), add("paid", True), add("printing", False)]  # refunded-after-payment, paid, in progress
    payment_db.commit()
    assert sorted(order.id for order in get_orders(payment_db, user)) == sorted(shown)
    assert not set(hidden) & {order.id for order in get_orders(payment_db, user)}


def test_cart_lines_say_why_they_cannot_be_bought(payment_db):
    from app.api.routers.cart import load_cart
    from app.models.cart import CartItem
    from app.models.stock import StockItem
    user, product = seed_cart(payment_db)
    assert load_cart(payment_db, user.id).items[0].unavailable_reason is None
    product.status = "draft"
    payment_db.commit()
    assert load_cart(payment_db, user.id).items[0].unavailable_reason == "A product in your cart is no longer available"
    product.status = "published"
    payment_db.query(CartItem).one().selected_config = {"purchase_type": "physical"}
    stock_row = StockItem(product_id=product.id, seller_id=user.id, on_hand=1)
    payment_db.add(stock_row)
    payment_db.commit()
    assert load_cart(payment_db, user.id).items[0].unavailable_reason == "Only 1 left"
    stock_row.on_hand = 0
    payment_db.commit()
    assert load_cart(payment_db, user.id).items[0].unavailable_reason == "Out of stock"
    stock_row.on_hand = 5
    payment_db.commit()
    assert load_cart(payment_db, user.id).items[0].unavailable_reason is None


def test_the_celery_expiry_task_uses_the_same_release_rules(payment_db, monkeypatch):
    from app.worker import tasks
    calls = []
    monkeypatch.setattr(tasks, "SessionLocal", lambda: payment_db)
    monkeypatch.setattr(tasks.payments, "expire_stale_holds", lambda db, **kwargs: calls.append(kwargs) or 3)
    tasks.expire_pending_orders()
    assert calls == [{}]


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
