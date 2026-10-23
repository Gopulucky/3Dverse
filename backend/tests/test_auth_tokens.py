"""Email-link tokens (password reset / verification) and registration rules."""
from datetime import datetime, timedelta

import pytest
from jose import jwt
from pydantic import ValidationError

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_purpose_token,
    decode_purpose_token,
)
from app.schemas.user import UserCreate


def test_purpose_token_round_trips():
    token = create_purpose_token(7, "reset_password", token_version=2, minutes=5)
    claims = decode_purpose_token(token, "reset_password")
    assert claims["sub"] == "7" and claims["tv"] == 2


def test_token_for_one_purpose_is_rejected_for_another():
    token = create_purpose_token(7, "verify_email", 0, 5)
    assert decode_purpose_token(token, "reset_password") is None


def test_login_token_cannot_be_used_as_a_reset_token():
    login = create_access_token(7, token_version=0)
    assert decode_purpose_token(login, "reset_password") is None


def test_expired_token_is_rejected():
    token = create_purpose_token(7, "reset_password", 0, minutes=-1)
    assert decode_purpose_token(token, "reset_password") is None


def test_token_signed_with_another_key_is_rejected():
    forged = jwt.encode(
        {"sub": "7", "purpose": "reset_password", "tv": 0, "exp": datetime.utcnow() + timedelta(minutes=5)},
        "not-the-real-key",
        algorithm=settings.ALGORITHM,
    )
    assert decode_purpose_token(forged, "reset_password") is None


def test_garbage_token_is_rejected():
    assert decode_purpose_token("not.a.token", "reset_password") is None


def test_registration_rejects_short_passwords():
    with pytest.raises(ValidationError):
        UserCreate(email="a@example.com", password="short")
    assert UserCreate(email="a@example.com", password="longenough1").password == "longenough1"
