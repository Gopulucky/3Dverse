from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from app.core.database import Base

class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    percent_off = Column(Float, nullable=True) # e.g. 10.0 for 10%
    flat_off = Column(Float, nullable=True) # e.g. 5.0 for $5
    expiry_date = Column(DateTime, nullable=True)
    usage_limit = Column(Integer, nullable=True)
    times_used = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
