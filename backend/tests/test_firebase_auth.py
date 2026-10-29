"""Identity boundary tests. Firebase/SQL calls are isolated; no credentials needed."""
from types import SimpleNamespace as NS
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from app.models import material, product  # noqa: F401: register User relationship targets


def identity():
    from app.services import firebase_identity
    return firebase_identity


def db_with(*rows):
    db = Mock()
    db.query.return_value.filter.return_value.first.side_effect = rows
    return db


def claims(**changes):
    return {"uid": "verified-uid", "email": "buyer@example.com", "email_verified": True,
            "name": "Buyer", **changes}


def test_new_firebase_identity_is_customer_regardless_of_claimed_role():
    from app.models.user import UserRole
    db = db_with(None, None)
    user = identity().resolve_identity(db, claims(role="admin"), create=True)
    assert user.firebase_uid == "verified-uid"
    assert user.role == UserRole.customer
    assert user.email_verified is True
    assert user.hashed_password != ""
    db.commit.assert_called_once()


def test_matching_email_never_silently_links_a_legacy_account():
    existing = NS(id=9, firebase_uid=None, is_active=True, deleted_at=None)
    db = db_with(None, existing)
    with pytest.raises(HTTPException) as error:
        identity().resolve_identity(db, claims(), create=True)
    assert error.value.status_code == 409
    assert existing.firebase_uid is None
    db.commit.assert_not_called()


def test_api_token_cannot_create_an_account_or_select_user_by_email():
    db = db_with(None)
    with pytest.raises(HTTPException) as error:
        identity().resolve_identity(db, claims(), create=False)
    assert error.value.status_code == 401
    assert db.query.call_count == 1


@pytest.mark.parametrize("changes", [{"is_active": False}, {"deleted_at": "deleted"}])
def test_disabled_or_deleted_firebase_account_stays_blocked(changes):
    user = NS(firebase_uid="verified-uid", is_active=True, deleted_at=None,
              email_verified=True, **{})
    for field, value in changes.items():
        setattr(user, field, value)
    with pytest.raises(HTTPException) as error:
        identity().resolve_identity(db_with(user), claims(), create=True)
    assert error.value.status_code == 403


def test_link_requires_verified_email_and_previous_password():
    from app.core.security import get_password_hash
    existing = NS(id=9, email="buyer@example.com", firebase_uid=None, is_active=True,
                  deleted_at=None, hashed_password=get_password_hash("old-password"), token_version=0)
    with pytest.raises(HTTPException):
        identity().link_identity(db_with(existing), claims(email_verified=False), "old-password")
    with pytest.raises(HTTPException):
        identity().link_identity(db_with(existing), claims(), "wrong-password")
    assert existing.firebase_uid is None
    db = db_with(existing, None)
    user = identity().link_identity(db, claims(), "old-password")
    assert user.firebase_uid == "verified-uid"
    assert user.token_version == 1


def test_admin_sdk_verification_checks_revocation(monkeypatch):
    from app.core import firebase_auth
    monkeypatch.setattr(firebase_auth, "firebase_app", lambda: "configured-app")
    verifier = Mock(return_value=claims())
    monkeypatch.setattr(firebase_auth.auth, "verify_id_token", verifier)
    assert firebase_auth.verify_token("signed-token")["uid"] == "verified-uid"
    verifier.assert_called_once_with("signed-token", app="configured-app", check_revoked=True)


def test_firebase_certificate_outage_does_not_invalidate_customer_session(monkeypatch):
    from app.core import firebase_auth
    monkeypatch.setattr(firebase_auth, "firebase_app", lambda: "configured-app")
    monkeypatch.setattr(firebase_auth.auth, "verify_id_token", Mock(side_effect=firebase_auth.auth.CertificateFetchError("offline", RuntimeError("offline"))))
    with pytest.raises(HTTPException) as error:
        firebase_auth.verify_token("signed-token")
    assert error.value.status_code == 503


