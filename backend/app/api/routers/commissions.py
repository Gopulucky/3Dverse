from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.core.invoice import generate_invoice_pdf
from app.core.partner_assignment import assign_print_partner
from app.core.storage import save_upload_file
from app.models.collaboration import AgreementStatus, PaymentStatus
from app.models.commission import (
    CommissionIntent,
    CommissionStatus,
    CustomDesignAgreement,
    CustomDesignMessage,
    CustomDesignProposal,
    CustomDesignRequest,
)
from app.models.order import Order, OrderItem, OrderMode
from app.models.product import FulfillmentStatus, Product, ProductStatus, ProductVersion
from app.models.user import CreatorType, User, UserRole
from app.schemas.commission import (
    CommissionAgreementFinalize,
    CommissionAgreementResponse,
    CommissionCreate,
    CommissionDecline,
    CommissionDetails,
    CommissionListItem,
    CommissionMessageCreate,
    CommissionMessageResponse,
    CommissionResponse,
    PrintOrderRequest,
    ProposalCreate,
    ProposalResponse,
    RevisionRequest,
)

router = APIRouter()

BRIEF_FEE = 25.0

# Statuses in which the request is finished or abandoned — nothing may change.
CLOSED_STATUSES = {
    CommissionStatus.COMPLETED,
    CommissionStatus.DECLINED,
    CommissionStatus.CANCELLED,
}


def _display_name(user: Optional[User]) -> str:
    if not user:
        return "Unknown"
    return user.full_name or user.company_name or user.email.split("@")[0]


