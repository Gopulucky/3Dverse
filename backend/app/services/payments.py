"""Order-bound Stripe payments. Only a verified provider event grants payment."""
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import json
import re
import logging
import stripe
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.cart import Cart
from app.models.order import Order, OrderItem, OrderMode
from app.models.payment import PaymentEvent
from app.models.user import User, UserRole
from app.services import stock
from app.services.coupons import InvalidCoupon, get_valid_coupon

logger = logging.getLogger(__name__)


def minor_units(value) -> int:
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount < 0:
            raise ValueError()
        result = int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        if result > 99_999_999:
            raise ValueError()
        return result
    except (InvalidOperation, ValueError, TypeError, OverflowError):
        raise HTTPException(400, "Invalid or unsupported price")


def payment_key() -> str:
    key = settings.STRIPE_SECRET_KEY or ""
    required_prefix = "sk_live_" if settings.is_production else "sk_test_"
    if not key.startswith(required_prefix) or "fake" in key or len(key) < 20:
        raise HTTPException(503, "Payment is currently unavailable. Please try again later.")
    if not settings.STRIPE_WEBHOOK_SECRET or not settings.STRIPE_WEBHOOK_SECRET.startswith("whsec_"):
        raise HTTPException(503, "Payment confirmation is not configured. Please try again later.")
    return key


def price_line(item) -> dict:
    product = item.product
    if product.currency != "INR":
        raise HTTPException(409, "This listing is priced in USD. Its creator must reprice it in INR before checkout.")
    if product.status != "published" or product.safety_review_status != "approved":
        raise HTTPException(409, "A product in your cart is no longer available")
    config = dict(item.selected_config or {})
    kind = config.get("purchase_type")
    digital = product.is_mode_2_active and product.digital_download_enabled
    physical = (product.is_mode_3_active or getattr(product, "is_mode_4_active", False)) and minor_units(product.base_print_price or 0) > 0
    if kind is None and bool(digital) != bool(physical):
        kind = "digital" if digital else "physical"
    if kind not in ("digital", "physical"):
        raise HTTPException(400, "Choose a digital download or a physical print for each item")
    if (kind == "digital" and not digital) or (kind == "physical" and not physical):
        raise HTTPException(409, "The selected purchase option is unavailable")
    if not isinstance(item.quantity, int) or not 1 <= item.quantity <= 100:
        raise HTTPException(400, "Choose a quantity between 1 and 100")
    unit = minor_units(product.price if kind == "digital" else product.base_print_price)
    config["purchase_type"] = kind
    config["product_title"] = product.title
    return {"product_id": item.product_id, "quantity": item.quantity,
            "unit_minor": unit, "line_minor": unit * item.quantity, "selected_config": config}


def shipping_minor(has_physical: bool, method: str) -> int:
    if method != "standard":
        raise HTTPException(400, "Only standard shipping is available")
    if not has_physical:
        return 0
    if settings.CHECKOUT_SHIPPING_INR is None:
        raise HTTPException(503, "Physical delivery checkout is not yet available")
    return minor_units(settings.CHECKOUT_SHIPPING_INR)


def validate_address(address: dict | None, email: str) -> dict:
    address = address or {}
    normalized = {key: str(address.get(key) or "").strip() for key in
                  ("name", "street", "city", "state", "zip", "country", "phone")}
    if normalized["country"] not in ("IN", "India"):
        raise HTTPException(400, "Delivery is currently available only in India")
    if any(not 2 <= len(normalized[key]) <= 200 for key in ("name", "street", "city", "state")):
        raise HTTPException(400, "Provide your name, street, city and state")
    if not re.fullmatch(r"[1-9][0-9]{5}", normalized["zip"]):
        raise HTTPException(400, "Enter a valid six-digit Indian PIN code")
    phone = re.sub(r"[\s()-]", "", normalized["phone"])
    if phone.startswith("+91"):
        phone = phone[3:]
    if not re.fullmatch(r"[6-9][0-9]{9}", phone) or len(set(phone)) == 1:
        raise HTTPException(400, "Enter a valid Indian mobile number")
    normalized.update(country="IN", phone=phone, email=email)
    return normalized


