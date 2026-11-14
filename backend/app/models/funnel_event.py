from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.core.database import Base


class FunnelEvent(Base):
    """One step a visitor took (viewed a product, started checkout, paid...).

    Anonymous by design: a random visitor id and the link they arrived from. No email,
    name, phone or address is ever stored here.
    """

    __tablename__ = "funnel_events"

    id = Column(Integer, primary_key=True, index=True)
    anon_id = Column(String(64), nullable=False, index=True)
    event = Column(String(32), nullable=False, index=True)
    product_id = Column(Integer, nullable=True, index=True)
    order_id = Column(Integer, nullable=True, index=True)  # set only on server-recorded checkout/paid events
    source = Column(String(64), nullable=True)
    medium = Column(String(64), nullable=True)
    campaign = Column(String(64), nullable=True)
    path = Column(String(200), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