def _load(db: Session, request_id: int, user: User) -> CustomDesignRequest:
    """Fetch a request the caller is a party to. A non-party gets a 404 rather
    than a 403, so request IDs can't be enumerated."""
    req = db.query(CustomDesignRequest).filter(CustomDesignRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if user.role != UserRole.admin and user.id not in (req.customer_id, req.creator_id):
        raise HTTPException(status_code=404, detail="Request not found")
    return req


def _require_customer(req: CustomDesignRequest, user: User) -> None:
    if user.id != req.customer_id:
        raise HTTPException(status_code=403, detail="Only the customer who opened this request can do this")


def _require_creator(req: CustomDesignRequest, user: User) -> None:
    if user.id != req.creator_id:
        raise HTTPException(status_code=403, detail="Only the commissioned creator can do this")


def _viewer_side(req: CustomDesignRequest, user: User) -> str:
    if user.id == req.customer_id:
        return "customer"
    if user.id == req.creator_id:
        return "creator"
    return "admin"


@router.get("/creators")
def browse_creators(
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Creators a customer can commission a custom design from. All three creator
    paths take commissions — designing is common to all of them; only who prints
    the result differs."""
    query = db.query(User).filter(
        User.role == UserRole.creator,
        User.is_active == True,
        User.deleted_at.is_(None),
        User.id != current_user.id,
    )

    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(User.full_name.ilike(term), User.company_name.ilike(term), User.bio.ilike(term))
        )

    creators = query.limit(60).all()

    published_counts = dict(
        db.query(Product.creator_id, func.count(Product.id))
        .filter(Product.status == ProductStatus.published)
        .group_by(Product.creator_id)
        .all()
    )

    results = []
    for c in creators:
        specializations = c.specializations or []
        if category and category not in specializations:
            continue
        results.append(
            {
                "id": c.id,
                "name": _display_name(c),
                "creator_type": c.creator_type.value if c.creator_type else None,
                "creator_tier": c.creator_tier.value if c.creator_tier else None,
                "bio": c.bio,
                "avatar_url": c.avatar_url,
                "specializations": specializations,
                "portfolio_images": (c.portfolio_images or [])[:3],
                "published_products": published_counts.get(c.id, 0),
                "response_time_hours": c.response_time_hours,
            }
        )
    return results


@router.post("/requests", response_model=CommissionResponse)
def create_request(
    body: CommissionCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Open a custom design request against a creator. Costs a brief fee, paid
    next — the same shape as the evaluation ticket a creator buys from a print
    partner, and for the same reason: it makes the request worth reading."""
    if body.creator_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot commission yourself")

    creator = (
        db.query(User)
        .filter(
            User.id == body.creator_id,
            User.role == UserRole.creator,
            User.is_active == True,
            User.deleted_at.is_(None),
        )
        .first()
    )
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")

    if not body.title.strip() or not body.brief.strip():
        raise HTTPException(status_code=400, detail="A title and a brief are required")

    req = CustomDesignRequest(
        customer_id=current_user.id,
        creator_id=creator.id,
        title=body.title.strip(),
        brief=body.brief.strip(),
        category=body.category,
        target_budget=body.target_budget,
        desired_material=body.desired_material,
        desired_color=body.desired_color,
        dimensions_note=body.dimensions_note,
        intent=body.intent,
        brief_fee=BRIEF_FEE,
        payment_status=PaymentStatus.PENDING,
        design_fee_status=PaymentStatus.PENDING,
        workflow_status=CommissionStatus.PENDING_PAYMENT,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.post("/requests/{request_id}/reference", response_model=CommissionResponse)
async def upload_reference(
    request_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Attach a reference image or sketch to the brief."""
    req = _load(db, request_id, current_user)
    _require_customer(req, current_user)
    if req.workflow_status in CLOSED_STATUSES:
        raise HTTPException(status_code=400, detail="This request is closed")

    url, _size = await save_upload_file(file, subfolder="commission_references")
    req.reference_image_url = url
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.post("/requests/{request_id}/pay", response_model=CommissionResponse)
def pay_brief_fee(
    request_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Mock brief-fee payment — stands in until a payment provider is wired up."""
    req = _load(db, request_id, current_user)
    _require_customer(req, current_user)

    if req.payment_status == PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="The brief fee is already paid")

    req.payment_status = PaymentStatus.COMPLETED
    req.workflow_status = CommissionStatus.SUBMITTED
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get("/requests", response_model=List[CommissionListItem])
def list_requests(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Both inboxes off one endpoint: a customer's own requests, and a creator's
    incoming ones. Unpaid requests stay hidden from the creator."""
    mine_as_customer = CustomDesignRequest.customer_id == current_user.id
    # An unpaid brief is not yet a request anyone else can see.
    mine_as_creator = (CustomDesignRequest.creator_id == current_user.id) & (
        CustomDesignRequest.payment_status == PaymentStatus.COMPLETED
    )

    requests = (
        db.query(CustomDesignRequest)
        .filter(or_(mine_as_customer, mine_as_creator))
        .order_by(CustomDesignRequest.updated_at.desc())
        .all()
    )

    counterparty_ids = {
        r.creator_id if r.customer_id == current_user.id else r.customer_id for r in requests
    }
    names = {
        u.id: _display_name(u)
        for u in db.query(User).filter(User.id.in_(counterparty_ids)).all()
    } if counterparty_ids else {}

    return [
        CommissionListItem(
            request=CommissionResponse.model_validate(r),
            counterparty_name=names.get(
                r.creator_id if r.customer_id == current_user.id else r.customer_id, "Unknown"
            ),
        )
        for r in requests
    ]


@router.get("/requests/{request_id}", response_model=CommissionDetails)
def get_request(
    request_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    req = _load(db, request_id, current_user)

    proposal = (
        db.query(CustomDesignProposal).filter(CustomDesignProposal.request_id == req.id).first()
    )
    agreement = (
        db.query(CustomDesignAgreement).filter(CustomDesignAgreement.request_id == req.id).first()
    )
    creator = db.query(User).filter(User.id == req.creator_id).first()
    customer = db.query(User).filter(User.id == req.customer_id).first()

    return CommissionDetails(
        request=CommissionResponse.model_validate(req),
        proposal=ProposalResponse.model_validate(proposal) if proposal else None,
        agreement=CommissionAgreementResponse.model_validate(agreement) if agreement else None,
        creator_name=_display_name(creator),
        customer_name=_display_name(customer),
        viewer_side=_viewer_side(req, current_user),
    )


@router.post("/requests/{request_id}/accept", response_model=CommissionResponse)
def accept_request(
    request_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Creator takes the commission on. Nothing is priced yet — that's the proposal."""
    req = _load(db, request_id, current_user)
    _require_creator(req, current_user)

    if req.workflow_status != CommissionStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Only a newly submitted request can be accepted")

    req.workflow_status = CommissionStatus.ACCEPTED
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.post("/requests/{request_id}/decline", response_model=CommissionResponse)
def decline_request(
    request_id: int,
    body: CommissionDecline,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """A creator isn't obliged to take every commission; a short reason is
    required so the customer knows whether to reword the brief or find someone else."""
    req = _load(db, request_id, current_user)
    _require_creator(req, current_user)

    if req.workflow_status in CLOSED_STATUSES or req.workflow_status in (
        CommissionStatus.AGREED,
        CommissionStatus.DELIVERED,
    ):
        raise HTTPException(status_code=400, detail="This request can no longer be declined")
    if not body.reason.strip():
        raise HTTPException(status_code=400, detail="A reason is required to decline a request")

    req.workflow_status = CommissionStatus.DECLINED
    req.decline_reason = body.reason.strip()
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.post("/requests/{request_id}/cancel", response_model=CommissionResponse)
def cancel_request(
    request_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """The customer can back out until the creator has quoted."""
    req = _load(db, request_id, current_user)
    _require_customer(req, current_user)

    if req.workflow_status not in (
        CommissionStatus.PENDING_PAYMENT,
        CommissionStatus.SUBMITTED,
        CommissionStatus.ACCEPTED,
    ):
        raise HTTPException(
            status_code=400, detail="A request can only be cancelled before the creator has quoted"
        )

    req.workflow_status = CommissionStatus.CANCELLED
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.post("/requests/{request_id}/proposal", response_model=ProposalResponse)
async def submit_proposal(
    request_id: int,
    body: ProposalCreate = Depends(),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """The creator's quote: design fee, revisions included, lead time, plus a
    per-unit print price when the customer asked for a physical copy. Re-submitting
    replaces the previous quote and resets both confirmations."""
    req = _load(db, request_id, current_user)
    _require_creator(req, current_user)

    if req.workflow_status not in (
        CommissionStatus.ACCEPTED,
        CommissionStatus.QUOTED,
        CommissionStatus.NEGOTIATING,
    ):
        raise HTTPException(status_code=400, detail="This request is not in a state to be quoted")
    if body.design_fee <= 0 or body.delivery_days <= 0:
        raise HTTPException(status_code=400, detail="Design fee and delivery days must be positive")
    if body.revisions_included < 0:
        raise HTTPException(status_code=400, detail="Revisions included cannot be negative")
    if req.intent == CommissionIntent.PRINT_TOO and not body.print_unit_price:
        raise HTTPException(
            status_code=400,
            detail="This customer wants the design printed too — quote a per-unit print price.",
        )

    image_url = None
    if file:
        image_url, _size = await save_upload_file(file, subfolder="commission_concepts")

    proposal = (
        db.query(CustomDesignProposal).filter(CustomDesignProposal.request_id == req.id).first()
    )
    if not proposal:
        proposal = CustomDesignProposal(request_id=req.id)
        db.add(proposal)

    proposal.design_fee = body.design_fee
    proposal.revisions_included = body.revisions_included
    proposal.delivery_days = body.delivery_days
    proposal.print_unit_price = body.print_unit_price
    proposal.scope_notes = body.scope_notes
    if image_url:
        proposal.concept_image = image_url

    # A re-quote invalidates any confirmations made against the old price.
    agreement = (
        db.query(CustomDesignAgreement).filter(CustomDesignAgreement.request_id == req.id).first()
    )
    if agreement:
        agreement.customer_confirmed = False
        agreement.creator_confirmed = False
        agreement.status = AgreementStatus.PENDING
        db.add(agreement)

    req.workflow_status = CommissionStatus.QUOTED
    db.add(req)
    db.commit()
    db.refresh(proposal)
    return proposal


@router.get("/requests/{request_id}/messages", response_model=List[CommissionMessageResponse])
def get_messages(
    request_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    req = _load(db, request_id, current_user)
    return (
        db.query(CustomDesignMessage)
        .filter(CustomDesignMessage.request_id == req.id)
        .order_by(CustomDesignMessage.timestamp.asc())
        .all()
    )


@router.post("/requests/{request_id}/messages", response_model=CommissionMessageResponse)
def send_message(
    request_id: int,
    body: CommissionMessageCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    req = _load(db, request_id, current_user)
    if req.workflow_status == CommissionStatus.PENDING_PAYMENT:
        raise HTTPException(status_code=400, detail="Pay the brief fee to start the conversation")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    message = CustomDesignMessage(
        request_id=req.id, sender_id=current_user.id, content=body.content.strip()
    )
    if req.workflow_status == CommissionStatus.QUOTED:
        req.workflow_status = CommissionStatus.NEGOTIATING
        db.add(req)

    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.post("/requests/{request_id}/agree", response_model=CommissionAgreementResponse)
def confirm_agreement(
    request_id: int,
    body: CommissionAgreementFinalize,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Two-sided price confirmation. Either party proposing a different number
    resets both confirmations, so nobody is bound to a price they didn't see."""
    req = _load(db, request_id, current_user)
    side = _viewer_side(req, current_user)
    if side == "admin":
        raise HTTPException(status_code=403, detail="Only the two parties can confirm an agreement")

    if req.workflow_status not in (
        CommissionStatus.QUOTED,
        CommissionStatus.NEGOTIATING,
        CommissionStatus.AGREED,
    ):
        raise HTTPException(status_code=400, detail="Cannot finalize an agreement in this state")
    if body.final_price <= 0:
        raise HTTPException(status_code=400, detail="The final price must be positive")

    proposal = (
        db.query(CustomDesignProposal).filter(CustomDesignProposal.request_id == req.id).first()
    )
    agreement = (
        db.query(CustomDesignAgreement).filter(CustomDesignAgreement.request_id == req.id).first()
    )
    if not agreement:
        agreement = CustomDesignAgreement(
            request_id=req.id,
            customer_id=req.customer_id,
            creator_id=req.creator_id,
            final_price=body.final_price,
            delivery_days=proposal.delivery_days if proposal else None,
            status=AgreementStatus.PENDING,
        )
        db.add(agreement)
        db.flush()

    if agreement.final_price != body.final_price:
        agreement.final_price = body.final_price
        agreement.customer_confirmed = False
        agreement.creator_confirmed = False
        agreement.status = AgreementStatus.PENDING

    if side == "customer":
        agreement.customer_confirmed = True
    else:
        agreement.creator_confirmed = True

    if agreement.customer_confirmed and agreement.creator_confirmed:
        agreement.status = AgreementStatus.ACTIVE
        req.workflow_status = CommissionStatus.AGREED
        db.add(req)

    db.add(agreement)
    db.commit()
    db.refresh(agreement)
    return agreement


@router.post("/requests/{request_id}/pay-design-fee", response_model=CommissionResponse)
def pay_design_fee(
    request_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Mock payment of the agreed design fee. Releasing the deliverable depends
    on this, so the creator isn't handing over a file on trust."""
    req = _load(db, request_id, current_user)
    _require_customer(req, current_user)

    agreement = (
        db.query(CustomDesignAgreement).filter(CustomDesignAgreement.request_id == req.id).first()
    )
    if not agreement or agreement.status != AgreementStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Both sides must confirm the price first")
    if req.design_fee_status == PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="The design fee is already paid")

    req.design_fee_status = PaymentStatus.COMPLETED
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.post("/requests/{request_id}/deliver", response_model=CommissionResponse)
async def deliver_design(
    request_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Creator hands over the finished design. The file itself is served only
    through the entitlement-checked /api/downloads endpoint."""
    req = _load(db, request_id, current_user)
    _require_creator(req, current_user)

    if req.workflow_status != CommissionStatus.AGREED:
        raise HTTPException(status_code=400, detail="Deliver only after both sides agree on a price")
    if req.design_fee_status != PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="The customer has not paid the design fee yet")

    url, size = await save_upload_file(file, subfolder="commission_deliveries")
    req.final_design_url = url
    req.final_design_name = file.filename
    req.final_design_size = size
    req.delivered_at = datetime.utcnow()
    req.workflow_status = CommissionStatus.DELIVERED
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.post("/requests/{request_id}/revision", response_model=CommissionResponse)
def request_revision(
    request_id: int,
    body: RevisionRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Send the delivery back for a change, spending one of the revisions the
    proposal included."""
    req = _load(db, request_id, current_user)
    _require_customer(req, current_user)

    if req.workflow_status != CommissionStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="There is no delivery to revise")
    if not body.note.strip():
        raise HTTPException(status_code=400, detail="Describe what needs changing")

    proposal = (
        db.query(CustomDesignProposal).filter(CustomDesignProposal.request_id == req.id).first()
    )
    included = proposal.revisions_included if proposal else 0
    if req.revisions_used >= included:
        raise HTTPException(
            status_code=400,
            detail=f"All {included} included revision(s) have been used — agree a new scope with the creator.",
        )

    req.revisions_used += 1
    req.revision_note = body.note.strip()
    req.workflow_status = CommissionStatus.AGREED
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.post("/requests/{request_id}/complete", response_model=CommissionResponse)
def complete_request(
    request_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Customer accepts the delivery. For a file-only commission this is the end
    of the line; a physical print can still be ordered afterwards."""
    req = _load(db, request_id, current_user)
    _require_customer(req, current_user)

    if req.workflow_status != CommissionStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="Nothing has been delivered yet")

    req.workflow_status = CommissionStatus.COMPLETED
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.post("/requests/{request_id}/order-print")
def order_print(
    request_id: int,
    body: PrintOrderRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Turn a delivered custom design into a real physical order.

    The design is registered as a private (unpublished) product owned by the
    creator so it flows through the normal order, fulfillment and download paths
    without ever appearing on the marketplace.
    """
    req = _load(db, request_id, current_user)
    _require_customer(req, current_user)

    if req.workflow_status not in (CommissionStatus.DELIVERED, CommissionStatus.COMPLETED):
        raise HTTPException(status_code=400, detail="The design has to be delivered first")
    if req.print_order_id:
        raise HTTPException(
            status_code=400,
            detail="A print order already exists for this design; reorder it from your orders instead.",
        )
    if body.quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")

    proposal = (
        db.query(CustomDesignProposal).filter(CustomDesignProposal.request_id == req.id).first()
    )
    if not proposal or not proposal.print_unit_price:
        raise HTTPException(
            status_code=400,
            detail="The creator has not quoted a print price — ask them to add one to the proposal.",
        )

    creator = db.query(User).filter(User.id == req.creator_id).first()
    # A creator who owns a printer fulfills their own commission; the others need
    # the normal print-partner routing.
    fulfillment = (
        FulfillmentStatus.SELF
        if creator and creator.creator_type == CreatorType.studio
        else FulfillmentStatus.PENDING_PARTNER
    )

    product = Product(
        title=f"Custom design: {req.title}",
        description=req.brief,
        category=req.category,
        price=proposal.print_unit_price,
        creator_id=req.creator_id,
        status=ProductStatus.draft,
        is_published=False,
        material_required=req.desired_material,
        fulfillment_status=fulfillment,
    )
    db.add(product)
    db.flush()

    db.add(
        ProductVersion(
            product_id=product.id,
            file_url=req.final_design_url,
            file_name=req.final_design_name or f"custom_design_{req.id}",
            file_size=req.final_design_size or 0,
            version_number=1,
            is_latest=True,
        )
    )

    unit_price = proposal.print_unit_price
    subtotal = unit_price * body.quantity
    shipping_cost = 5.0
    order = Order(
        customer_id=current_user.id,
        mode=OrderMode.PERSONALIZED,
        shipping_address=body.shipping_address,
        shipping_cost=shipping_cost,
        subtotal=subtotal,
        total=subtotal + shipping_cost,
        status="pending_payment",
    )
    db.add(order)
    db.flush()

    db.add(
        OrderItem(
            order_id=order.id,
            product_id=product.id,
            price_at_purchase=unit_price,
            quantity=body.quantity,
            selected_config={
                "custom_design_request_id": req.id,
                "material": req.desired_material,
                "color": req.desired_color,
            },
        )
    )
    req.print_order_id = order.id
    db.add(req)
    db.commit()
    db.refresh(order)

    if not settings.is_production:
        # Development convenience only, matching /api/orders/confirm: stand in for
        # the payment confirmation a provider webhook will perform in production.
        order.status = "paid"
        db.add(order)
        db.commit()
        if assign_print_partner(db, order):
            order.status = "queued"
            db.add(order)
            db.commit()
        db.refresh(order)

    try:
        order.invoice_url = generate_invoice_pdf(
            order.id,
            current_user.full_name or "Customer",
            [{"title": product.title, "quantity": body.quantity, "price": unit_price}],
            subtotal,
            shipping_cost,
            order.total,
        )
        db.add(order)
        db.commit()
    except Exception:
        # A missing invoice must not lose the order — it can be regenerated.
        db.rollback()

    return {"order_id": order.id, "status": order.status, "total": order.total}
