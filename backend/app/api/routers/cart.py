from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, defer, joinedload, selectinload
from app.api import deps
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.models.product import Product
from app.models.cart import Cart, CartItem
from app.models.coupon import Coupon
from app.models.stock import StockItem
from app.services import payments
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

def load_cart(db: Session, user_id: int) -> Cart:
    """The cart with its lines, products and images in three queries, however
    many lines it has. (Each lazy load across regions costs a full round trip.)
    The cart row is read once, with its lines; it is only created if missing."""
    def fetch() -> Cart | None:
        return (
            db.query(Cart)
            .filter(Cart.user_id == user_id)
            .options(
                selectinload(Cart.items)
                .joinedload(CartItem.product)
                .options(defer(Product.embedding), selectinload(Product.media))
            )
            .populate_existing()
            .first()
        )

    cart = fetch()
    if cart is None:
        get_or_create_cart(db, user_id)
        cart = fetch()
    annotate_availability(db, cart)
    return cart


def annotate_availability(db: Session, cart: Cart) -> None:
    """Tag each line with why it cannot be bought right now, so the cart says so
    instead of checkout failing. Units held by the customer's own live checkout
    count as available to them (they are theirs)."""
    # Stock only matters for physical prints, so a cart without any costs no extra query.
    def may_be_physical(item) -> bool:
        kind = (item.selected_config or {}).get("purchase_type")
        return kind == "physical" or (kind is None and bool(item.product.is_mode_3_active or item.product.is_mode_4_active))
    product_ids = [item.product_id for item in cart.items if may_be_physical(item)]
    stocked = {row.product_id: row for row in
               db.query(StockItem).filter(StockItem.product_id.in_(product_ids)).all()} if product_ids else {}
    own_hold = {}
    live = payments.open_hold(db, cart.user_id) if stocked else None
    for line in (live.items if live else []):
        if (line.selected_config or {}).get("purchase_type") == "physical":
            own_hold[line.product_id] = own_hold.get(line.product_id, 0) + line.quantity
    for item in cart.items:
        row = stocked.get(item.product_id)
        sellable = None if row is None else row.sellable + own_hold.get(item.product_id, 0)
        item.unavailable_reason = payments.unavailable_reason(item, sellable)


@router.get("/", response_model=CartResponse)
def get_cart(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    return load_cart(db, current_user.id)

@router.post("/items", response_model=CartResponse)
def add_cart_item(
    item_in: CartItemCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    if item_in.quantity < 1 or item_in.quantity > 100:
        raise HTTPException(400, "Choose a quantity between 1 and 100")
    cart = get_or_create_cart(db, current_user.id)
    # Serialize with checkout snapshots and concurrent additions by this buyer.
    db.query(User).filter(User.id == current_user.id).with_for_update().one()
    product = db.query(Product).filter(Product.id == item_in.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    variants = db.query(CartItem).filter(
        CartItem.cart_id == cart.id, 
        CartItem.product_id == item_in.product_id
    ).all()
    existing_item = next((item for item in variants
                          if (item.selected_config or {}) == (item_in.selected_config or {})), None)

    if existing_item:
        if existing_item.quantity + item_in.quantity > 100:
            raise HTTPException(400, "Maximum quantity is 100 per option")
        existing_item.quantity += item_in.quantity
    else:
        new_item = CartItem(
            cart_id=cart.id,
            product_id=item_in.product_id,
            quantity=item_in.quantity,
            selected_config=item_in.selected_config
        )
        db.add(new_item)

    db.commit()
    return load_cart(db, current_user.id)

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
    return load_cart(db, current_user.id)

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
    return load_cart(db, current_user.id)

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
