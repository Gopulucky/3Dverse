from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.core.database import Base


class PaymentEvent(Base):
    __tablename__ = "payment_events"
    id = Column(String, primary_key=True)  # Stripe event ID: durable replay barrier
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)
    processed_at = Column(DateTime, nullable=False, default=datetime.utcnow)
