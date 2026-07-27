from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.print_partner import PrintPartner
from app.models.user import User, UserRole


def get_or_create_partner_record(db: Session, user: User) -> PrintPartner:
    """
    Resolve the PrintPartner (collaboration-matching identity) linked to a
    logged-in `User(role=print_partner)`. Auto-provisions on first use so a
    partner who registered and never got a manually-seeded PrintPartner row
    isn't locked out of their own ticket inbox -- capability/region/cost-tier
    details can be filled in afterwards from their settings.
    """
    partner = db.query(PrintPartner).filter(PrintPartner.user_id == user.id).first()
    if partner:
        return partner

    partner = PrintPartner(
        user_id=user.id,
        name=user.company_name or user.full_name or user.email.split("@")[0],
        region=None,
        cost_tier=None,
    )
    db.add(partner)
    db.flush()
    return partner


def require_partner_record(db: Session, user: User) -> PrintPartner:
    if user.role != UserRole.print_partner:
        raise HTTPException(status_code=403, detail="Only print partners can access this")
    return get_or_create_partner_record(db, user)


def is_ticket_party(db: Session, ticket, user: User) -> bool:
    """Read-only authorization check -- does not provision a PrintPartner row,
    since a mere permission check should not have a write side effect."""
    if user.id == ticket.creator_id:
        return True
    if user.role != UserRole.print_partner:
        return False
    partner = db.query(PrintPartner).filter(PrintPartner.user_id == user.id).first()
    return partner is not None and partner.id == ticket.print_partner_id
