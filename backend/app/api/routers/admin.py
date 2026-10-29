from datetime import datetime
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api import deps
from app.models.user import User, UserRole
from app.models.order import Order, OrderItem
from app.models.product import Product, ProductStatus, SafetyReviewStatus
from app.models.filament_spool import FilamentSpool
from app.models.printer import PrinterProfile
from app.models.return_request import ReturnRequest, ReturnStatus
from app.models.defect_report import DefectReport
from app.services import stock as stock_service
from app.services import trust_safety

router = APIRouter()

def require_admin(user: User) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can access this endpoint")
    return user

# --- Customer / User Management ---

@router.get("/users")
def list_users(
    role: Optional[str] = None,
    q: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Admin endpoint to list all users, optionally filtered by role, status or search."""
    require_admin(current_user)
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if q:
        term = f"%{q.lower()}%"
        query = query.filter(
            func.lower(User.email).like(term) | func.lower(func.coalesce(User.full_name, "")).like(term)
        )
    users = query.order_by(User.id).all()

    # Per-user activity counts, resolved in two grouped queries rather than N+1
    order_counts = dict(
        db.query(Order.customer_id, func.count(Order.id)).group_by(Order.customer_id).all()
    )
    product_counts = dict(
        db.query(Product.creator_id, func.count(Product.id)).group_by(Product.creator_id).all()
    )

    return [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role.value if hasattr(u.role, 'value') else u.role,
            "full_name": u.full_name,
            "company_name": u.company_name,
            "pincode": u.pincode,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "is_active": u.is_active,
            "order_count": order_counts.get(u.id, 0),
            "product_count": product_counts.get(u.id, 0),
            "is_self": u.id == current_user.id,
        }
        for u in users
    ]


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    role: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Admin endpoint to change a user's role."""
    require_admin(current_user)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role")
    try:
        new_role = UserRole(role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown role '{role}'")

    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = new_role
    db.commit()
    db.refresh(user)
    return {"id": user.id, "role": user.role.value}


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    is_active: bool,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Admin endpoint to activate or suspend a user."""
    require_admin(current_user)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot suspend your own account")

    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return {"id": user.id, "is_active": user.is_active}

# --- Order Management ---

@router.get("/orders")
def list_orders(
    status: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Admin endpoint to list all orders with customer and partner resolved."""
    require_admin(current_user)
    query = db.query(Order).order_by(Order.created_at.desc())
    if status:
        query = query.filter(Order.status == status)
    orders = query.all()

    # Resolve the users referenced by these orders in one query
    user_ids = {o.customer_id for o in orders} | {o.print_partner_id for o in orders if o.print_partner_id}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    item_counts = dict(
        db.query(OrderItem.order_id, func.sum(OrderItem.quantity))
        .group_by(OrderItem.order_id)
        .all()
    )

    def label(user_id):
        u = users.get(user_id)
        if not u:
            return None
        return u.full_name or u.email

    rows = [
        {
            "id": o.id,
            "customer_id": o.customer_id,
            "customer_name": label(o.customer_id),
            "customer_email": users[o.customer_id].email if o.customer_id in users else None,
            "status": o.status,
            "mode": o.mode.value if o.mode and hasattr(o.mode, 'value') else o.mode,
            "subtotal": o.subtotal,
            "shipping_cost": o.shipping_cost,
            "total": o.total,
            "item_count": int(item_counts.get(o.id, 0) or 0),
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "print_partner_id": o.print_partner_id,
            "print_partner_name": label(o.print_partner_id),
            "defect_reported": o.defect_reported,
            "reprint_issued": o.reprint_issued,
            "tracking_url": o.tracking_url,
        }
        for o in orders
    ]

    if q:
        term = q.lower().lstrip("#")
        rows = [
            r for r in rows
            if term in str(r["id"])
            or term in (r["customer_email"] or "").lower()
            or term in (r["customer_name"] or "").lower()
        ]
    return rows

@router.patch("/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    status: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Admin endpoint to force update an order's status."""
    require_admin(current_user)
    order = db.query(Order).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status
    db.commit()
    db.refresh(order)
    return {"id": order.id, "status": order.status}

# --- Product Management ---

@router.get("/products")
def list_products(
    status: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Admin endpoint to list all products with creator resolved."""
    require_admin(current_user)
    query = db.query(Product).order_by(Product.created_at.desc())
    if status:
        query = query.filter(Product.status == status)
    if q:
        query = query.filter(func.lower(Product.title).like(f"%{q.lower()}%"))
    products = query.all()

    creator_ids = {p.creator_id for p in products}
    creators = (
        {u.id: u for u in db.query(User).filter(User.id.in_(creator_ids)).all()}
        if creator_ids else {}
    )

    sold_counts = dict(
        db.query(OrderItem.product_id, func.sum(OrderItem.quantity))
        .group_by(OrderItem.product_id)
        .all()
    )

    return [
        {
            "id": p.id,
            "title": p.title,
            "category": p.category,
            "status": p.status.value if hasattr(p.status, 'value') else p.status,
            "is_published": p.is_published,
            "is_featured": p.is_featured,
            "price": p.price,
            "creator_id": p.creator_id,
            "creator_name": (
                creators[p.creator_id].full_name or creators[p.creator_id].email
                if p.creator_id in creators else None
            ),
            "units_sold": int(sold_counts.get(p.id, 0) or 0),
            "safety_review_status": p.safety_review_status.value,
            "safety_review_note": p.safety_review_note,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in products
    ]


class SafetyReviewDecision(BaseModel):
    safety_review_status: str  # approved | rejected
    note: Optional[str] = None


@router.get("/products/safety-review-queue")
def safety_review_queue(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Designs awaiting the restricted/dangerous-item screen before they may
    publish -- independent of the automated printability check."""
    require_admin(current_user)
    products = (
        db.query(Product)
        .filter(Product.safety_review_status == SafetyReviewStatus.pending)
        .order_by(Product.created_at.asc())
        .all()
    )
    return [
        {
            "id": p.id,
            "title": p.title,
            "description": p.description,
            "category": p.category,
            "creator_id": p.creator_id,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "media": [m.media_url for m in p.media],
        }
        for p in products
    ]


@router.patch("/products/{product_id}/safety-review")
def decide_safety_review(
    product_id: int,
    body: SafetyReviewDecision,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Approve or reject a design for restricted/dangerous content. A rejection
    blocks publish regardless of printability status."""
    require_admin(current_user)

    if body.safety_review_status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="safety_review_status must be approved or rejected")

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.safety_review_status = SafetyReviewStatus(body.safety_review_status)
    product.safety_review_note = body.note
    product.safety_reviewed_at = datetime.utcnow()

    # A rejection on an already-published product pulls it down immediately.
    if body.safety_review_status == "rejected" and product.status == ProductStatus.published:
        product.status = ProductStatus.draft
        product.is_published = False

    db.add(product)
    db.commit()
    db.refresh(product)
    return {
        "id": product.id,
        "safety_review_status": product.safety_review_status.value,
        "status": product.status.value,
    }


@router.patch("/products/{product_id}/status")
def update_product_status(
    product_id: int,
    status: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Admin endpoint to delist or moderate products."""
    require_admin(current_user)
    product = db.query(Product).filter_by(id=product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product.status = status
    db.commit()
    db.refresh(product)
    return {"id": product.id, "status": product.status.value if hasattr(product.status, 'value') else product.status}

# --- Returns (Subsection C standard returns) ---

class ReturnDecision(BaseModel):
    status: ReturnStatus
    resolution_note: Optional[str] = None
    refund_amount: Optional[float] = None
    restock: bool = True  # only consulted when status == received


@router.get("/returns")
def list_return_requests(
    status: Optional[ReturnStatus] = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Admin queue for Direct Seller standard returns."""
    require_admin(current_user)
    query = db.query(ReturnRequest).order_by(ReturnRequest.requested_at.desc())
    if status:
        query = query.filter(ReturnRequest.status == status)
    requests = query.all()

    order_ids = {r.order_id for r in requests}
    customer_ids = {r.customer_id for r in requests}
    customers = (
        {u.id: u for u in db.query(User).filter(User.id.in_(customer_ids)).all()}
        if customer_ids else {}
    )
    orders = (
        {o.id: o for o in db.query(Order).filter(Order.id.in_(order_ids)).all()}
        if order_ids else {}
    )

    return [
        {
            "id": r.id,
            "order_id": r.order_id,
            "order_item_id": r.order_item_id,
            "customer_name": (
                customers[r.customer_id].full_name or customers[r.customer_id].email
                if r.customer_id in customers else None
            ),
            "order_total": orders[r.order_id].total if r.order_id in orders else None,
            "quantity": r.quantity,
            "reason": r.reason.value,
            "description": r.description,
            "status": r.status.value,
            "requested_at": r.requested_at.isoformat() if r.requested_at else None,
        }
        for r in requests
    ]


@router.patch("/returns/{return_id}")
def decide_return_request(
    return_id: int,
    body: ReturnDecision,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Approve, reject, or resolve a standard return. Marking a return
    'received' restocks the units (or logs them as damaged) automatically."""
    require_admin(current_user)
    request = db.query(ReturnRequest).filter(ReturnRequest.id == return_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Return request not found")

    if body.status == ReturnStatus.REFUNDED:
        # A database label is not evidence that funds were returned. Keep the
        # request unresolved until a gateway refund/reconciliation flow exists.
        raise HTTPException(status_code=503, detail="Refund settlement is unavailable. No refund has been issued; escalate to the payment operator.")

    if body.status == ReturnStatus.RECEIVED and request.status != ReturnStatus.RECEIVED:
        stock_service.restock_from_return(
            db, request.order_item, request.quantity, resellable=body.restock, order_id=request.order_id,
        )

    request.status = body.status
    if body.resolution_note is not None:
        request.resolution_note = body.resolution_note
    if body.refund_amount is not None:
        request.refund_amount = body.refund_amount
    if body.status in (ReturnStatus.REJECTED, ReturnStatus.REFUNDED):
        request.resolved_at = datetime.utcnow()

    db.add(request)
    db.commit()
    db.refresh(request)
    return {
        "id": request.id,
        "status": request.status.value,
        "refund_amount": request.refund_amount,
        "resolution_note": request.resolution_note,
    }


# --- Trust & Safety ---

class DefectDecision(BaseModel):
    reprint_status: str  # approved | denied | reprinted


@router.get("/defect-reports")
def list_defect_reports(
    reprint_status: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Defect/reprint review queue for Subsections A and B (48h window,
    approve/deny the reprint)."""
    require_admin(current_user)
    query = db.query(DefectReport).order_by(DefectReport.reported_at.desc())
    if reprint_status:
        query = query.filter(DefectReport.reprint_status == reprint_status)
    reports = query.all()

    order_ids = {r.order_id for r in reports}
    orders = (
        {o.id: o for o in db.query(Order).filter(Order.id.in_(order_ids)).all()}
        if order_ids else {}
    )

    return [
        {
            "id": r.id,
            "order_id": r.order_id,
            "customer_id": orders[r.order_id].customer_id if r.order_id in orders else None,
            "order_total": orders[r.order_id].total if r.order_id in orders else None,
            "description": r.description,
            "within_window": r.within_window,
            "reprint_status": r.reprint_status,
            "reported_at": r.reported_at.isoformat() if r.reported_at else None,
        }
        for r in reports
    ]


@router.patch("/defect-reports/{report_id}")
def decide_defect_report(
    report_id: int,
    body: DefectDecision,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Approve or deny a free reprint. This is a remedy, never a refund --
    approving flips the order's reprint_issued flag rather than crediting money."""
    require_admin(current_user)
    if body.reprint_status not in ("approved", "denied", "reprinted"):
        raise HTTPException(status_code=400, detail="reprint_status must be approved, denied, or reprinted")

    report = db.query(DefectReport).filter(DefectReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Defect report not found")

    report.reprint_status = body.reprint_status
    db.add(report)

    if body.reprint_status in ("approved", "reprinted"):
        order = db.query(Order).filter(Order.id == report.order_id).first()
        if order:
            order.reprint_issued = True
            db.add(order)

    db.commit()
    return {"id": report.id, "reprint_status": report.reprint_status}


@router.get("/trust-safety/flags")
def trust_safety_flags(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Rule-based risk signals: defect-rate spikes, partner reship rate above
    target, repeated ticket disputes. Deliberately simple until there is enough
    real dispute data to justify a trained model."""
    require_admin(current_user)
    return trust_safety.all_flags(db)


# --- Inventory Control ---

@router.get("/inventory")
def platform_inventory(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Admin endpoint to view aggregate platform filament stock."""
    require_admin(current_user)
    
    # Calculate total weight from spools
    total_weight = db.query(func.sum(FilamentSpool.total_weight_g)).scalar() or 0.0
    
    # Group by material type
    materials = db.query(
        FilamentSpool.material_type, 
        func.sum(FilamentSpool.total_weight_g).label('total_weight')
    ).group_by(FilamentSpool.material_type).all()
    
    material_breakdown = [
        {"material_type": m[0], "total_weight_g": m[1]}
        for m in materials
    ]
    
    return {
        "total_filament_g": total_weight,
        "material_breakdown": material_breakdown
    }

# --- Printer Management ---

@router.get("/printers/usage-summary")
def printer_usage_summary(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    require_admin(current_user)
    rows = (db.query(PrinterProfile.owner_type, PrinterProfile.technology,
                     func.count(PrinterProfile.id))
              .group_by(PrinterProfile.owner_type, PrinterProfile.technology)
              .all())
    summary = {}
    for owner_type, technology, count in rows:
        summary.setdefault(owner_type, {})[technology.value] = count
    return summary