def prepare_order(db: Session, user: User, request) -> Order:
    """Serialize buyer snapshots, reserve inventory, and persist BEFORE provider I/O."""
    fingerprint = hashlib.sha256(json.dumps(request.model_dump(), sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    db.query(User).filter(User.id == user.id).with_for_update().one()
    existing = db.query(Order).filter(Order.customer_id == user.id, Order.idempotency_key == request.idempotency_key).first()
    if existing:
        if existing.checkout_fingerprint != fingerprint:
            raise HTTPException(409, "This checkout attempt already has different details. Open your orders to continue.")
        return existing
    cart = db.query(Cart).filter(Cart.user_id == user.id).with_for_update().first()
    if not cart or not cart.items:
        raise HTTPException(400, "Your cart is empty. Pending checkouts can be found in your orders.")
    lines = [price_line(item) for item in cart.items]
    physical = any(line["selected_config"]["purchase_type"] == "physical" for line in lines)
    address = validate_address(request.shipping_address, user.email) if physical else None
    subtotal = sum(line["line_minor"] for line in lines)
    shipping = shipping_minor(physical, request.shipping_method)
    discount = 0
    coupon = None
    if request.coupon_code:
        try:
            coupon = get_valid_coupon(db, request.coupon_code, lock=True)
        except InvalidCoupon as error:
            raise HTTPException(400, str(error))
        if coupon.flat_off and not coupon.percent_off:
            raise HTTPException(400, "This fixed-value coupon is not available for INR checkout")
        percent = Decimal(str(coupon.percent_off or 0))
        percent = min(max(percent, Decimal(0)), Decimal(100))
        discount = int((Decimal(subtotal) * percent / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    total = subtotal - discount + shipping
    if total <= 0:
        raise HTTPException(400, "Free checkout is not available yet. No payment has been taken.")
    if total > 99_999_999:
        raise HTTPException(400, "Order exceeds the checkout amount limit")
    order = Order(customer_id=user.id, currency="INR", amount_minor=total,
                  shipping_address=address, shipping_cost=shipping / 100,
                  subtotal=subtotal / 100, total=total / 100, status="pending_payment",
                  mode=OrderMode.PRINT_ON_DEMAND if physical else OrderMode.DIGITAL,
                  idempotency_key=request.idempotency_key, checkout_fingerprint=fingerprint)
    db.add(order)
    db.flush()
    for line in lines:
        order.items.append(OrderItem(product_id=line["product_id"], quantity=line["quantity"],
                                     price_at_purchase=line["unit_minor"] / 100,
                                     selected_config=line["selected_config"]))
    db.flush()
    try:
        stock.reserve_for_order(db, order)
    except stock.InsufficientStock as error:
        raise HTTPException(409, str(error))
    if coupon is not None:
        coupon.times_used += 1
    for item in list(cart.items):
        db.delete(item)
    db.commit()
    return order


def start_payment(db: Session, user: User, request) -> dict:
    key = payment_key()
    try:
        order = prepare_order(db, user, request)
        order = db.query(Order).filter(Order.id == order.id).with_for_update().one()
        return payment_for_order(db, order, key)
    except HTTPException:
        db.rollback()
        raise
    except stripe.StripeError:
        db.rollback()
        raise HTTPException(503, "Payment could not be prepared. Retry this checkout; your order is saved.")


def resume_payment(db: Session, user: User, order_id: int) -> dict:
    key = payment_key()
    try:
        order = db.query(Order).filter(Order.id == order_id, Order.customer_id == user.id).with_for_update().first()
        if not order:
            raise HTTPException(404, "Order not found")
        return payment_for_order(db, order, key)
    except HTTPException:
        db.rollback()
        raise
    except stripe.StripeError:
        db.rollback()
        raise HTTPException(503, "Payment could not be prepared. Your order is saved; please retry.")


def payment_for_order(db: Session, order: Order, key: str) -> dict:
    if order.currency != "INR" or not order.amount_minor:
        raise HTTPException(409, "This legacy order cannot be charged through INR checkout")
    if order.status != "pending_payment":
        raise HTTPException(409, "This checkout is already completed or cancelled. View your orders.")
    if order.stripe_payment_intent_id:
        intent = stripe.PaymentIntent.retrieve(order.stripe_payment_intent_id, api_key=key)
    else:
        # Stripe can prune keys after 24h. Do not recreate an uncertain old intent.
        if order.created_at < datetime.utcnow() - timedelta(hours=23):
            raise HTTPException(409, "This checkout needs support review before retrying payment")
        if not payment_was_attempted(order):
            order.status_history = [*(order.status_history or []), {
                "status": "payment_preparing", "timestamp": datetime.utcnow().isoformat(),
                "note": "Provider creation attempted; reconcile before releasing inventory"}]
            db.commit()
            # The marker must survive timeouts/process failure. Reacquire the
            # lock released by commit before calling the provider.
            order = db.query(Order).filter(Order.id == order.id).with_for_update().one()
            if order.status != "pending_payment":
                raise HTTPException(409, "This order is no longer awaiting payment")
        intent = stripe.PaymentIntent.create(
            amount=order.amount_minor, currency=order.currency.lower(),
            metadata={"order_id": str(order.id), "customer_id": str(order.customer_id)},
            automatic_payment_methods={"enabled": True},
            idempotency_key=f"checkout-order-{order.id}", api_key=key)
        order.stripe_payment_intent_id = intent["id"]
    intent = intent.to_dict() if hasattr(intent, "to_dict") else intent
    validate_binding(order, intent)
    db.commit()
    return {"order_id": order.id, "client_secret": intent["client_secret"],
            "total": order.total, "currency": order.currency,
            "subtotal": order.subtotal, "shipping_cost": order.shipping_cost,
            "payment_status": intent.get("status", "requires_payment_method"),
            "shipping_address": order.shipping_address,
            "items": [{"title": (item.selected_config or {}).get("product_title", "Purchased item"),
                       "purchase_type": (item.selected_config or {}).get("purchase_type"),
                       "quantity": item.quantity, "unit_price": item.price_at_purchase} for item in order.items]}


def payment_was_attempted(order: Order) -> bool:
    return any(entry.get("status") == "payment_preparing" for entry in (order.status_history or []))


def verify_webhook(payload: bytes, signature: str | None):
    secret = settings.STRIPE_WEBHOOK_SECRET
    if not secret or not secret.startswith("whsec_"):
        raise HTTPException(503, "Payment webhook is not configured")
    try:
        event = stripe.Webhook.construct_event(payload, signature or "", secret).to_dict()
    except (ValueError, AttributeError, stripe.SignatureVerificationError):
        raise HTTPException(400, "Invalid payment signature")
    if bool(event.get("livemode")) != settings.is_production:
        raise HTTPException(400, "Payment environment does not match")
    return event


def validate_binding(order: Order, intent):
    metadata = intent.get("metadata") or {}
    if (intent.get("id") != order.stripe_payment_intent_id
            or metadata.get("order_id") != str(order.id)
            or metadata.get("customer_id") != str(order.customer_id)
            or intent.get("amount") != order.amount_minor
            or intent.get("currency") != order.currency.lower()
            or order.amount_minor is None or order.amount_minor <= 0):
        raise HTTPException(400, "Payment does not match its order")


def settle_payment(order: Order, intent, event_type: str) -> bool:
    validate_binding(order, intent)
    if event_type == "payment_intent.succeeded":
        if intent.get("status") != "succeeded" or intent.get("amount_received") != order.amount_minor:
            raise HTTPException(400, "Payment has not settled for the full order amount")
        if order.payment_verified_at:
            return False
        if order.status != "pending_payment":
            raise HTTPException(409, "Payment requires reconciliation for this order state")
        order.status = "paid"
        order.payment_verified_at = datetime.utcnow()
        order.status_history = [*(order.status_history or []), {
            "status": "paid", "timestamp": order.payment_verified_at.isoformat(),
            "note": "Payment confirmed by signed provider event"}]
        return True
    return False


def process_event(db: Session, event) -> dict:
    event_type = event.get("type")
    if event_type not in ("payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled"):
        return {"received": True}
    intent = event["data"]["object"]
    try:
        order_id = int((intent.get("metadata") or {}).get("order_id", ""))
    except (TypeError, ValueError):
        raise HTTPException(400, "Payment is missing its order binding")
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(400, "Payment order does not exist")
    # Same-order deliveries serialize. The event's unique PK is a second boundary.
    if db.query(PaymentEvent).filter(PaymentEvent.id == event["id"]).first():
        return {"received": True}
    newly_paid = settle_payment(order, intent, event_type)
    if newly_paid and order.shipping_address:
        partner = db.query(User).filter(User.role == UserRole.print_partner,
            User.pincode == order.shipping_address["zip"], User.is_active.is_(True)).first()
        if partner:
            order.print_partner_id = partner.id
            order.status = "queued"
    if event_type == "payment_intent.canceled" and not order.payment_verified_at and order.status == "pending_payment":
        if intent.get("status") != "canceled":
            raise HTTPException(400, "Payment cancellation was not confirmed")
        stock.release_for_order(db, order, reason="payment cancelled")
        order.status = "cancelled"
    db.add(PaymentEvent(id=event["id"], order_id=order.id, event_type=event_type))
    db.commit()
    if newly_paid:
        # Receipt failure cannot roll back confirmed payment or ask a customer
        # to pay again. The storage adapter requires durable storage in production.
        try:
            from app.core.invoice import generate_invoice_pdf
            order.invoice_url = generate_invoice_pdf(
                order.id, order.customer.full_name or "Customer",
                [{"title": (item.selected_config or {}).get("product_title", "Purchased item"),
                  "quantity": item.quantity, "price": item.price_at_purchase} for item in order.items],
                order.subtotal, order.shipping_cost, order.total, currency=order.currency)
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Receipt generation failed for paid order %s", order.id)
    return {"received": True}


def cancel_pending_order(db: Session, order: Order):
    if order.status != "pending_payment":
        raise HTTPException(400, "Only an unpaid order can be cancelled")
    if not order.stripe_payment_intent_id and payment_was_attempted(order):
        raise HTTPException(409, "Payment creation is awaiting reconciliation. Resume this checkout or contact support before cancelling.")
    if order.stripe_payment_intent_id:
        try:
            intent = stripe.PaymentIntent.cancel(order.stripe_payment_intent_id,
                idempotency_key=f"cancel-order-{order.id}", api_key=payment_key())
            intent = intent.to_dict() if hasattr(intent, "to_dict") else intent
            validate_binding(order, intent)
            if intent["status"] != "canceled":
                raise HTTPException(409, "Payment is still processing; check your order again shortly")
        except stripe.StripeError:
            raise HTTPException(409, "Payment could not be cancelled. Check your order again shortly.")
    stock.release_for_order(db, order, reason="cancelled by customer")
    order.status = "cancelled"
