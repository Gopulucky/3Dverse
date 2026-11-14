"""Pre-launch waitlist: people leave an email and a couple of answers so we can
measure demand for printed products before payments and printing exist.

No database here (see conftest): these pin validation, privacy-safe responses,
the rate limit and the admin summary maths.
"""
import inspect
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import app.main  # noqa: F401
from app.api.routers import waitlist
from app.main import app
from app.schemas.waitlist import WaitlistJoin

GOOD = dict(email="  Asha@Example.COM ", interest="personalised_gifts", price_choice="499", city="  Hyderabad ", consent=True)


def test_valid_signup_is_normalised():
    data = WaitlistJoin(**GOOD)
    assert data.email == "asha@example.com"
    assert data.city == "Hyderabad"


@pytest.mark.parametrize("field,value", [
    ("email", "not-an-email"),
    ("interest", "weapons"),
    ("price_choice", "1"),
    ("city", "x" * 81),
    ("consent", False),
])
def test_invalid_fields_are_rejected(field, value):
    with pytest.raises(ValidationError):
        WaitlistJoin(**{**GOOD, field: value})


def test_consent_is_required():
    with pytest.raises(ValidationError):
        WaitlistJoin(**{k: v for k, v in GOOD.items() if k != "consent"})


def test_optional_answers_may_be_left_out():
    data = WaitlistJoin(email="a@b.co", interest="other", consent=True)
    assert data.price_choice is None and data.city is None


def test_blank_city_becomes_none():
    assert WaitlistJoin(**{**GOOD, "city": "   "}).city is None


def test_join_is_rate_limited():
    route = next(r for r in waitlist.router.routes if "POST" in r.methods)
    names = [getattr(d.dependency, "__qualname__", "") for d in route.dependencies]
    assert any("rate_limit" in n for n in names), names


def test_join_is_mounted_publicly_and_validates():
    client = TestClient(app)
    response = client.post("/api/waitlist", json={"email": "bad", "interest": "other", "consent": True})
    assert response.status_code == 422


def test_join_never_reveals_whether_an_email_was_already_listed():
    source = inspect.getsource(waitlist.join_waitlist)
    assert source.count("return JOINED") >= 1
    assert "already" not in source.lower()


def test_admin_summary_requires_admin():
    client = TestClient(app)
    assert client.get("/api/waitlist/admin").status_code in (401, 403)


class Row:
    def __init__(self, email, interest, price_choice=None, city=None):
        self.email, self.interest, self.price_choice, self.city = email, interest, price_choice, city
        self.source, self.created_at = "home", datetime(2026, 11, 14)


def test_summary_counts_answers_and_cities():
    rows = [
        Row("a@x.co", "personalised_gifts", "499", "Hyderabad"),
        Row("b@x.co", "personalised_gifts", "299", "hyderabad "),
        Row("c@x.co", "tabletop", None, "Pune"),
        Row("d@x.co", "home_decor", "499", None),
    ]
    summary = waitlist.summarise(rows)
    assert summary["total"] == 4
    assert summary["by_interest"] == {"personalised_gifts": 2, "tabletop": 1, "home_decor": 1}
    assert summary["by_price"] == {"499": 2, "299": 1, "no_answer": 1}
    assert summary["top_cities"][0] == {"city": "Hyderabad", "count": 2}
    assert len(summary["signups"]) == 4
