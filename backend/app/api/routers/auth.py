from datetime import timedelta
from typing import Any
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.api import deps
from app.core.email import send_password_reset_email, send_verification_email
from app.core.security import (
    RESET_TOKEN_MINUTES,
    VERIFY_TOKEN_MINUTES,
    create_access_token,
    create_purpose_token,
    decode_purpose_token,
    get_password_hash,
    verify_password,
)
from app.core.config import settings
from app.models.user import User
from app.schemas.user import UserCreate, User as UserSchema, Token

router = APIRouter()

@router.post(
    "/register",
    response_model=UserSchema,
    dependencies=[Depends(rate_limit("register", limit=5, window_seconds=3600))],
)
def register(*, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user_in: UserCreate) -> Any:
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
    background_tasks.add_task(
        send_verification_email,
        user.email,
        create_purpose_token(user.id, "verify_email", user.token_version, VERIFY_TOKEN_MINUTES),
    )
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


class ForgotPassword(BaseModel):
    email: EmailStr


class ResetPassword(BaseModel):
    token: str
    new_password: str


class VerifyEmail(BaseModel):
    token: str


@router.post(
    "/forgot-password",
    dependencies=[Depends(rate_limit("forgot_password", limit=5, window_seconds=3600))],
)
def forgot_password(
    body: ForgotPassword, background_tasks: BackgroundTasks, db: Session = Depends(get_db)
) -> Any:
    """Email a single-use reset link. Always answers the same way, so the
    endpoint can't be used to find out which emails have accounts."""
    user = db.query(User).filter(User.email == body.email).first()
    if user and user.is_active and user.deleted_at is None:
        background_tasks.add_task(
            send_password_reset_email,
            user.email,
            create_purpose_token(user.id, "reset_password", user.token_version, RESET_TOKEN_MINUTES),
        )
    return {"detail": "If that email has an account, a reset link is on its way."}


@router.post(
    "/reset-password",
    dependencies=[Depends(rate_limit("reset_password", limit=10, window_seconds=3600))],
)
def reset_password(body: ResetPassword, db: Session = Depends(get_db)) -> Any:
    if len(body.new_password) < 8 or len(body.new_password) > 128:
        raise HTTPException(status_code=400, detail="Password must be 8-128 characters")
    claims = decode_purpose_token(body.token, "reset_password")
    invalid = HTTPException(status_code=400, detail="This reset link is invalid or has expired.")
    if not claims:
        raise invalid
    user = db.query(User).filter(User.id == int(claims["sub"])).first()
    # token_version is bumped below, so the link works exactly once -- and so
    # does any older session: a reset signs the account out everywhere.
    if not user or not user.is_active or claims.get("tv") != user.token_version:
        raise invalid
    user.hashed_password = get_password_hash(body.new_password)
    user.token_version += 1
    db.add(user)
    db.commit()
    return {"detail": "Password updated. You can now sign in."}


@router.post(
    "/verify-email",
    dependencies=[Depends(rate_limit("verify_email", limit=20, window_seconds=3600))],
)
def verify_email(body: VerifyEmail, db: Session = Depends(get_db)) -> Any:
    claims = decode_purpose_token(body.token, "verify_email")
    user = db.query(User).filter(User.id == int(claims["sub"])).first() if claims else None
    if not user:
        raise HTTPException(status_code=400, detail="This verification link is invalid or has expired.")
    if not user.email_verified:
        user.email_verified = True
        db.add(user)
        db.commit()
    return {"detail": "Email verified."}


@router.post(
    "/resend-verification",
    dependencies=[Depends(rate_limit("resend_verification", limit=3, window_seconds=3600))],
)
def resend_verification(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    if not current_user.email_verified:
        background_tasks.add_task(
            send_verification_email,
            current_user.email,
            create_purpose_token(
                current_user.id, "verify_email", current_user.token_version, VERIFY_TOKEN_MINUTES
            ),
        )
    return {"detail": "If your email is unverified, a new link is on its way."}
