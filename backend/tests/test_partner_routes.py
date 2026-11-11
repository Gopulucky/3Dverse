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
from app.models.collaboration import CollaborationTicket, TicketStatus
from app.models.print_partner import PrintPartner, PrintPartnerCapability
from app.models.user import CreatorType, User, UserRole

PROFILE = {"lead_time_days": 5, "price_per_gram_inr": 4.5, "min_order_inr": 200, "bio": "We print.",
           "build_x_mm": 220, "build_y_mm": 220, "build_z_mm": 250}
CAPS = {"items": [{"technology": "fdm", "material": "PLA"}, {"technology": "FDM", "material": " pla "}, {"technology": "sla", "material": "Resin"}]}


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

    def make_user(role, email, creator_type=None):
        user = User(email=email, hashed_password="x", role=role, creator_type=creator_type, is_active=True, company_name=email.split("@")[0])
        db.add(user)
        db.commit()
        return user

    def as_user(user):
        current["user"] = user
        return client

    yield SimpleNamespace(db=db, make_user=make_user, as_user=as_user)
    fastapi_app.dependency_overrides.clear()
    db.close()


def ready_partner(env, email="shop@example.com", accepting=True):
    user = env.make_user(UserRole.print_partner, email)
    client = env.as_user(user)
    assert client.put("/api/partner/profile", json=PROFILE).status_code == 200
    assert client.put("/api/partner/capabilities", json=CAPS).status_code == 200
    if accepting:
        assert client.patch("/api/partner/availability", json={"accepting_work": True}).status_code == 200
    return user


def test_profile_round_trip_and_missing_list(env):
    client = env.as_user(env.make_user(UserRole.print_partner, "a@example.com"))
    first = client.get("/api/partner/profile").json()
    assert first["accepting_work"] is False
    assert first["missing"] == ["capabilities", "lead_time_days", "price_per_gram_inr", "build_volume"]
    assert client.put("/api/partner/profile", json=PROFILE).status_code == 200
    second = client.get("/api/partner/profile").json()
    assert second["lead_time_days"] == 5 and second["build_z_mm"] == 250 and second["bio"] == "We print."
    assert second["missing"] == ["capabilities"]


def test_invalid_profile_is_rejected_with_all_problems(env):
    client = env.as_user(env.make_user(UserRole.print_partner, "a@example.com"))
    response = client.put("/api/partner/profile", json={"lead_time_days": 0, "build_x_mm": 5, "role": "admin"})
    assert response.status_code == 400
    text = str(response.json()["detail"])
    assert "lead_time_days" in text and "build_x_mm" in text and "role" in text


def test_availability_blocked_then_allowed(env):
    client = env.as_user(env.make_user(UserRole.print_partner, "a@example.com"))
    blocked = client.patch("/api/partner/availability", json={"accepting_work": True})
    assert blocked.status_code == 400
    assert blocked.json()["detail"]["missing"] == ["capabilities", "lead_time_days", "price_per_gram_inr", "build_volume"]
    client.put("/api/partner/profile", json=PROFILE)
    client.put("/api/partner/capabilities", json=CAPS)
    assert client.patch("/api/partner/availability", json={"accepting_work": True}).status_code == 200
    assert client.get("/api/partner/profile").json()["accepting_work"] is True
    assert client.patch("/api/partner/availability", json={"accepting_work": False}).json()["accepting_work"] is False


def test_capabilities_replace_and_dedupe(env):
    client = env.as_user(env.make_user(UserRole.print_partner, "a@example.com"))
    saved = client.put("/api/partner/capabilities", json=CAPS).json()["capabilities"]
    assert saved == [{"technology": "fdm", "material": "PLA"}, {"technology": "sla", "material": "Resin"}]
    again = client.put("/api/partner/capabilities", json={"items": [{"technology": "sls", "material": "Nylon"}]}).json()["capabilities"]
    assert again == [{"technology": "sls", "material": "Nylon"}]
    assert client.put("/api/partner/capabilities", json={"items": [{"technology": "laser", "material": "x"}]}).status_code == 400


def test_removing_all_capabilities_pauses_the_partner(env):
    ready_partner(env)
    client = env.as_user(env.db.query(User).first())
    result = client.put("/api/partner/capabilities", json={"items": []}).json()
    assert result["accepting_work"] is False and result["capabilities"] == []


def test_non_partner_cannot_use_partner_profile(env):
    client = env.as_user(env.make_user(UserRole.creator, "c@example.com", CreatorType.designer))
    assert client.get("/api/partner/profile").status_code == 403
    assert client.put("/api/partner/profile", json=PROFILE).status_code == 403
    assert client.patch("/api/partner/availability", json={"accepting_work": True}).status_code == 403


def test_partners_list_hides_paused_and_adds_rates(env):
    ready_partner(env, "open@example.com", accepting=True)
    ready_partner(env, "paused@example.com", accepting=False)
    creator = env.make_user(UserRole.creator, "c@example.com", CreatorType.designer)
    listed = env.as_user(creator).get("/api/collaboration/partners").json()
    assert [p["name"] for p in listed] == ["open"]
    row = listed[0]
    assert row["lead_time_days"] == 5 and row["price_per_gram_inr"] == 4.5 and row["min_order_inr"] == 200
    assert (row["build_x_mm"], row["build_y_mm"], row["build_z_mm"]) == (220, 220, 250)
    assert row["bio"] == "We print."
    assert env.as_user(creator).get("/api/collaboration/partners?technology=sla").json()[0]["name"] == "open"
    assert env.as_user(creator).get("/api/collaboration/partners?technology=sls").json() == []
    assert env.as_user(creator).get("/api/collaboration/partners?min_build_mm=300").json() == []
    assert len(env.as_user(creator).get("/api/collaboration/partners?min_build_mm=200").json()) == 1


