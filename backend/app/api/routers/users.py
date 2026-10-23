from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.core.rate_limit import rate_limit
from app.core.security import get_password_hash, verify_password
from app.models.user import User, UserRole
from app.schemas.user import AccountProfileResponse, AccountProfileUpdate
from pydantic import BaseModel

router = APIRouter()


@router.get("/me", response_model=AccountProfileResponse)
def get_my_account(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Portal-agnostic account profile for the signed-in user."""
    return current_user


@router.put("/me", response_model=AccountProfileResponse)
def update_my_account(
    profile_in: AccountProfileUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Update the signed-in user's account profile."""
    for field, value in profile_in.dict(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


class AccountDelete(BaseModel):
    password: str
    confirm_email: str


@router.delete("/me", dependencies=[Depends(rate_limit("delete_account", limit=5, window_seconds=3600))])
def delete_my_account(
    body: AccountDelete,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Self-service account deletion.

    Deactivates rather than erasing: the row and its email are retained so that
    existing order history stays intact and the address cannot be re-registered.
    Login is refused immediately (auth checks is_active). An admin can restore
    or permanently purge the account from the Admin portal.
    """
    if current_user.role == UserRole.admin:
        raise HTTPException(
            status_code=400,
            detail="Admin accounts cannot be self-deleted. Ask another admin to remove it.",
        )
    if body.confirm_email.strip().lower() != current_user.email.lower():
        raise HTTPException(status_code=400, detail="Confirmation email does not match this account")
    if not verify_password(body.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Password is incorrect")

    current_user.is_active = False
    current_user.deleted_at = datetime.utcnow()
    db.add(current_user)
    db.commit()
    return {
        "detail": "Account deleted. You have been signed out.",
        "deleted_at": current_user.deleted_at.isoformat(),
    }


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.put("/me/password", dependencies=[Depends(rate_limit("change_password", limit=10, window_seconds=3600))])
def change_my_password(
    body: PasswordChange,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Change the signed-in user's password."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    current_user.hashed_password = get_password_hash(body.new_password)
    current_user.token_version += 1
    db.add(current_user)
    db.commit()
    return {"detail": "Password updated"}
