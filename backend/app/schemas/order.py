from pydantic import BaseModel, field_validator
from typing import List, Optional, Any
from datetime import datetime
from app.schemas.product import LineProduct, Product

def public_config(config: Optional[dict]) -> Optional[dict]:
    """The item options people may see: without the internal `buy_now` marker (see services/payments.py)."""
    return {key: value for key, value in config.items() if key != "buy_now"} if isinstance(config, dict) else config


class OrderItemBase(BaseModel):
    product_id: int
    price_at_purchase: float
    quantity: int = 1
    selected_config: Optional[dict] = None

    @field_validator("selected_config")
    @classmethod
    def hide_internal_marker(cls, value):
        return public_config(value)

class OrderItemResponse(OrderItemBase):
    id: int
    order_id: int
    product: Optional[Product] = None

    class Config:
        from_attributes = True

class CustomerOrderItemResponse(OrderItemBase):
    """What the buyer's own pages need: no source-file paths or version rows."""
    id: int
    order_id: int
    product: Optional[LineProduct] = None

    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    shipping_address: Optional[dict] = None
    shipping_cost: float = 0.0
    subtotal: float = 0.0
    total: float = 0.0
    currency: str = "INR"
    delivered_at: Optional[datetime] = None
    shipping_package: Optional[dict] = None
    payment_verified_at: Optional[datetime] = None
    status: str = "pending"
    razorpay_order_id: Optional[str] = None
    invoice_url: Optional[str] = None
    print_partner_id: Optional[int] = None
    shiprocket_order_id: Optional[str] = None
    shiprocket_shipment_id: Optional[str] = None
    tracking_url: Optional[str] = None

class OrderCreate(BaseModel):
    shipping_address: dict
    coupon_code: Optional[str] = None
    idempotency_key: Optional[str] = None

class OrderResponse(OrderBase):
    id: int
    customer_id: int
    created_at: datetime
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True


class CustomerOrderResponse(OrderBase):
    id: int
    customer_id: int
    created_at: datetime
    items: List[CustomerOrderItemResponse] = []

    class Config:
        from_attributes = True