def test_production_rejects_emulator_tokens(monkeypatch):
    from app.core import firebase_auth
    monkeypatch.setenv("FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099")
    monkeypatch.setattr(firebase_auth.settings, "ENVIRONMENT", "production")
    with pytest.raises(HTTPException) as error:
        firebase_auth.firebase_app()
    assert error.value.status_code == 503


def test_unconfigured_firebase_is_unavailable_not_invalid_password(monkeypatch):
    from app.core import firebase_auth
    monkeypatch.setattr(firebase_auth.settings, "FIREBASE_PROJECT_ID", None)
    with pytest.raises(HTTPException) as error:
        firebase_auth.firebase_app()
    assert error.value.status_code == 503


def test_admin_credentials_path_from_dotenv_is_used(tmp_path, monkeypatch):
    from app.core.config import Settings
    from app.core import firebase_auth
    env_file = tmp_path / ".env"
    env_file.write_text("FIREBASE_PROJECT_ID=demo-test\nGOOGLE_APPLICATION_CREDENTIALS=C:/private/firebase.json\n")
    config = Settings(_env_file=env_file)
    monkeypatch.setattr(firebase_auth, "settings", config)
    import firebase_admin.credentials
    credential = Mock()
    certificate = Mock(return_value=credential)
    initializer = Mock(return_value="initialized-app")
    monkeypatch.setattr(firebase_admin.credentials, "Certificate", certificate)
    monkeypatch.setattr(firebase_auth.firebase_admin, "initialize_app", initializer)
    firebase_auth._initialize.cache_clear()
    try:
        assert firebase_auth.firebase_app() == "initialized-app"
        certificate.assert_called_once_with("C:/private/firebase.json")
        initializer.assert_called_once_with(credential, options={"projectId": "demo-test"}, name="3dverse-auth")
    finally:
        firebase_auth._initialize.cache_clear()


def test_admin_without_key_file_preserves_default_credentials(monkeypatch):
    from app.core.config import Settings
    from app.core import firebase_auth
    config = Settings(_env_file=None, FIREBASE_PROJECT_ID="demo-default", GOOGLE_APPLICATION_CREDENTIALS=None)
    monkeypatch.setattr(firebase_auth, "settings", config)
    initializer = Mock(return_value="default-app")
    monkeypatch.setattr(firebase_auth.firebase_admin, "initialize_app", initializer)
    firebase_auth._initialize.cache_clear()
    try:
        assert firebase_auth.firebase_app() == "default-app"
        initializer.assert_called_once_with(None, options={"projectId": "demo-default"}, name="3dverse-auth")
    finally:
        firebase_auth._initialize.cache_clear()


def test_firebase_account_deletion_requires_recent_matching_identity(monkeypatch):
    import time
    from app.api.routers import users
    from app.core import firebase_auth
    from app.models.user import UserRole
    user = NS(id=9, email="buyer@example.com", firebase_uid="verified-uid", role=UserRole.customer,
              is_active=True, deleted_at=None)
    body = users.AccountDelete(confirm_email="buyer@example.com", firebase_id_token="new-token")
    db = Mock()
    for claims in ({"uid": "other", "auth_time": time.time()},
                   {"uid": "verified-uid", "auth_time": time.time() - 1000}):
        monkeypatch.setattr(firebase_auth, "verify_token", lambda token: claims)
        with pytest.raises(HTTPException):
            users.delete_my_account(body, db, user)
        assert user.is_active
    monkeypatch.setattr(firebase_auth, "verify_token", lambda token: {"uid": "verified-uid", "auth_time": time.time()})
    users.delete_my_account(body, db, user)
    assert not user.is_active
    assert user.deleted_at is not None


@pytest.mark.parametrize("role", ["creator", "print_partner", "admin"])
def test_public_registration_cannot_claim_privileged_roles(role):
    from pydantic import ValidationError
    from app.schemas.user import UserCreate
    with pytest.raises(ValidationError):
        UserCreate(email="buyer@example.com", password="long-password", role=role)
