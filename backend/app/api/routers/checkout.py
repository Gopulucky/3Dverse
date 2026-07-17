import stripe
import os
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User
from app.models.cart import Cart, CartItem
from app.models.coupon import Coupon

# Note: In a real app, load this from settings.
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_fake")

router = APIRouter()

class CheckoutRequest(BaseModel):
    shipping_method: str = "standard"
    coupon_code: Optional[str] = None

class CheckoutResponse(BaseModel):
    client_secret: str
    total: float

@router.post("/create-payment-intent", response_model=CheckoutResponse)
def create_payment_intent(
    req: CheckoutRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # 1. Compute Subtotal
    subtotal = sum(item.product.price * item.quantity for item in cart.items)
    
    # 2. Add Shipping
    shipping_cost = 5.0 if req.shipping_method == "standard" else 15.0
    
    # 3. Apply Coupon
    discount = 0.0
    if req.coupon_code:
        import datetime
        coupon = db.query(Coupon).filter(Coupon.code == req.coupon_code).first()
        if coupon and not (coupon.expiry_date and coupon.expiry_date < datetime.datetime.utcnow()) and not (coupon.usage_limit and coupon.times_used >= coupon.usage_limit):
            if coupon.percent_off:
                discount = subtotal * (coupon.percent_off / 100.0)
            elif coupon.flat_off:
                discount = coupon.flat_off
                
    total = max(0, subtotal - discount + shipping_cost)
    
    # Stripe requires amount in cents
    amount_in_cents = int(total * 100)

    try:
        if stripe.api_key == "sk_test_fake":
            return {"client_secret": "mock_client_secret", "total": total}

        intent = stripe.PaymentIntent.create(
            amount=amount_in_cents,
            currency="usd",
            metadata={
                "user_id": current_user.id,
                "cart_id": cart.id,
                "shipping_method": req.shipping_method,
                "coupon_code": req.coupon_code or ""
            }
        )
        return {"client_secret": intent.client_secret, "total": total}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
