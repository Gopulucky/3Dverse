from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint

from app.core.database import Base


class CreatorFollow(Base):
    """A shopper following a creator, so new designs from that creator reach them."""

    __tablename__ = "creator_follows"
    __table_args__ = (UniqueConstraint("follower_id", "creator_id", name="uq_creator_follow"),)

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
