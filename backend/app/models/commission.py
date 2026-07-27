import enum
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.sql import func
from app.core.database import Base
# Reused so both collaboration flows share one Postgres enum type each.
from app.models.collaboration import PaymentStatus, AgreementStatus


class CommissionStatus(str, enum.Enum):
    """
    Customer-commissions-a-creator lifecycle. Mirrors the creator/print-partner
    ticket flow: a paid brief buys the creator's evaluation, a proposal replaces
    the certification report, and both sides confirm a price before work starts.
    """
    PENDING_PAYMENT = "pending_payment"   # brief fee not paid, not yet visible to the creator
    SUBMITTED = "submitted"               # paid, sitting in the creator's request inbox
    ACCEPTED = "accepted"                 # creator took it on, working up a quote
    QUOTED = "quoted"                     # creator sent scope, price and lead time
    NEGOTIATING = "negotiating"           # talking about the quote
    AGREED = "agreed"                     # both sides confirmed the price
    DELIVERED = "delivered"               # final design file handed over
    COMPLETED = "completed"               # customer accepted the delivery
    DECLINED = "declined"
    CANCELLED = "cancelled"


class CommissionIntent(str, enum.Enum):
    """
    What the customer wants out of the commission. `file_only` stops at the
    delivered design; `print_too` tells the creator to quote a per-unit print
    price as well, so a physical order can be raised after delivery.
    """
    FILE_ONLY = "file_only"
    PRINT_TOO = "print_too"


class CustomDesignRequest(Base):
    __tablename__ = "custom_design_requests"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    brief = Column(String, nullable=False)
    category = Column(String, nullable=True)
    reference_image_url = Column(String, nullable=True)
    target_budget = Column(Float, nullable=True)
    desired_material = Column(String, nullable=True)
    desired_color = Column(String, nullable=True)
    dimensions_note = Column(String, nullable=True)
    intent = Column(
        Enum(CommissionIntent, values_callable=lambda obj: [e.value for e in obj]),
        default=CommissionIntent.FILE_ONLY,
        nullable=False,
    )

    brief_fee = Column(Float, nullable=False, default=25.0)
    payment_status = Column(
        Enum(PaymentStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=PaymentStatus.PENDING,
        nullable=False,
    )
    # Gates the final-file download: the customer pays the agreed design fee
    # before the deliverable is released.
    design_fee_status = Column(
        Enum(PaymentStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=PaymentStatus.PENDING,
        nullable=False,
    )
    workflow_status = Column(
        Enum(CommissionStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=CommissionStatus.PENDING_PAYMENT,
        nullable=False,
    )
    decline_reason = Column(String, nullable=True)

    final_design_url = Column(String, nullable=True)
    final_design_name = Column(String, nullable=True)
    final_design_size = Column(Integer, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    revisions_used = Column(Integer, nullable=False, default=0)
    revision_note = Column(String, nullable=True)

    # Set once the customer turns a delivered design into a physical print order.
    print_order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, default=func.now(), server_default=func.now(), onupdate=func.now())


class CustomDesignProposal(Base):
    """The creator's quote — the commission equivalent of a certification report."""
    __tablename__ = "custom_design_proposals"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("custom_design_requests.id"), nullable=False, unique=True)
    design_fee = Column(Float, nullable=False)
    revisions_included = Column(Integer, nullable=False, default=2)
    delivery_days = Column(Integer, nullable=False)
    # Only quoted when the customer asked for a physical print too.
    print_unit_price = Column(Float, nullable=True)
    concept_image = Column(String, nullable=True)
    scope_notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class CustomDesignMessage(Base):
    __tablename__ = "custom_design_messages"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("custom_design_requests.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    timestamp = Column(DateTime, server_default=func.now())


class CustomDesignAgreement(Base):
    __tablename__ = "custom_design_agreements"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("custom_design_requests.id"), nullable=False, unique=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    final_price = Column(Float, nullable=False)
    delivery_days = Column(Integer, nullable=True)
    status = Column(
        Enum(AgreementStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=AgreementStatus.PENDING,
        nullable=False,
    )
    customer_confirmed = Column(Boolean, default=False)
    creator_confirmed = Column(Boolean, default=False)
    timestamp = Column(DateTime, server_default=func.now())
