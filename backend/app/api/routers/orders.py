from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User
from app.models.cart import Cart
from app.models.order import Order, OrderItem
from app.models.coupon import Coupon
from app.schemas.order import OrderCreate, OrderResponse
from app.core.invoice import generate_invoice_pdf
from app.core.partner_assignment import assign_print_partner

router = APIRouter()

@router.get("/", response_model=List[OrderResponse])
def get_orders(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    orders = db.query(Order).filter(Order.customer_id == current_user.id).order_by(Order.created_at.desc()).all()
    return orders

@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    order = db.query(Order).filter(Order.id == order_id, Order.customer_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.post("/confirm", response_model=OrderResponse)
def confirm_order(
    req: OrderCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    subtotal = sum(item.product.price * item.quantity for item in cart.items)
    shipping_cost = 5.0 # simplified logic 
    discount = 0.0
    
    if req.coupon_code:
        import datetime
        coupon = db.query(Coupon).filter(Coupon.code == req.coupon_code).first()
        if coupon and not (coupon.expiry_date and coupon.expiry_date < datetime.datetime.utcnow()) and not (coupon.usage_limit and coupon.times_used >= coupon.usage_limit):
            if coupon.percent_off:
                discount = subtotal * (coupon.percent_off / 100.0)
            elif coupon.flat_off:
                discount = coupon.flat_off
            coupon.times_used += 1
            db.add(coupon)

    total = max(0, subtotal - discount + shipping_cost)

    order = Order(
        customer_id=current_user.id,
        shipping_address=req.shipping_address,
        shipping_cost=shipping_cost,
        subtotal=subtotal,
        total=total,
        status="paid"
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    
    # Assign Print Partner
    assigned = assign_print_partner(db, order)
    if assigned:
        order.status = "queued"
        db.add(order)
        db.commit()
    
    invoice_items = []
    for item in cart.items:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item.product_id,
            price_at_purchase=item.product.price,
            quantity=item.quantity,
            selected_config=item.selected_config
        )
        db.add(order_item)
        invoice_items.append({
            'title': item.product.title,
            'quantity': item.quantity,
            'price': item.product.price
        })

    # Empty Cart
    for item in cart.items:
        db.delete(item)
        
    db.commit()

    # Generate Invoice
    try:
        invoice_url = generate_invoice_pdf(order.id, current_user.full_name or "Customer", invoice_items, subtotal, shipping_cost, total)
        order.invoice_url = invoice_url
        db.add(order)
        db.commit()
        db.refresh(order)
    except Exception as e:
        print(f"Failed to generate invoice: {e}")

    return order
