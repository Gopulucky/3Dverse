from datetime import timedelta

import pytest
from jose import JWTError, jwt

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password


def decode(token: str, key: str = None):
    return jwt.decode(token, key or settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def test_token_round_trip_carries_subject_and_token_version():
    payload = decode(create_access_token(42, token_version=3))
    assert payload["sub"] == "42"
    assert payload["tv"] == 3


def test_token_signed_with_another_key_is_rejected():
    forged = jwt.encode({"sub": "1", "tv": 0}, "some-other-key", algorithm=settings.ALGORITHM)
    with pytest.raises(JWTError):
        decode(forged)


def test_tampered_token_is_rejected():
    token = create_access_token(1)
    head, body, sig = token.split(".")
    with pytest.raises(JWTError):
        decode(".".join([head, body, sig[:-2] + ("AA" if sig[-2:] != "AA" else "BB")]))


def test_expired_token_is_rejected():
    token = create_access_token(1, expires_delta=timedelta(seconds=-5))
    with pytest.raises(JWTError):
        decode(token)


def test_alg_none_token_is_rejected():
    # The classic bypass: an unsigned token claiming alg=none.
    import base64, json

    def b64(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

    unsigned = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'sub': '1', 'tv': 0})}."
    with pytest.raises(JWTError):
        decode(unsigned)


def test_password_hashing_verifies_and_never_stores_plaintext():
    hashed = get_password_hash("correct horse battery staple")
    assert hashed != "correct horse battery staple"
    assert verify_password("correct horse battery staple", hashed)
    assert not verify_password("wrong password", hashed)
    # Salted: same password hashes differently each time.
    assert get_password_hash("same") != get_password_hash("same")
