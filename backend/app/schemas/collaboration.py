from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.collaboration import TicketStatus, PaymentStatus, AgreementStatus, OverflowReason


# --- Ticket ---
class TicketCreate(BaseModel):
    print_partner_id: int
    product_reference: Optional[str] = None
    # Required for self-fulfilling (studio) creators only -- self-declared,
    # not enforced yet, per the print partner portal's "baby steps" eligibility rule.
    overflow_reason: Optional[OverflowReason] = None


class TicketDecline(BaseModel):
    reason: str


class TicketResponse(BaseModel):
    id: int
    creator_id: int
    print_partner_id: int
    product_reference: Optional[str]
    ticket_fee: float
    payment_status: PaymentStatus
    workflow_status: TicketStatus
    design_file_url: Optional[str]
    overflow_reason: Optional[OverflowReason]
    decline_reason: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


# --- Certification Report ---
class CertificationReportCreate(BaseModel):
    material_cost: float
    labor_cost: float
    machine_time_cost: float
    overhead_cost: float
    print_duration: int
    suggested_unit_price: Optional[float] = None
    notes: Optional[str] = None


class CertificationReportResponse(BaseModel):
    id: int
    ticket_id: int
    material_cost: float
    labor_cost: float
    machine_time_cost: float
    overhead_cost: float
    total_manufacturing_cost: float
    print_duration: int
    suggested_unit_price: Optional[float]
    sample_photo: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True


# --- Messages ---
class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: int
    ticket_id: int
    sender_id: int
    content: str
    timestamp: datetime

    class Config:
        orm_mode = True


# --- Agreement ---
class AgreementFinalize(BaseModel):
    final_unit_price: float


class AgreementResponse(BaseModel):
    id: int
    ticket_id: int
    creator_id: int
    print_partner_id: int
    product_reference: Optional[str]
    final_unit_price: float
    status: AgreementStatus
    creator_confirmed: bool
    partner_confirmed: bool
    timestamp: datetime

    class Config:
        orm_mode = True


class TicketDetailsResponse(BaseModel):
    ticket: TicketResponse
    certification_report: Optional[CertificationReportResponse] = None
    agreement: Optional[AgreementResponse] = None
    partner_name: str
