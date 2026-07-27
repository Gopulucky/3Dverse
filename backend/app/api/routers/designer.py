from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import require_role, get_db
from app.services import partner_matching
from app.models.product import Product
from sqlalchemy.orm import Session
from pydantic import BaseModel

router = APIRouter(prefix="/creator/designer", tags=["designer"])

@router.get("/products/{product_id}/recommended-partners")
def get_recommended_partners(product_id: int, creator=Depends(require_role("creator")), db: Session = Depends(get_db)):
    product = db.query(Product).filter_by(id=product_id, creator_id=creator.id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    return partner_matching.recommended_partners(db, product)

class AssignPartnerRequest(BaseModel):
    print_partner_id: int

@router.post("/products/{product_id}/assign-partner")
def choose_partner(product_id: int, request: AssignPartnerRequest,
                    creator=Depends(require_role("creator")), db: Session = Depends(get_db)):
    product = db.query(Product).filter_by(id=product_id, creator_id=creator.id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    updated = partner_matching.assign_partner(db, product, request.print_partner_id)
    updated.is_published = True   # only orderable once a partner is confirmed
    db.commit()
    return {"fulfillment_status": updated.fulfillment_status.value}
