import enum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ReturnStatus(str, enum.Enum):
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    RECEIVED = "received"
    REFUNDED = "refunded"


class ReturnReason(str, enum.Enum):
    NOT_AS_DESCRIBED = "not_as_described"
    ARRIVED_DAMAGED = "arrived_damaged"
    WRONG_ITEM = "wrong_item"
    NO_LONGER_NEEDED = "no_longer_needed"
    OTHER = "other"


class ReturnRequest(Base):
    """
    Standard return for pre-made stock (Direct Seller). Distinct from
    DefectReport, which covers made-to-order goods where the remedy is a reprint
    and never a refund -- a printed-to-order item has no resale value.
    """
    __tablename__ = "return_requests"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    order_item_id = Column(Integer, ForeignKey("order_items.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    reason = Column(Enum(ReturnReason, values_callable=lambda obj: [e.value for e in obj]), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(
        Enum(ReturnStatus, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=ReturnStatus.REQUESTED,
    )
    within_window = Column(String, nullable=True)  # retained for audit: the window state at request time
    refund_amount = Column(Float, nullable=True)
    gateway_refund_id = Column(String, nullable=True, unique=True)
    resolution_note = Column(Text, nullable=True)
    requested_at = Column(DateTime, server_default=func.now())
    resolved_at = Column(DateTime, nullable=True)

    order = relationship("Order")
    order_item = relationship("OrderItem")
