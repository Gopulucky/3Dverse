from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.schemas.user import User

class ReviewBase(BaseModel):
    rating: int
    text: Optional[str] = None
    images: Optional[List[str]] = []

class ReviewCreate(ReviewBase):
    product_id: int

class ReviewResponse(ReviewBase):
    id: int
    user_id: int
    product_id: int
    created_at: datetime
    user: User

    class Config:
        from_attributes = True
