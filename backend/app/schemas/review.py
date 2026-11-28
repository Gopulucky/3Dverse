from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ReviewBase(BaseModel):
    rating: int
    text: Optional[str] = None
    images: Optional[List[str]] = []

class ReviewCreate(ReviewBase):
    # The product comes from the address; the page does not repeat it in the body.
    product_id: Optional[int] = None
    rating: int = Field(ge=1, le=5)

class ReviewResponse(ReviewBase):
    """Public: reviews are readable without signing in, so no account details."""
    id: int
    product_id: int
    created_at: datetime
    reviewer_name: str

    class Config:
        from_attributes = True
