from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from app.core.database import Base


class RewardLedger(Base):
    """Filament-redemption points, Prusameters-style."""
    __tablename__ = "reward_ledger"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    points_delta = Column(Integer, nullable=False)  # positive = earned, negative = redeemed
    reason = Column(String, nullable=False)  # "order_completed", "make_photo_uploaded", "redeemed_filament"
    created_at = Column(DateTime, default=datetime.utcnow)
