from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.core.database import Base


class WaitlistSignup(Base):
    """Someone who asked to hear when printed products launch (pre-launch demand test)."""

    __tablename__ = "waitlist_signups"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(254), nullable=False, unique=True, index=True)
    interest = Column(String(32), nullable=False)
    price_choice = Column(String(16), nullable=True)
    city = Column(String(80), nullable=True)
    source = Column(String(32), nullable=False, default="home")
    consented_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
