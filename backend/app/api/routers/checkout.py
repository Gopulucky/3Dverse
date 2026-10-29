from typing import Any, Literal
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.api import deps
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.services import payments

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
    client_secret: str
    total: float
    subtotal: float
    shipping_cost: float
    currency: str
    payment_status: str
    shipping_address: dict | None
    items: list[CheckoutItem]


@router.post("/create-payment-intent", response_model=CheckoutResponse,
             dependencies=[Depends(rate_limit("checkout", limit=30, window_seconds=3600))])
def create_payment_intent(req: CheckoutRequest, db: Session = Depends(deps.get_db),
                          current_user: User = Depends(deps.get_current_active_user)) -> Any:
    return payments.start_payment(db, current_user, req)


@router.post("/webhook")
async def payment_webhook(request: Request, db: Session = Depends(deps.get_db)):
    event = payments.verify_webhook(await request.body(), request.headers.get("stripe-signature"))
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
