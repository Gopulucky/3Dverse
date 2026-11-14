"""Audience popup: answers saved step by step, privacy rules, and the admin summary and suggestions."""
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import app.main  # noqa: F401
from app.api.routers import audience as audience_router
from app.main import app
from app.schemas.audience import AudienceAnswers
from app.services import audience as svc
from test_payments import payment_db  # noqa: F401 (fixture)

RID = "response_abc12345"


def answers(**fields):
    return AudienceAnswers(response_id=RID, step=fields.pop("step", 1), **fields)


def stored(db):
    from app.models.audience_response import AudienceResponse
    return db.query(AudienceResponse).order_by(AudienceResponse.id).all()


@pytest.mark.parametrize("field,value", [
    ("role", "king"), ("uses", ["gifts", "home_decor", "hobby"]), ("uses", ["gifts", "gifts"]), ("uses", ["bogus"]),
    ("occasions", ["birthday", "x"]), ("owns_printer", "maybe"), ("personalise", "yes"), ("bought_where", "mall"),
    ("spend_band", "cheap"), ("city", "x" * 81), ("missing", "x" * 281), ("step", 0), ("step", 5),
    ("response_id", "short"), ("response_id", "has space!!"), ("anon_id", "<script>"),
])
def test_invalid_answers_are_rejected(field, value):
    with pytest.raises(ValidationError):
        AudienceAnswers(**{"response_id": RID, "step": 1, field: value})


@pytest.mark.parametrize("contact", [{"email": "a@b.co"}, {"whatsapp": "9876543210"}, {"chat_ok": True}])
def test_contact_details_need_consent(contact):
    with pytest.raises(ValidationError):
        answers(step=4, **contact)
    assert answers(step=4, consent=True, **contact).consent is True


def test_values_are_tidied():
    data = answers(step=4, city="  New   Delhi ", missing="  too   few\nchoices  ", email=" Asha@Example.COM ",
                   whatsapp="+91 98765-43210", consent=True)
    assert (data.city, data.missing, data.email, data.whatsapp) == ("New Delhi", "too few choices", "asha@example.com", "9876543210")
    assert answers(city="   ").city is None and answers(missing="  ").missing is None


@pytest.mark.parametrize("number", ["12345", "5876543210", "98765432101", "abcdefghij"])
def test_a_whatsapp_number_must_be_an_indian_mobile(number):
    with pytest.raises(ValidationError):
        answers(step=4, whatsapp=number, consent=True)


def test_answers_are_merged_step_by_step_and_never_blanked(payment_db):
    svc.save_answers(payment_db, answers(role="parent", city="Pune"))
    svc.save_answers(payment_db, answers(step=2, uses=["gifts"], occasions=["birthday"], owns_printer="no"))
    svc.save_answers(payment_db, answers(step=3, bought_where="local_shop", spend_band="500_1500"))  # city not resent
    [row] = stored(payment_db)
    assert (row.role, row.city, row.uses, row.occasions, row.owns_printer, row.bought_where, row.spend_band) == (
        "parent", "Pune", ["gifts"], ["birthday"], "no", "local_shop", "500_1500")
    assert row.step_reached == 3 and row.email is None and row.consented_at is None


def test_an_earlier_step_arriving_late_does_not_lower_progress(payment_db):
    svc.save_answers(payment_db, answers(step=3, role="student"))
    svc.save_answers(payment_db, answers(step=1, role="student"))
    assert stored(payment_db)[0].step_reached == 3


def test_the_contact_step_records_consent_and_the_visitor(payment_db):
    svc.save_answers(payment_db, answers(anon_id="visitor_abc12345", role="designer"))
    svc.save_answers(payment_db, answers(step=4, email="a@b.co", whatsapp="9876543210", chat_ok=True, consent=True))
    [row] = stored(payment_db)
    assert (row.anon_id, row.email, row.whatsapp, row.chat_ok, row.step_reached) == ("visitor_abc12345", "a@b.co", "9876543210", True, 4)
    assert isinstance(row.consented_at, datetime)


