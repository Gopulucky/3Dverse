"""Funnel tracking: anonymous, per-channel events; the server alone records checkout and payment steps."""
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import app.main  # noqa: F401
from app.api.routers import funnel
from app.main import app
from app.schemas.funnel import EventBatch
from app.services import funnel as svc
from test_payments import payment, payment_db, payments, seed_cart  # noqa: F401 (fixtures)

ANON = "visitor_abc12345"


def batch(*events, anon_id=ANON):
    return EventBatch(anon_id=anon_id, events=list(events))


def test_a_valid_batch_is_stored_with_its_source(payment_db):
    from app.models.funnel_event import FunnelEvent
    svc.track_events(batch(
        {"event": "landing", "source": "ig_story", "medium": "social", "campaign": "launch", "path": "/"},
        {"event": "product_view", "product_id": 5, "path": "/marketplace/5"}), payment_db)
    rows = payment_db.query(FunnelEvent).order_by(FunnelEvent.id).all()
    assert [(r.anon_id, r.event, r.product_id, r.source, r.medium, r.campaign) for r in rows] == [
        (ANON, "landing", None, "ig_story", "social", "launch"),
        (ANON, "product_view", 5, None, None, None)]


@pytest.mark.parametrize("event", ["paid", "checkout_started", "purchase", "", "LANDING"])
def test_browsers_cannot_send_server_only_or_unknown_events(event):
    with pytest.raises(ValidationError):
        batch({"event": event})


def test_batches_are_bounded():
    with pytest.raises(ValidationError):
        batch()
    batch(*[{"event": "landing"}] * 20)
    with pytest.raises(ValidationError):
        batch(*[{"event": "landing"}] * 21)


@pytest.mark.parametrize("anon_id", ["", "short", "has space in it!", "x" * 65, "<script>alert(1)</script>"])
def test_malformed_visitor_ids_are_rejected(anon_id):
    with pytest.raises(ValidationError):
        batch({"event": "landing"}, anon_id=anon_id)


@pytest.mark.parametrize("field,value", [("source", "a b"), ("source", "x" * 65), ("campaign", "<b>"), ("product_id", 0), ("path", "/" + "x" * 200)])
def test_event_fields_are_bounded_and_clean(field, value):
    with pytest.raises(ValidationError):
        batch({"event": "landing", field: value})


def test_the_events_endpoint_is_public_rate_limited_and_validates():
    route = next(r for r in funnel.router.routes if "POST" in r.methods)
    assert any("rate_limit" in getattr(d.dependency, "__qualname__", "") for d in route.dependencies)
    response = TestClient(app).post("/api/events", json={"anon_id": ANON, "events": [{"event": "paid"}]})
    assert response.status_code == 422


def test_the_funnel_report_requires_admin():
    assert TestClient(app).get("/api/events/admin/funnel").status_code in (401, 403)


def test_the_table_holds_no_personal_details():
    from app.models.funnel_event import FunnelEvent
    assert {c.name for c in FunnelEvent.__table__.columns} == {
        "id", "anon_id", "event", "product_id", "order_id", "source", "medium", "campaign", "path", "created_at"}


class Row:
    def __init__(self, anon_id, event, source=None, product_id=None):
        self.anon_id, self.event, self.source, self.product_id = anon_id, event, source, product_id


def test_the_report_counts_events_and_unique_visitors_by_step_source_and_product():
    rows = [
        Row("a", "landing", "ig"), Row("a", "landing", "ig"), Row("b", "landing", "ig"), Row("c", "landing"),
        Row("a", "product_view", "ig", 5), Row("a", "product_view", "ig", 5), Row("b", "product_view", "ig", 6),
        Row("a", "add_to_cart", "ig", 5), Row("a", "buy_now", "ig", 5), Row("a", "checkout_started", "ig"),
        Row("a", "paid", "ig"),
    ]
    report = svc.summarise_funnel(rows, {5: "Name stand", 6: "Keychain"})
    steps = {s["event"]: s for s in report["steps"]}
    assert (steps["landing"]["count"], steps["landing"]["visitors"]) == (4, 3)
    assert (steps["product_view"]["count"], steps["product_view"]["visitors"]) == (3, 2)
    assert (steps["paid"]["count"], steps["paid"]["visitors"]) == (1, 1)
    order = [s["event"] for s in report["steps"]]
    assert order.index("landing") < order.index("product_view") < order.index("add_to_cart") < order.index("checkout_started") < order.index("paid")
    by_source = {s["source"]: s for s in report["by_source"]}
    assert by_source["ig"]["visitors"] == 2 and by_source["ig"]["steps"]["paid"] == 1
    assert by_source["direct"]["visitors"] == 1 and by_source["direct"]["steps"]["landing"] == 1
    assert report["by_source"][0]["source"] == "ig"  # busiest channel first
    products = {p["product_id"]: p for p in report["by_product"]}
    assert products[5] == {"product_id": 5, "title": "Name stand", "views": 2, "carts": 1, "buys": 1}
    assert products[6]["views"] == 1 and products[6]["carts"] == 0


