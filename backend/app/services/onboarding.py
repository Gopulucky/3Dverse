from app.models.creator import Creator
from app.models.printer import PrinterProfile, TECHNOLOGY_MATERIAL_FORM, PrinterTechnology
from app.models.user import User
from sqlalchemy.orm import Session
from datetime import datetime


def complete_creator_onboarding(db: Session, user_id: int, owns_printer: bool,
                                 technology: PrinterTechnology | None = None) -> Creator:
    creator = db.query(Creator).filter(Creator.user_id == user_id).first()
    if not creator:
        # Assuming we might need to create the Creator record if it doesn't exist
        creator = Creator(user_id=user_id)
        db.add(creator)
        db.flush() # flush to get creator.id

    if owns_printer:
        if technology is None:
            raise ValueError("Technology is required when owns_printer=True")
        # owner_id is always the User.id, matching every other PrinterProfile
        # consumer (partner.py filters on current_user.id, not a joined-table id).
        db.add(PrinterProfile(
            owner_type="creator",
            owner_id=user_id,
            technology=technology,
            material_form=TECHNOLOGY_MATERIAL_FORM[technology],
        ))

    creator.onboarded_at = datetime.utcnow()

    # Also update User.onboarding_completed if applicable
    user = db.query(User).get(creator.user_id)
    if user:
        user.onboarding_completed = True

    db.commit()
    db.refresh(creator)
    return creator