def test_two_visitors_get_two_rows(payment_db):
    svc.save_answers(payment_db, answers(role="student"))
    svc.save_answers(payment_db, AudienceAnswers(response_id="other_response1", step=1, role="parent"))
    assert len(stored(payment_db)) == 2


def test_the_endpoint_is_public_rate_limited_and_validates():
    route = next(r for r in audience_router.router.routes if "POST" in r.methods)
    assert any("rate_limit" in getattr(d.dependency, "__qualname__", "") for d in route.dependencies)
    bad = TestClient(app).post("/api/audience", json={"response_id": RID, "step": 1, "role": "king"})
    assert bad.status_code == 422


def test_the_admin_summary_requires_admin():
    assert TestClient(app).get("/api/audience/admin").status_code in (401, 403)


def test_the_table_stores_no_ip_or_user_agent():
    from app.models.audience_response import AudienceResponse
    names = {c.name for c in AudienceResponse.__table__.columns}
    assert not {"ip", "ip_address", "user_agent"} & names


class Row:
    def __init__(self, **fields):
        base = dict(role=None, city=None, uses=None, occasions=None, owns_printer=None, personalise=None,
                    bought_where=None, spend_band=None, missing=None, email=None, whatsapp=None, chat_ok=False,
                    step_reached=1, created_at=datetime(2026, 11, 14), response_id="r", anon_id=None, consented_at=None)
        base.update(fields)
        self.__dict__.update(base)


def test_summary_counts_each_question_and_ignores_unanswered():
    rows = [
        Row(role="parent", city="Pune ", uses=["gifts", "home_decor"], occasions=["birthday"], owns_printer="no", email="a@b.co", chat_ok=True),
        Row(role="parent", city="pune", uses=["gifts"], occasions=["birthday", "wedding"], owns_printer="no"),
        Row(role="student", city="Hyderabad", uses=["college_project"], owns_printer="yes", spend_band="under_500", missing="Too expensive"),
        Row(),
    ]
    s = svc.summarise(rows)
    assert s["total"] == 4 and s["with_email"] == 1 and s["chat_ok"] == 1
    assert s["by_role"] == {"parent": 2, "student": 1}
    assert s["by_use"] == {"gifts": 2, "home_decor": 1, "college_project": 1}
    assert s["by_occasion"] == {"birthday": 2, "wedding": 1}
    assert s["by_printer"] == {"no": 2, "yes": 1}
    assert s["top_cities"][0] == {"city": "Pune", "count": 2}
    assert s["use_by_role"]["parent"] == {"gifts": 2, "home_decor": 1}
    assert [m["text"] for m in s["missing"]] == ["Too expensive"]
    assert s["suggestions"] == []  # far too few answers to say anything


def test_suggestions_need_at_least_thirty_responses():
    rows = [Row(role="parent", uses=["gifts"]) for _ in range(svc.MIN_RESPONSES - 1)]
    assert svc.summarise(rows)["suggestions"] == []
    rows.append(Row(role="parent", uses=["gifts"]))
    assert svc.summarise(rows)["suggestions"] != []


def test_suggestions_name_the_decision_the_numbers_support():
    rows = ([Row(role="parent", city="Pune", uses=["gifts"], occasions=["birthday"], owns_printer="no", personalise="always",
                 bought_where="etsy_instagram", spend_band="500_1500") for _ in range(24)]
            + [Row(role="designer", city="Hyderabad", uses=["sell_designs"], owns_printer="yes", personalise="no") for _ in range(6)])
    text = " ".join(svc.summarise(rows)["suggestions"]).lower()
    for expected in ("gift", "birthday", "pune", "finished prints", "personalis", "etsy", "designer"):
        assert expected in text, expected
    assert "prioritise digital files" not in text  # only 20% own a printer


def test_the_summary_hides_nothing_an_admin_needs_for_export():
    s = svc.summarise([Row(email="a@b.co", whatsapp="9876543210", chat_ok=True, role="student")])
    assert s["responses"][0]["email"] == "a@b.co" and s["responses"][0]["whatsapp"] == "9876543210"