def test_an_empty_report_is_all_zeros():
    report = svc.summarise_funnel([], {})
    assert all(s["count"] == 0 and s["visitors"] == 0 for s in report["steps"])
    assert report["by_source"] == [] and report["by_product"] == []


def started_order(db, visitor=None):
    from app.api.routers.checkout import CheckoutRequest
    user, product = seed_cart(db)
    order = payments().prepare_order(db, user, CheckoutRequest(idempotency_key="funnel-attempt", visitor=visitor))
    return user, order


def visitor(**changes):
    return {"anon_id": ANON, "source": "whatsapp", "medium": "chat", "campaign": None, **changes}


def events_named(db, name):
    from app.models.funnel_event import FunnelEvent
    return db.query(FunnelEvent).filter(FunnelEvent.event == name).all()


def test_checkout_started_is_recorded_once_per_order_with_the_visitors_source(payment_db):
    _, order = started_order(payment_db, visitor())
    for _ in range(2):
        svc.record_checkout_started(payment_db, order.id, visitor())
    payment_db.commit()
    [row] = events_named(payment_db, "checkout_started")
    assert (row.order_id, row.anon_id, row.source, row.medium) == (order.id, ANON, "whatsapp", "chat")


def test_a_checkout_without_visitor_info_is_not_recorded(payment_db):
    _, order = started_order(payment_db)
    svc.record_checkout_started(payment_db, order.id, None)
    payment_db.commit()
    assert events_named(payment_db, "checkout_started") == []


def test_visitor_info_does_not_change_the_idempotency_fingerprint(payment_db):
    from app.api.routers.checkout import CheckoutRequest
    user, order = started_order(payment_db, visitor())
    again = payments().prepare_order(payment_db, user, CheckoutRequest(idempotency_key="funnel-attempt",
                                                                       visitor=visitor(source="instagram")))
    assert again.id == order.id


def test_payment_records_paid_with_the_checkout_visitors_source_once(payment_db):
    service = payments()
    _, order = started_order(payment_db, visitor())
    svc.record_checkout_started(payment_db, order.id, visitor())
    order.razorpay_order_id = "order_x"
    payment_db.commit()
    assert service.apply_payment(payment_db, order, payment(order_id="order_x", amount=order.amount_minor)) is True
    assert service.apply_payment(payment_db, order, payment(order_id="order_x", amount=order.amount_minor)) is False
    payment_db.commit()
    [row] = events_named(payment_db, "paid")
    assert (row.order_id, row.anon_id, row.source) == (order.id, ANON, "whatsapp")


def test_a_paid_order_with_no_known_visitor_is_still_counted(payment_db):
    service = payments()
    _, order = started_order(payment_db)
    order.razorpay_order_id = "order_x"
    payment_db.commit()
    service.apply_payment(payment_db, order, payment(order_id="order_x", amount=order.amount_minor))
    payment_db.commit()
    [row] = events_named(payment_db, "paid")
    assert row.source is None and row.anon_id == f"order-{order.id}"


def test_a_tracking_failure_never_blocks_a_payment(payment_db, monkeypatch):
    service = payments()
    _, order = started_order(payment_db)
    order.razorpay_order_id = "order_x"
    payment_db.commit()

    def explode(*args, **kwargs):
        raise RuntimeError("analytics down")
    monkeypatch.setattr(svc, "record_paid", explode)
    assert service.apply_payment(payment_db, order, payment(order_id="order_x", amount=order.amount_minor)) is True
    assert order.status in ("paid", "queued")
