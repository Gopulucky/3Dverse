from pydantic import BaseModel
from typing import List, Optional, Any
from app.schemas.product import Product

class CartItemBase(BaseModel):
    product_id: int
    quantity: int = 1
    selected_config: Optional[dict] = None

class CartItemCreate(CartItemBase):
    pass

class CartItemUpdate(BaseModel):
    quantity: int

class CartItemResponse(CartItemBase):
    id: int
    cart_id: int
    product: Optional[Product] = None

    class Config:
        from_attributes = True

class CartResponse(BaseModel):
    id: int
    user_id: int
    items: List[CartItemResponse] = []
    
    class Config:
        from_attributes = True

class CouponApplyRequest(BaseModel):
    code: str
