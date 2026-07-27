from pydantic import BaseModel
from typing import Optional, Any, Dict
from datetime import datetime

from app.models.collaboration import PaymentStatus, AgreementStatus
from app.models.commission import CommissionStatus, CommissionIntent


# --- Request ---
class CommissionCreate(BaseModel):
    creator_id: int
    title: str
    brief: str
    category: Optional[str] = None
    target_budget: Optional[float] = None
    desired_material: Optional[str] = None
    desired_color: Optional[str] = None
    dimensions_note: Optional[str] = None
    intent: CommissionIntent = CommissionIntent.FILE_ONLY


class CommissionDecline(BaseModel):
    reason: str


class CommissionResponse(BaseModel):
    id: int
    customer_id: int
    creator_id: int
    title: str
    brief: str
    category: Optional[str]
    reference_image_url: Optional[str]
    target_budget: Optional[float]
    desired_material: Optional[str]
    desired_color: Optional[str]
    dimensions_note: Optional[str]
    intent: CommissionIntent
    brief_fee: float
    payment_status: PaymentStatus
    design_fee_status: PaymentStatus
    workflow_status: CommissionStatus
    decline_reason: Optional[str]
    final_design_name: Optional[str]
    delivered_at: Optional[datetime]
    revisions_used: int
    revision_note: Optional[str]
    print_order_id: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Proposal ---
class ProposalCreate(BaseModel):
    design_fee: float
    revisions_included: int = 2
    delivery_days: int
    print_unit_price: Optional[float] = None
    scope_notes: Optional[str] = None


class ProposalResponse(BaseModel):
    id: int
    request_id: int
    design_fee: float
    revisions_included: int
    delivery_days: int
    print_unit_price: Optional[float]
    concept_image: Optional[str]
    scope_notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Messages ---
class CommissionMessageCreate(BaseModel):
    content: str


class CommissionMessageResponse(BaseModel):
    id: int
    request_id: int
    sender_id: int
    content: str
    timestamp: datetime

    class Config:
        from_attributes = True


# --- Agreement ---
class CommissionAgreementFinalize(BaseModel):
    final_price: float


class CommissionAgreementResponse(BaseModel):
    id: int
    request_id: int
    customer_id: int
    creator_id: int
    final_price: float
    delivery_days: Optional[int]
    status: AgreementStatus
    customer_confirmed: bool
    creator_confirmed: bool
    timestamp: datetime

    class Config:
        from_attributes = True


class RevisionRequest(BaseModel):
    note: str


class PrintOrderRequest(BaseModel):
    shipping_address: Dict[str, Any]
    quantity: int = 1


class CommissionListItem(BaseModel):
    """Row in either side's inbox — carries the counterparty's name so the list
    doesn't need a lookup per row."""
    request: CommissionResponse
    counterparty_name: str
    unread_hint: bool = False


class CommissionDetails(BaseModel):
    request: CommissionResponse
    proposal: Optional[ProposalResponse] = None
    agreement: Optional[CommissionAgreementResponse] = None
    creator_name: str
    customer_name: str
    viewer_side: str  # "customer" | "creator" | "admin"
