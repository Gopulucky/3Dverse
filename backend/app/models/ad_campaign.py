import enum
from sqlalchemy import Column, Integer, String, Float, Boolean, Enum, ForeignKey
from app.core.database import Base


class AdSponsorType(str, enum.Enum):
    PLATFORM = "platform"
    CREATOR = "creator"


class AdCampaign(Base):
    __tablename__ = "ad_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    sponsor_type = Column(Enum(AdSponsorType), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # null if platform-run
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    budget = Column(Float, nullable=False)
    spend_to_date = Column(Float, default=0)
    clicks = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    # is_sponsored_label is NOT a toggle -- always True at render time, enforced in API response
