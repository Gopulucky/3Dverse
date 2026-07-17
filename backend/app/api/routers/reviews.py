from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.models.product import Product
from app.models.review import Review
from app.schemas.review import ReviewCreate, ReviewResponse

router = APIRouter()

@router.get("/{product_id}", response_model=List[ReviewResponse])
def get_reviews(
    product_id: int,
    db: Session = Depends(deps.get_db),
) -> Any:
    reviews = db.query(Review).filter(Review.product_id == product_id).all()
    return reviews

@router.post("/{product_id}", response_model=ReviewResponse)
def submit_review(
    product_id: int,
    review_in: ReviewCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    review = Review(
        product_id=product_id,
        user_id=current_user.id,
        rating=review_in.rating,
        text=review_in.text,
        images=review_in.images
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review
