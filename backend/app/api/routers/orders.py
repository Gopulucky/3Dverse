from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session, defer, joinedload, selectinload
from app.api import deps
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.models.cart import Cart
from app.models.order import Order, OrderItem, UNPAID_STATUSES
from app.models.defect_report import DefectReport
from app.models.return_request import ReturnRequest, ReturnReason, ReturnStatus
from app.models.product import Product
from app.schemas.order import CustomerOrderResponse, OrderCreate, OrderResponse
from app.core.config import settings
from app.services import payments
from app.services import returns, stock
from app.services.coupons import InvalidCoupon, compute_discount, get_valid_coupon

router = APIRouter()


class DefectReportRequest(BaseModel):
    description: str


class ReturnRequestCreate(BaseModel):
    order_item_id: int
    quantity: int = 1
    reason: ReturnReason
    description: str | None = None

def _with_lines():
    """Load items, products and images in three queries for any number of
    orders, instead of several lazy queries per order."""
    return selectinload(Order.items).joinedload(OrderItem.product).options(
        defer(Product.embedding), selectinload(Product.media)
    )


@router.get("/", response_model=List[CustomerOrderResponse])
def get_orders(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    # Orders are things that were paid for or have progressed. An unpaid checkout
    # attempt is a hold, shown as a banner (see /api/checkout/hold), never an order.
    return (
        db.query(Order)
        .options(_with_lines())
        .filter(Order.customer_id == current_user.id,
                or_(Order.payment_verified_at.isnot(None), Order.status.notin_(UNPAID_STATUSES)))
        .order_by(Order.created_at.desc(), Order.id.desc())
        .all()
    )

@router.get("/{order_id}", response_model=CustomerOrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    order = db.query(Order).options(_with_lines()).filter(Order.id == order_id, Order.customer_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.post("/{order_id}/cancel", response_model=CustomerOrderResponse)
def cancel_order(
    order_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Customer-initiated cancel, only while the order hasn't been paid for
    yet. Releases any stock reserved for it back to sellable."""
    order = db.query(Order).filter(Order.id == order_id, Order.customer_id == current_user.id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    payments.cancel_pending_order(db, order)
    db.add(order)
    db.commit()
    db.refresh(order)
    return order

@router.get("/{order_id}/return-policy")
def get_return_policy(
    order_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Which return path this order falls under, so the customer sees the right
    action: a 48h defect reprint for made-to-order items, or a standard return."""
    order = db.query(Order).filter(Order.id == order_id, Order.customer_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return returns.order_return_policy(order)


@router.post("/{order_id}/defect-report")
def report_defect(
    order_id: int,
    req: DefectReportRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Customer reports a defect on a made-to-order item -- triggers a free
    reprint, never a refund."""
    order = db.query(Order).filter(Order.id == order_id, Order.customer_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    policy = returns.order_return_policy(order)
    if policy["policy"] != "defect_reprint":
        raise HTTPException(status_code=400, detail="This order does not use the defect-reprint policy")
    if not policy["window_open"]:
        raise HTTPException(status_code=400, detail="The 48-hour defect window has closed for this order")
    if order.defect_reported:
        raise HTTPException(status_code=400, detail="A defect has already been reported for this order")

    report = DefectReport(
        order_id=order.id,
        print_partner_id=order.print_partner_id,
        within_window=True,
        description=req.description,
    )
    order.defect_reported = True
    db.add(report)
    db.add(order)
    db.commit()
    return {"status": "pending_review", "window_closes_at": policy["window_closes_at"]}


@router.post("/{order_id}/return-requests")
def request_return(
    order_id: int,
    req: ReturnRequestCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Customer requests a standard return on a Direct Seller (pre-made stock)
    item, within the real return window."""
    order = db.query(Order).filter(Order.id == order_id, Order.customer_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order_item = db.query(OrderItem).filter(
        OrderItem.id == req.order_item_id, OrderItem.order_id == order.id
    ).first()
    if not order_item:
        raise HTTPException(status_code=404, detail="Order item not found")

    policy = returns.order_return_policy(order)
    item_policy = next((i for i in policy["items"] if i["order_item_id"] == order_item.id), None)
    if not item_policy or item_policy["policy"] != "standard_return":
        raise HTTPException(status_code=400, detail="This item is not eligible for a standard return")
    if not item_policy["window_open"]:
        raise HTTPException(status_code=400, detail="The return window has closed for this item")

    already_requested = (
        db.query(ReturnRequest)
        .filter(
            ReturnRequest.order_item_id == order_item.id,
            ReturnRequest.status != ReturnStatus.REJECTED,
        )
        .with_entities(ReturnRequest.quantity)
        .all()
    )
    requested_so_far = sum(q for (q,) in already_requested)
    if req.quantity < 1 or requested_so_far + req.quantity > order_item.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Only {order_item.quantity - requested_so_far} unit(s) on this line remain eligible for return",
        )

    request = ReturnRequest(
        order_id=order.id,
        order_item_id=order_item.id,
        customer_id=current_user.id,
        quantity=req.quantity,
        reason=req.reason,
        description=req.description,
        status=ReturnStatus.REQUESTED,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return {
        "id": request.id,
        "status": request.status.value,
        "quantity": request.quantity,
        "requested_at": request.requested_at.isoformat() if request.requested_at else None,
    }


@router.get("/{order_id}/return-requests")
def list_return_requests(
    order_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    order = db.query(Order).filter(Order.id == order_id, Order.customer_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    requests = db.query(ReturnRequest).filter(ReturnRequest.order_id == order.id).all()
    return [
        {
            "id": r.id,
            "order_item_id": r.order_item_id,
            "quantity": r.quantity,
            "reason": r.reason.value,
            "status": r.status.value,
            "refund_amount": r.refund_amount,
            "resolution_note": r.resolution_note,
            "requested_at": r.requested_at.isoformat() if r.requested_at else None,
        }
        for r in requests
    ]


@router.post("/confirm")
def confirm_order(req: OrderCreate, current_user: User = Depends(deps.get_current_active_user)):
    """Retired: customers cannot declare an order paid."""
    raise HTTPException(410, "Start checkout to create an order before payment. Payment is confirmed securely by the provider.")
