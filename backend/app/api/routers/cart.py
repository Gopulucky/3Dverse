from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.models.product import Product
from app.models.cart import Cart, CartItem
from app.models.coupon import Coupon
from app.schemas.cart import CartResponse, CartItemCreate, CartItemUpdate, CouponApplyRequest

router = APIRouter()

def get_or_create_cart(db: Session, user_id: int) -> Cart:
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart

@router.get("/", response_model=CartResponse)
def get_cart(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    return get_or_create_cart(db, current_user.id)

@router.post("/items", response_model=CartResponse)
def add_cart_item(
    item_in: CartItemCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    cart = get_or_create_cart(db, current_user.id)
    product = db.query(Product).filter(Product.id == item_in.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id, 
        CartItem.product_id == item_in.product_id
    ).first()

    if existing_item:
        existing_item.quantity += item_in.quantity
        if item_in.selected_config:
            existing_item.selected_config = item_in.selected_config
    else:
        new_item = CartItem(
            cart_id=cart.id,
            product_id=item_in.product_id,
            quantity=item_in.quantity,
            selected_config=item_in.selected_config
        )
        db.add(new_item)

    db.commit()
    db.refresh(cart)
    return cart

@router.put("/items/{item_id}", response_model=CartResponse)
def update_cart_item(
    item_id: int,
    item_in: CartItemUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    cart = get_or_create_cart(db, current_user.id)
    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.cart_id == cart.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
        
    if item_in.quantity <= 0:
        db.delete(item)
    else:
        item.quantity = item_in.quantity
        
    db.commit()
    db.refresh(cart)
    return cart

@router.delete("/items/{item_id}", response_model=CartResponse)
def remove_cart_item(
    item_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    cart = get_or_create_cart(db, current_user.id)
    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.cart_id == cart.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
        
    db.delete(item)
    db.commit()
    db.refresh(cart)
    return cart

@router.post("/apply-coupon", dependencies=[Depends(rate_limit("apply_coupon", limit=15, window_seconds=600))])
def apply_coupon(
    req: CouponApplyRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    import datetime
    coupon = db.query(Coupon).filter(Coupon.code == req.code).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    if coupon.expiry_date and coupon.expiry_date < datetime.datetime.utcnow():
        raise HTTPException(status_code=400, detail="Coupon has expired")
        
    if coupon.usage_limit and coupon.times_used >= coupon.usage_limit:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
        
    return {
        "code": coupon.code, 
        "percent_off": coupon.percent_off, 
        "flat_off": coupon.flat_off
    }
