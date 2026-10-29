from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.core.config import settings
from app.models.user import User, UserRole, CreatorType
from app.models.print_partner import PrintPartner, PrintPartnerCapability
from app.models.collaboration import (
    CollaborationTicket,
    TicketStatus,
    PaymentStatus,
    CertificationReport,
    CollaborationMessage,
    CollaborationAgreement,
    AgreementStatus
)
from app.schemas.collaboration import (
    TicketCreate,
    TicketDecline,
    TicketResponse,
    CertificationReportCreate,
    CertificationReportResponse,
    MessageCreate,
    MessageResponse,
    AgreementFinalize,
    AgreementResponse,
    TicketDetailsResponse
)
from app.core.storage import save_upload_file
from app.services import partner_identity

router = APIRouter()


@router.get("/partners")
def search_print_partners(
    region: Optional[str] = Query(None),
    technology: Optional[str] = Query(None),
    material_type: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Search for print partners based on capabilities."""
    if current_user.creator_type == CreatorType.seller:
        raise HTTPException(
            status_code=403,
            detail="Seller accounts sell designs directly and do not collaborate with print partners.",
        )
    if current_user.role not in (UserRole.creator, UserRole.admin):
        raise HTTPException(status_code=403, detail="Only creators can search for print partners")
        
    query = db.query(PrintPartner)
    
    if region:
        query = query.filter(PrintPartner.region == region)
        
    if technology or material_type:
        query = query.join(PrintPartnerCapability, PrintPartner.id == PrintPartnerCapability.print_partner_id)
        if technology:
            query = query.filter(PrintPartnerCapability.technology == technology)
        if material_type:
            query = query.filter(PrintPartnerCapability.material_type == material_type)
            
    partners = query.distinct().all()
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "region": p.region,
            "cost_tier": p.cost_tier,
            "total_orders_fulfilled": p.total_orders_fulfilled,
            "total_defect_reports": p.total_defect_reports,
            "capabilities": [
                {"technology": cap.technology.value if hasattr(cap.technology, "value") else cap.technology, "material_type": cap.material_type}
                for cap in db.query(PrintPartnerCapability).filter(PrintPartnerCapability.print_partner_id == p.id).all()
            ]
        }
        for p in partners
    ]


@router.post("/tickets", response_model=TicketResponse)
def create_ticket(
    req: TicketCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Create a new evaluation ticket for a print partner."""
    if current_user.creator_type == CreatorType.seller:
        raise HTTPException(
            status_code=403,
            detail="Seller accounts sell designs directly and do not collaborate with print partners.",
        )
    if current_user.role not in (UserRole.creator, UserRole.admin):
        raise HTTPException(status_code=403, detail="Only creators can create tickets")

    # Self-fulfilling (studio) creators already print/pack/ship themselves --
    # a partner is only an overflow valve, so the qualifying reason must be
    # self-declared on the ticket (shipping difficulty or capacity overflow).
    # Designer-only creators have no printer at all, so no reason is required.
    if current_user.creator_type == CreatorType.studio and not req.overflow_reason:
        raise HTTPException(
            status_code=400,
            detail="Self-fulfilling creators must declare a reason (shipping difficulty or overflow capacity) for routing this job to a print partner.",
        )

    partner = db.query(PrintPartner).filter(PrintPartner.id == req.print_partner_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Print partner not found")

    ticket = CollaborationTicket(
        creator_id=current_user.id,
        print_partner_id=partner.id,
        product_reference=req.product_reference,
        ticket_fee=50.0, # Fixed fee or dynamic based on partner
        payment_status=PaymentStatus.PENDING,
        workflow_status=TicketStatus.PENDING_PAYMENT,
        overflow_reason=req.overflow_reason if current_user.creator_type == CreatorType.studio else None,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/pay", response_model=TicketResponse)
def pay_ticket(
    ticket_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Mock payment for a ticket."""
    ticket = db.query(CollaborationTicket).filter(CollaborationTicket.id == ticket_id).first()
    if not ticket or ticket.creator_id != current_user.id:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if settings.is_production or not settings.ALLOW_MOCK_PAYMENTS:
        raise HTTPException(status_code=503, detail="Collaboration payments are not available yet")

    if ticket.payment_status == PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Ticket is already paid")
        
    ticket.payment_status = PaymentStatus.COMPLETED
    ticket.workflow_status = TicketStatus.PAID
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/design", response_model=TicketResponse)
async def upload_design(
    ticket_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Upload a design file for the ticket."""
    ticket = db.query(CollaborationTicket).filter(CollaborationTicket.id == ticket_id).first()
    if not ticket or ticket.creator_id != current_user.id:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if ticket.payment_status != PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Ticket must be paid before uploading design")
        
    url, _ = await save_upload_file(file, subfolder="designs")
    ticket.design_file_url = url
    ticket.workflow_status = TicketStatus.DESIGN_SUBMITTED
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/decline", response_model=TicketResponse)
def decline_ticket(
    ticket_id: int,
    req: TicketDecline,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Print partner declines a ticket -- a short reason is required so both
    the creator and, over time, admin can see patterns."""
    partner_record = partner_identity.require_partner_record(db, current_user)

    ticket = db.query(CollaborationTicket).filter(CollaborationTicket.id == ticket_id).first()
    if not ticket or ticket.print_partner_id != partner_record.id:
        raise HTTPException(status_code=404, detail="Ticket not found for this partner")

    if ticket.workflow_status in [TicketStatus.AGREED, TicketStatus.REJECTED, TicketStatus.EXPIRED]:
        raise HTTPException(status_code=400, detail="Ticket cannot be declined in its current state")

    if not req.reason or not req.reason.strip():
        raise HTTPException(status_code=400, detail="A reason is required to decline a ticket")

    ticket.workflow_status = TicketStatus.REJECTED
    ticket.decline_reason = req.reason.strip()
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/certify", response_model=CertificationReportResponse)
async def submit_certification(
    ticket_id: int,
    report: CertificationReportCreate = Depends(),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Submit a certification report by the print partner."""
    partner_record = partner_identity.require_partner_record(db, current_user)

    ticket = db.query(CollaborationTicket).filter(CollaborationTicket.id == ticket_id).first()
    if not ticket or ticket.print_partner_id != partner_record.id:
        raise HTTPException(status_code=404, detail="Ticket not found for this partner")
        
    if ticket.workflow_status not in [TicketStatus.DESIGN_SUBMITTED, TicketStatus.SAMPLE_PRINTING]:
        raise HTTPException(status_code=400, detail="Ticket is not in a valid state for certification")
        
    total_cost = report.material_cost + report.labor_cost + report.machine_time_cost + report.overhead_cost
    
    photo_url = None
    if file:
        photo_url, _ = await save_upload_file(file, subfolder="certifications")
        
    cert_report = CertificationReport(
        ticket_id=ticket.id,
        material_cost=report.material_cost,
        labor_cost=report.labor_cost,
        machine_time_cost=report.machine_time_cost,
        overhead_cost=report.overhead_cost,
        total_manufacturing_cost=total_cost,
        print_duration=report.print_duration,
        suggested_unit_price=report.suggested_unit_price,
        sample_photo=photo_url,
        notes=report.notes
    )
    
    ticket.workflow_status = TicketStatus.CERTIFIED
    
    db.add(cert_report)
    db.add(ticket)
    db.commit()
    db.refresh(cert_report)
    return cert_report


@router.get("/tickets/{ticket_id}/messages", response_model=List[MessageResponse])
def get_messages(
    ticket_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get all messages for a ticket."""
    ticket = db.query(CollaborationTicket).filter(CollaborationTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Access control: only creator or assigned partner
    if not partner_identity.is_ticket_party(db, ticket, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to view these messages")
        
    messages = db.query(CollaborationMessage).filter(CollaborationMessage.ticket_id == ticket_id).order_by(CollaborationMessage.timestamp.asc()).all()
    return messages


@router.post("/tickets/{ticket_id}/messages", response_model=MessageResponse)
def send_message(
    ticket_id: int,
    req: MessageCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Send a message in the ticket negotiation chat."""
    ticket = db.query(CollaborationTicket).filter(CollaborationTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not partner_identity.is_ticket_party(db, ticket, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to send messages on this ticket")
        
    message = CollaborationMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        content=req.content
    )
    
    # If the ticket is certified and they are chatting, it moves to negotiating
    if ticket.workflow_status == TicketStatus.CERTIFIED:
        ticket.workflow_status = TicketStatus.NEGOTIATING
        
    db.add(message)
    db.add(ticket)
    db.commit()
    db.refresh(message)
    return message


@router.post("/tickets/{ticket_id}/agree", response_model=AgreementResponse)
def confirm_agreement(
    ticket_id: int,
    req: AgreementFinalize,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Two-step confirmation for an agreement."""
    ticket = db.query(CollaborationTicket).filter(CollaborationTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not partner_identity.is_ticket_party(db, ticket, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")

    is_partner_side = current_user.role == UserRole.print_partner


    if ticket.workflow_status not in [TicketStatus.NEGOTIATING, TicketStatus.CERTIFIED, TicketStatus.AGREED]:
        raise HTTPException(status_code=400, detail="Cannot finalize agreement in this status")
        
    agreement = db.query(CollaborationAgreement).filter(CollaborationAgreement.ticket_id == ticket_id).first()
    
    if not agreement:
        agreement = CollaborationAgreement(
            ticket_id=ticket.id,
            creator_id=ticket.creator_id,
            print_partner_id=ticket.print_partner_id,
            product_reference=ticket.product_reference,
            final_unit_price=req.final_unit_price,
            status=AgreementStatus.PENDING
        )
        db.add(agreement)
        db.flush()
        
    # If the price changed during pending, we reset confirmations
    if agreement.final_unit_price != req.final_unit_price:
        agreement.final_unit_price = req.final_unit_price
        agreement.creator_confirmed = False
        agreement.partner_confirmed = False
        
    if current_user.id == ticket.creator_id:
        agreement.creator_confirmed = True
    elif is_partner_side:
        agreement.partner_confirmed = True
        
    # If both confirmed, mark as agreed
    if agreement.creator_confirmed and agreement.partner_confirmed:
        agreement.status = AgreementStatus.ACTIVE
        ticket.workflow_status = TicketStatus.AGREED
        db.add(ticket)
        
    db.add(agreement)
    db.commit()
    db.refresh(agreement)
    return agreement


@router.get("/tickets", response_model=List[TicketResponse])
def get_tickets(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """List tickets for the current user -- the partner's ticket inbox, or the
    creator's own tickets."""
    if current_user.role == UserRole.creator:
        tickets = db.query(CollaborationTicket).filter(CollaborationTicket.creator_id == current_user.id).all()
    elif current_user.role == UserRole.print_partner:
        partner_record = partner_identity.get_or_create_partner_record(db, current_user)
        db.commit()  # persist a lazily-provisioned PrintPartner row -- get_db never auto-commits
        tickets = db.query(CollaborationTicket).filter(CollaborationTicket.print_partner_id == partner_record.id).all()
    else:
        tickets = []

    return tickets


@router.get("/tickets/{ticket_id}", response_model=TicketDetailsResponse)
def get_ticket_details(
    ticket_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get ticket details including certification report and agreement if any."""
    ticket = db.query(CollaborationTicket).filter(CollaborationTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not partner_identity.is_ticket_party(db, ticket, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    report = db.query(CertificationReport).filter(CertificationReport.ticket_id == ticket_id).first()
    agreement = db.query(CollaborationAgreement).filter(CollaborationAgreement.ticket_id == ticket_id).first()
    
    partner = db.query(PrintPartner).filter(PrintPartner.id == ticket.print_partner_id).first()
    
    return {
        "ticket": ticket,
        "certification_report": report,
        "agreement": agreement,
        "partner_name": partner.name if partner else "Unknown"
    }
