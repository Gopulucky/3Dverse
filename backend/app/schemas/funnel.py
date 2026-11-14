from typing import Literal, Optional

from pydantic import BaseModel, Field

# What a browser may report. `checkout_started` and `paid` are recorded by the server only,
# so a visitor cannot invent sales. Keep in step with frontend/src/lib/track.ts.
BrowserEvent = Literal["landing", "product_view", "viewer_opened", "add_to_cart", "buy_now", "payment_opened", "waitlist_joined"]

ANON_ID = r"^[A-Za-z0-9_-]{8,64}$"
TAG = r"^[A-Za-z0-9_.-]{1,64}$"


class EventIn(BaseModel):
    event: BrowserEvent
    product_id: Optional[int] = Field(default=None, ge=1)
    source: Optional[str] = Field(default=None, pattern=TAG)
    medium: Optional[str] = Field(default=None, pattern=TAG)
    campaign: Optional[str] = Field(default=None, pattern=TAG)
    path: Optional[str] = Field(default=None, max_length=200)


class EventBatch(BaseModel):
    anon_id: str = Field(pattern=ANON_ID)
    events: list[EventIn] = Field(min_length=1, max_length=20)


class Visitor(BaseModel):
    """Who is checking out, for attribution only. Sent along with the checkout request."""
    anon_id: str = Field(pattern=ANON_ID)
    source: Optional[str] = Field(default=None, pattern=TAG)
    medium: Optional[str] = Field(default=None, pattern=TAG)
    campaign: Optional[str] = Field(default=None, pattern=TAG)
