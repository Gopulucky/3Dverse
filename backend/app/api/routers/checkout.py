from typing import Any, Literal
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.api import deps
from app.core.config import settings
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.services import payments
from app.services.availability import checkout_ready

router = APIRouter()


class CheckoutRequest(BaseModel):
    idempotency_key: str = Field(min_length=8, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    shipping_method: Literal["standard"] = "standard"
    shipping_address: dict | None = None
    coupon_code: str | None = Field(default=None, max_length=100)


class CheckoutItem(BaseModel):
    title: str
    purchase_type: Literal["digital", "physical"]
    quantity: int
    unit_price: float


class CheckoutResponse(BaseModel):
    order_id: int
    key_id: str  # Razorpay's public key id; the secret never leaves the server
    razorpay_order_id: str
    amount_minor: int
    hold_expires_at: str  # UTC, ISO 8601 ending in Z: when the stock held for this checkout is released
    total: float
    subtotal: float
    shipping_cost: float
    currency: str
    payment_status: str
    shipping_address: dict | None
    items: list[CheckoutItem]


class VerifyRequest(BaseModel):
    order_id: int
    razorpay_order_id: str = Field(min_length=1, max_length=64)
    razorpay_payment_id: str = Field(min_length=1, max_length=64)
    razorpay_signature: str = Field(min_length=1, max_length=256)


class VerifyResponse(BaseModel):
    order_id: int
    status: Literal["paid", "pending"]


@router.get("/status")
def checkout_status() -> dict:
    """Whether the storefront can take payment right now (no secrets involved)."""
    return {"available": checkout_ready(), "provider": "razorpay"}


@router.post("/create-payment-intent", response_model=CheckoutResponse,
             dependencies=[Depends(rate_limit("checkout", limit=30, window_seconds=3600))])
def create_payment_intent(req: CheckoutRequest, db: Session = Depends(deps.get_db),
                          current_user: User = Depends(deps.get_current_active_user)) -> Any:
    return payments.start_payment(db, current_user, req)


@router.post("/verify", response_model=VerifyResponse,
             dependencies=[Depends(rate_limit("checkout-verify", limit=60, window_seconds=3600))])
def verify_checkout(req: VerifyRequest, db: Session = Depends(deps.get_db),
                    current_user: User = Depends(deps.get_current_active_user)) -> Any:
    return payments.verify_checkout(db, current_user, req.order_id, req.razorpay_order_id,
                                    req.razorpay_payment_id, req.razorpay_signature)


@router.get("/hold")
def get_hold(db: Session = Depends(deps.get_db),
             current_user: User = Depends(deps.get_current_active_user)) -> dict:
    """The customer's live checkout hold (stock held while they pay), or null."""
    return {"hold": payments.current_hold(db, current_user)}


@router.post("/callback")
async def payment_callback(request: Request, db: Session = Depends(deps.get_db)):
    """Where Razorpay sends a phone browser after payment (redirect mode). Verified by
    signature, then the customer lands on the frontend's 'confirming your payment' page."""
    form = await request.form()
    order_id = payments.complete_callback(db, form.get("razorpay_order_id"),
                                          form.get("razorpay_payment_id"), form.get("razorpay_signature"))
    base = settings.FRONTEND_URL.rstrip("/")
    return RedirectResponse(f"{base}/checkout/return?order_id={order_id}" if order_id else f"{base}/orders",
                            status_code=303)


@router.post("/webhook")
async def payment_webhook(request: Request, db: Session = Depends(deps.get_db)):
    event = payments.verify_webhook(await request.body(),
                                    request.headers.get("x-razorpay-signature"),
                                    request.headers.get("x-razorpay-event-id"))
    try:
        return payments.process_event(db, event)
    except Exception:
        db.rollback()
        raise


@router.post("/orders/{order_id}/resume", response_model=CheckoutResponse,
             dependencies=[Depends(rate_limit("checkout", limit=30, window_seconds=3600))])
def resume_checkout(order_id: int, db: Session = Depends(deps.get_db),
                    current_user: User = Depends(deps.get_current_active_user)):
    return payments.resume_payment(db, current_user, order_id)
