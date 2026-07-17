from pydantic import BaseModel
from datetime import datetime
from app.schemas.product import Product

class WishlistBase(BaseModel):
    product_id: int

class WishlistCreate(WishlistBase):
    pass

class WishlistResponse(WishlistBase):
    id: int
    user_id: int
    created_at: datetime
    product: Product

    class Config:
        from_attributes = True
