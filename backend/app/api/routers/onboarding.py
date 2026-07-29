from fastapi import APIRouter, Depends, HTTPException
from app.api import deps
from app.api.deps import get_db, require_role
from app.services.onboarding import complete_creator_onboarding
from app.models.printer import PrinterTechnology
from app.models.creator import Creator
from app.models.user import User, CreatorType, UserRole
from sqlalchemy.orm import Session
from pydantic import BaseModel

router = APIRouter(prefix="/creator/onboarding", tags=["onboarding"])


class PrinterOnboardingRequest(BaseModel):
    owns_printer: bool
    technology: PrinterTechnology | None = None


class CreatorTypeRequest(BaseModel):
    creator_type: CreatorType


@router.get("/status")
def onboarding_status(
    current_user: User = Depends(deps.get_current_active_user),
):
    """Creator path state for the signed-in user, used to route the Studio."""
    return {
        "creator_type": current_user.creator_type.value if current_user.creator_type else None,
        "onboarding_completed": bool(current_user.onboarding_completed),
        "current_step": current_user.onboarding_step,
        "total_steps": 5,
        # The path is one-time: once set, the UI must not offer the chooser again
        "locked": current_user.creator_type is not None,
    }


@router.post("/type")
def set_creator_type(
    request: CreatorTypeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Set the account-level creator path. This is a one-time choice — changing it
    later requires deleting the account, so a second call is rejected.
    """
    if current_user.creator_type is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Creator path is already set to '{current_user.creator_type.value}' "
                "and cannot be changed. Delete the account to start over."
            ),
        )

    current_user.creator_type = request.creator_type
    current_user.onboarding_completed = True

    # Choosing a path *is* becoming a creator. Without this the account keeps
    # the default `customer` role, the Studio opens (it gates on creator_type
    # alone) and then every creator-only endpoint answers 403 -- "Only creators
    # can create products" on an account that just finished creator onboarding.
    # Only customers are promoted: an admin or print partner picking a path
    # must not be silently demoted out of their own role.
    if current_user.role == UserRole.customer:
        current_user.role = UserRole.creator

    db.add(current_user)

    # The printer step creates this row, but it is gated on the creator role and
    # is skippable, so seed it here to keep the profile consistent from the
    # moment the path is chosen.
    if not db.query(Creator).filter(Creator.user_id == current_user.id).first():
        db.add(Creator(user_id=current_user.id))

    db.commit()
    db.refresh(current_user)
    return {
        "creator_type": current_user.creator_type.value,
        "role": current_user.role.value,
        "locked": True,
    }


@router.post("/printer")
def set_printer_ownership(request: PrinterOnboardingRequest,
                           creator=Depends(require_role("creator")),
                           db: Session = Depends(get_db)):
    updated = complete_creator_onboarding(db, creator.id, request.owns_printer, request.technology)
    # `Creator` has no creator_type column — the path lives on the User row.
    return {
        "creator_type": creator.creator_type.value if creator.creator_type else None,
        "onboarded_at": updated.onboarded_at,
    }
