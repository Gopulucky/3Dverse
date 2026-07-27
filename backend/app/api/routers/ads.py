from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User, UserRole
from app.models.ad_campaign import AdCampaign, AdSponsorType

router = APIRouter()


@router.post("/boost")
def create_boosted_listing(
    product_id: int,
    budget: float,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Creator self-serve boosted listing. Frontend MUST render with a 'Sponsored' badge."""
    if current_user.role != UserRole.creator:
        raise HTTPException(status_code=403, detail="Only creators can boost listings")
    campaign = AdCampaign(
        sponsor_type=AdSponsorType.CREATOR,
        creator_id=current_user.id,
        product_id=product_id,
        budget=budget,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return {
        "id": campaign.id,
        "sponsor_type": campaign.sponsor_type.value,
        "product_id": campaign.product_id,
        "budget": campaign.budget,
        "is_active": campaign.is_active,
        "is_sponsored": True,  # always rendered — never optional
    }
