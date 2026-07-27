from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User, UserRole
from app.models.ad_campaign import AdCampaign, AdSponsorType
from app.models.print_partner import PrintPartner
from app.services import metrics

router = APIRouter()


def require_admin(user: User) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can access this endpoint")
    return user


@router.get("/metrics/summary")
def platform_summary(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Platform-wide financial summary (GMV, platform revenue, take rate)."""
    require_admin(current_user)
    return metrics.admin_financial_summary(db)


@router.get("/print-partners/reship-leaderboard")
def partner_reship_leaderboard(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Reship/defect rate across all print partners, worst first -- the quality
    signal admin monitors and uses to flag a partner for review."""
    require_admin(current_user)
    partners = db.query(PrintPartner).all()
    rows = [
        {
            "id": p.id,
            "name": p.name,
            "region": p.region,
            "total_orders_fulfilled": p.total_orders_fulfilled,
            "total_defect_reports": p.total_defect_reports,
            "reship_defect_rate": metrics.reship_defect_rate(db, p.id),
        }
        for p in partners
    ]
    rows.sort(key=lambda r: r["reship_defect_rate"], reverse=True)
    return rows


@router.get("/print-partners/{partner_id}/reship-rate")
def partner_quality(
    partner_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get reship/defect rate for a specific print partner."""
    require_admin(current_user)
    return {"reship_defect_rate": metrics.reship_defect_rate(db, partner_id)}


@router.post("/ads/platform-campaign")
def create_platform_campaign(
    budget: float,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Only admins can create platform-funded brand campaigns."""
    require_admin(current_user)
    campaign = AdCampaign(sponsor_type=AdSponsorType.PLATFORM, budget=budget)
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return {
        "id": campaign.id,
        "sponsor_type": campaign.sponsor_type.value,
        "budget": campaign.budget,
        "is_active": campaign.is_active,
    }
