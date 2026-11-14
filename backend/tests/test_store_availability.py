"""The storefront must not promise printed delivery or payment before they work.

The live site once showed "Secure payment" and "Delivered in India" while no
payment provider was configured and no listing offered a print. The homepage
now reports what is actually available, and these tests pin when each flag is on.
"""
import app.main  # noqa: F401  (registers every model, as in production)
from app.core.config import settings
from app.services import availability

LIVE = dict(STRIPE_SECRET_KEY="sk_test_" + "x" * 30, STRIPE_WEBHOOK_SECRET="whsec_abc", CHECKOUT_SHIPPING_INR="60")


def configure(monkeypatch, **values):
    for name, value in {**LIVE, **values}.items():
        monkeypatch.setattr(settings, name, value)


def test_everything_available_when_configured_and_a_print_is_listed(monkeypatch):
    configure(monkeypatch)
    assert availability.store_availability(has_printed_listing=True) == {"checkout": True, "printed": True}


def test_no_checkout_without_a_payment_key(monkeypatch):
    configure(monkeypatch, STRIPE_SECRET_KEY=None)
    assert availability.store_availability(has_printed_listing=True) == {"checkout": False, "printed": False}


def test_no_checkout_without_a_webhook_secret(monkeypatch):
    configure(monkeypatch, STRIPE_WEBHOOK_SECRET="")
    assert availability.store_availability(has_printed_listing=False)["checkout"] is False


def test_printed_needs_a_listing(monkeypatch):
    configure(monkeypatch)
    assert availability.store_availability(has_printed_listing=False) == {"checkout": True, "printed": False}


def test_printed_needs_a_shipping_charge(monkeypatch):
    configure(monkeypatch, CHECKOUT_SHIPPING_INR=None)
    assert availability.store_availability(has_printed_listing=True)["printed"] is False


def test_homepage_reports_availability():
    import inspect
    from app.api.routers import marketplace
    source = inspect.getsource(marketplace._build_homepage)
    assert '"availability"' in source
    assert "store_availability(" in source
