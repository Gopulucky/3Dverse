from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.models.product import Product
from app.models.wishlist import Wishlist
from app.schemas.wishlist import WishlistResponse

router = APIRouter()

@router.get("/", response_model=List[WishlistResponse])
def get_wishlist(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    wishlists = db.query(Wishlist).filter(Wishlist.user_id == current_user.id).all()
    return wishlists

@router.post("/{product_id}", response_model=WishlistResponse)
def add_to_wishlist(
    product_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = db.query(Wishlist).filter(
        Wishlist.user_id == current_user.id,
        Wishlist.product_id == product_id
    ).first()
    if existing:
        return existing

    wishlist_item = Wishlist(user_id=current_user.id, product_id=product_id)
    db.add(wishlist_item)
    db.commit()
    db.refresh(wishlist_item)
    return wishlist_item

@router.delete("/{product_id}")
def remove_from_wishlist(
    product_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    wishlist_item = db.query(Wishlist).filter(
        Wishlist.user_id == current_user.id,
        Wishlist.product_id == product_id
    ).first()
    if not wishlist_item:
        raise HTTPException(status_code=404, detail="Not found in wishlist")
    
    db.delete(wishlist_item)
    db.commit()
    return {"message": "Removed from wishlist"}
