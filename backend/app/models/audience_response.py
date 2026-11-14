from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String

from app.core.database import Base


class AudienceResponse(Base):
    """One visitor's answers to the audience popup, saved step by step (upserted by `response_id`).

    Email and WhatsApp are only ever stored together with the visitor's consent. No IP address
    or user agent is kept. `anon_id` is the anonymous funnel visitor id, so behaviour can be
    compared across audiences.
    """

    __tablename__ = "audience_responses"

    id = Column(Integer, primary_key=True, index=True)
    response_id = Column(String(64), nullable=False, unique=True, index=True)
    anon_id = Column(String(64), nullable=True, index=True)
    step_reached = Column(Integer, nullable=False, default=1)
    role = Column(String(24), nullable=True)
    city = Column(String(80), nullable=True)
    uses = Column(JSON, nullable=True)
    occasions = Column(JSON, nullable=True)
    owns_printer = Column(String(16), nullable=True)
    personalise = Column(String(16), nullable=True)
    bought_where = Column(String(24), nullable=True)
    spend_band = Column(String(16), nullable=True)
    missing = Column(String(280), nullable=True)
    email = Column(String(254), nullable=True, index=True)
    whatsapp = Column(String(10), nullable=True)
    chat_ok = Column(Boolean, nullable=False, default=False)
    consented_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
