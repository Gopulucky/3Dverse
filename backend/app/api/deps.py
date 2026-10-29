from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
# Single source of truth for the session dependency. The previous copy here
# created the session *inside* the try block, so if SessionLocal() itself raised
# the finally clause hit an unbound `db` (NameError) and hid the real error.
from app.core.database import get_db  # noqa: F401  (re-exported for routers)
from app.models.user import User

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"/api/auth/login/access-token"
)

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        unverified = jwt.get_unverified_claims(token)
    except JWTError:
        raise credentials_error
    if str(unverified.get("iss", "")).startswith("https://securetoken.google.com/"):
        # Issuer only chooses the verifier; no unverified claim grants access.
        from app.core.firebase_auth import verify_token
        from app.services.firebase_identity import resolve_identity
        return resolve_identity(db, verify_token(token), create=False)
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = payload.get("sub")
        if token_data is None:
            raise credentials_error
        user_id = int(token_data)
    except (JWTError, ValueError, TypeError):
        raise credentials_error
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.deleted_at is not None or user.firebase_uid:
        raise credentials_error
    if payload.get("tv", 0) != user.token_version:
        raise credentials_error
    return user

def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def require_role(role: str):
    def role_checker(current_user: User = Depends(get_current_active_user)):
        if current_user.role.value != role and current_user.role != role:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user
    return role_checker
