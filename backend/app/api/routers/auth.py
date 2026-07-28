from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.core.security import create_access_token, get_password_hash, verify_password
from app.core.config import settings
from app.models.user import User
from app.schemas.user import UserCreate, User as UserSchema, Token

router = APIRouter()

@router.post(
    "/register",
    response_model=UserSchema,
    dependencies=[Depends(rate_limit("register", limit=5, window_seconds=3600))],
)
def register(*, db: Session = Depends(get_db), user_in: UserCreate) -> Any:
    """
    Register a new user.
    """
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        # A deleted account keeps its row and email so history survives; say so
        # explicitly rather than implying someone else holds the address.
        if user.deleted_at is not None:
            raise HTTPException(
                status_code=400,
                detail="This account was deleted. Contact support to restore it.",
            )
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        pincode=user_in.pincode,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post(
    "/login/access-token",
    response_model=Token,
    dependencies=[Depends(rate_limit("login", limit=10, window_seconds=300))],
)
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(
            user.id, token_version=user.token_version, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
        "user": user
    }