def test_ticket_for_paused_partner_is_refused(env):
    ready_partner(env, "paused@example.com", accepting=False)
    partner = env.db.query(PrintPartner).first()
    creator = env.make_user(UserRole.creator, "c@example.com", CreatorType.designer)
    response = env.as_user(creator).post("/api/collaboration/tickets", json={"print_partner_id": partner.id})
    assert response.status_code == 409
    assert env.db.query(CollaborationTicket).count() == 0
    partner.accepting_work = True
    env.db.commit()
    assert env.as_user(creator).post("/api/collaboration/tickets", json={"print_partner_id": partner.id}).status_code == 200


def make_ticket(env, partner, creator, status):
    ticket = CollaborationTicket(creator_id=creator.id, print_partner_id=partner.id, workflow_status=status)
    env.db.add(ticket)
    env.db.commit()
    return ticket


def test_accept_ticket_moves_to_sample_printing(env):
    owner = ready_partner(env)
    partner = env.db.query(PrintPartner).filter(PrintPartner.user_id == owner.id).first()
    creator = env.make_user(UserRole.creator, "c@example.com", CreatorType.designer)
    ticket = make_ticket(env, partner, creator, TicketStatus.DESIGN_SUBMITTED)
    response = env.as_user(owner).post(f"/api/collaboration/tickets/{ticket.id}/accept")
    assert response.status_code == 200
    env.db.refresh(ticket)
    assert ticket.workflow_status == TicketStatus.SAMPLE_PRINTING


def test_accept_other_partners_ticket_is_404_and_wrong_state_is_400(env):
    owner = ready_partner(env, "one@example.com")
    other = ready_partner(env, "two@example.com")
    partner = env.db.query(PrintPartner).filter(PrintPartner.user_id == owner.id).first()
    creator = env.make_user(UserRole.creator, "c@example.com", CreatorType.designer)
    ticket = make_ticket(env, partner, creator, TicketStatus.DESIGN_SUBMITTED)
    assert env.as_user(other).post(f"/api/collaboration/tickets/{ticket.id}/accept").status_code == 404
    waiting = make_ticket(env, partner, creator, TicketStatus.PAID)
    assert env.as_user(owner).post(f"/api/collaboration/tickets/{waiting.id}/accept").status_code == 400
    assert env.as_user(creator).post(f"/api/collaboration/tickets/{ticket.id}/accept").status_code == 403


def test_material_filter_ignores_case_and_spaces(env):
    ready_partner(env, "open@example.com")
    creator = env.make_user(UserRole.creator, "c@example.com", CreatorType.designer)
    client = env.as_user(creator)
    for text in ("pla", "PLA", " Pla "):
        assert len(client.get("/api/collaboration/partners", params={"material_type": text}).json()) == 1, text
    assert client.get("/api/collaboration/partners", params={"material_type": "Nylon"}).json() == []
    # An unknown technology is an empty result, not a server error.
    assert client.get("/api/collaboration/partners", params={"technology": "laser"}).json() == []


def test_minimum_order_can_be_cleared(env):
    ready_partner(env)
    client = env.as_user(env.db.query(User).first())
    assert client.put("/api/partner/profile", json={"min_order_inr": None}).json()["min_order_inr"] is None
    assert client.put("/api/partner/profile", json={"lead_time_days": None}).status_code == 400


def test_designer_flow_cannot_use_a_paused_partner(env):
    from app.models.product import FulfillmentStatus, Product
    from app.models.printer import PrinterTechnology
    paused_owner = ready_partner(env, "paused@example.com", accepting=False)
    open_owner = ready_partner(env, "open@example.com", accepting=True)
    paused = env.db.query(PrintPartner).filter(PrintPartner.user_id == paused_owner.id).first()
    open_ = env.db.query(PrintPartner).filter(PrintPartner.user_id == open_owner.id).first()
    creator = env.make_user(UserRole.creator, "c@example.com", CreatorType.designer)
    product = Product(title="Bracket", creator_id=creator.id, technology_required=PrinterTechnology.FDM, material_required="PLA",
                      safety_review_status="approved", status="draft")
    env.db.add(product)
    env.db.commit()
    client = env.as_user(creator)
    ids = [p["print_partner_id"] for p in client.get(f"/api/creator/designer/products/{product.id}/recommended-partners").json()]
    assert ids == [open_.id], ids
    refused = client.post(f"/api/creator/designer/products/{product.id}/assign-partner", json={"print_partner_id": paused.id})
    assert refused.status_code == 409
    assert client.post(f"/api/creator/designer/products/{product.id}/assign-partner", json={"print_partner_id": 9999}).status_code == 404
    env.db.refresh(product)
    assert product.fulfillment_partner_id is None
    ok = client.post(f"/api/creator/designer/products/{product.id}/assign-partner", json={"print_partner_id": open_.id})
    assert ok.status_code == 200
