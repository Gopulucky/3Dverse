from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class DefectReport(Base):
    """48h defect-only window -> free reprint, not a refund."""
    __tablename__ = "defect_reports"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    # References the User who actually fulfilled the order (Order.print_partner_id),
    # not the separate PrintPartner collaboration-matching identity -- the two
    # are distinct accounts and must not be confused.
    print_partner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reported_at = Column(DateTime, default=datetime.utcnow)
    within_window = Column(Boolean, nullable=False)  # reported_at - order.created_at <= 48h
    description = Column(Text)
    reprint_status = Column(String, default="pending")  # pending|approved|reprinted|denied

    order = relationship("Order", back_populates="defect_report")
