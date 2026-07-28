from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime
from app.schemas.product import Product

class OrderItemBase(BaseModel):
    product_id: int
    price_at_purchase: float
    quantity: int = 1
    selected_config: Optional[dict] = None

class OrderItemResponse(OrderItemBase):
    id: int
    order_id: int
    product: Optional[Product] = None

    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    shipping_address: Optional[dict] = None
    shipping_cost: float = 0.0
    subtotal: float = 0.0
    total: float = 0.0
    status: str = "pending"
    stripe_payment_intent_id: Optional[str] = None
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
