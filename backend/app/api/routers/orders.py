from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User
from app.models.cart import Cart
from app.models.order import Order, OrderItem
from app.models.coupon import Coupon
from app.models.defect_report import DefectReport
from app.models.return_request import ReturnRequest, ReturnReason, ReturnStatus
from app.schemas.order import OrderCreate, OrderResponse
from app.core.config import settings
from app.core.invoice import generate_invoice_pdf
from app.core.partner_assignment import assign_print_partner
from app.services import returns, stock

router = APIRouter()


class DefectReportRequest(BaseModel):
    description: str


class ReturnRequestCreate(BaseModel):
    order_item_id: int
    quantity: int = 1
    reason: ReturnReason
    description: str | None = None

@router.get("/", response_model=List[OrderResponse])
def get_orders(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    orders = db.query(Order).filter(Order.customer_id == current_user.id).order_by(Order.created_at.desc()).all()
    return orders

@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    order = db.query(Order).filter(Order.id == order_id, Order.customer_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
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
    if not policy["window_open"]:
        raise HTTPException(status_code=400, detail="The return window has closed for this order")

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


@router.post("/confirm", response_model=OrderResponse)
def confirm_order(
    req: OrderCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    subtotal = sum(item.product.price * item.quantity for item in cart.items)
    shipping_cost = 5.0 # simplified logic 
    discount = 0.0
    
    if req.coupon_code:
        import datetime
        coupon = db.query(Coupon).filter(Coupon.code == req.coupon_code).first()
        if coupon and not (coupon.expiry_date and coupon.expiry_date < datetime.datetime.utcnow()) and not (coupon.usage_limit and coupon.times_used >= coupon.usage_limit):
            if coupon.percent_off:
                discount = subtotal * (coupon.percent_off / 100.0)
            elif coupon.flat_off:
                discount = coupon.flat_off
            coupon.times_used += 1
            db.add(coupon)

    total = max(0, subtotal - discount + shipping_cost)

    # An order is never "paid" because the client said so. Until a payment
    # provider is wired up and its webhook verified server-side, orders stop at
    # pending_payment; only a local development build may auto-advance them.
    order = Order(
        customer_id=current_user.id,
        shipping_address=req.shipping_address,
        shipping_cost=shipping_cost,
        subtotal=subtotal,
        total=total,
        status="pending_payment",
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    invoice_items = []
    for item in cart.items:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item.product_id,
            price_at_purchase=item.product.price,
            quantity=item.quantity,
            selected_config=item.selected_config
        )
        db.add(order_item)
        invoice_items.append({
            'title': item.product.title,
            'quantity': item.quantity,
            'price': item.product.price
        })

    db.flush()
    db.refresh(order)

    # Hold stock for any pre-made (Direct Seller) lines before the order is
    # allowed to stand, so two buyers cannot both take the last unit.
    try:
        stock.reserve_for_order(db, order)
    except stock.InsufficientStock as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e))

    # Empty Cart
    for item in cart.items:
        db.delete(item)

    db.commit()

    if not settings.is_production:
        # Development convenience only: stand in for the payment confirmation
        # that a provider webhook will perform in production.
        order.status = "paid"
        db.add(order)
        db.commit()
        # Routing needs the order's items, so this runs after they are persisted.
        if assign_print_partner(db, order):
            order.status = "queued"
            db.add(order)
            db.commit()
        db.refresh(order)

    # Generate Invoice
    try:
        invoice_url = generate_invoice_pdf(order.id, current_user.full_name or "Customer", invoice_items, subtotal, shipping_cost, total)
        order.invoice_url = invoice_url
        db.add(order)
        db.commit()
        db.refresh(order)
    except Exception as e:
        print(f"Failed to generate invoice: {e}")

    return order
