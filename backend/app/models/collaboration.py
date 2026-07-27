import enum
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.sql import func
from app.core.database import Base


class TicketStatus(str, enum.Enum):
    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"
    DESIGN_SUBMITTED = "design_submitted"
    SAMPLE_PRINTING = "sample_printing"
    CERTIFIED = "certified"
    NEGOTIATING = "negotiating"
    AGREED = "agreed"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class OverflowReason(str, enum.Enum):
    """
    Self-declared reason a self-fulfilling (studio) creator gives for routing
    a job to a print partner instead of printing it themselves. Not enforced
    yet -- logged for the partner's accept/decline decision and for admin to
    spot patterns of misuse later.
    """
    SHIPPING_DIFFICULTY = "shipping_difficulty"
    OVERFLOW_CAPACITY = "overflow_capacity"


class CollaborationTicket(Base):
    __tablename__ = "collaboration_tickets"
    
    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    print_partner_id = Column(Integer, ForeignKey("print_partners.id"), nullable=False)
    product_reference = Column(String, nullable=True) # Could be a product title or ID
    ticket_fee = Column(Float, nullable=False, default=50.0)
    payment_status = Column(Enum(PaymentStatus, values_callable=lambda obj: [e.value for e in obj]), default=PaymentStatus.PENDING, nullable=False)
    workflow_status = Column(Enum(TicketStatus, values_callable=lambda obj: [e.value for e in obj]), default=TicketStatus.PENDING_PAYMENT, nullable=False)
    design_file_url = Column(String, nullable=True)
    # Only set for self-fulfilling (studio) creators -- designer-only creators have
    # no printer of their own so a partner is always their sole path, no reason needed.
    overflow_reason = Column(Enum(OverflowReason, values_callable=lambda obj: [e.value for e in obj]), nullable=True)
    decline_reason = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, default=func.now(), server_default=func.now(), onupdate=func.now())


class CertificationReport(Base):
    __tablename__ = "collaboration_certification_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("collaboration_tickets.id"), nullable=False, unique=True)
    material_cost = Column(Float, nullable=False)
    labor_cost = Column(Float, nullable=False)
    machine_time_cost = Column(Float, nullable=False)
    overhead_cost = Column(Float, nullable=False)
    total_manufacturing_cost = Column(Float, nullable=False)
    print_duration = Column(Integer, nullable=False) # In minutes
    suggested_unit_price = Column(Float, nullable=True)
    sample_photo = Column(String, nullable=True) # URL
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class CollaborationMessage(Base):
    __tablename__ = "collaboration_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("collaboration_tickets.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    timestamp = Column(DateTime, server_default=func.now())


class AgreementStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    TERMINATED = "terminated"


class CollaborationAgreement(Base):
    __tablename__ = "collaboration_agreements"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("collaboration_tickets.id"), nullable=False, unique=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    print_partner_id = Column(Integer, ForeignKey("print_partners.id"), nullable=False)
    product_reference = Column(String, nullable=True)
    final_unit_price = Column(Float, nullable=False)
    status = Column(Enum(AgreementStatus, values_callable=lambda obj: [e.value for e in obj]), default=AgreementStatus.PENDING, nullable=False)
    creator_confirmed = Column(Boolean, default=False)
    partner_confirmed = Column(Boolean, default=False)
    timestamp = Column(DateTime, server_default=func.now())
