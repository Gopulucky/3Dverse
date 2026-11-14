"""Order-bound Razorpay payments. Only a verified provider fact grants payment.

Flow: we persist the order snapshot and reserve stock, create a Razorpay *order*
for exactly that stored amount, and the browser pays it through Checkout.js.
Payment is granted only by (a) a signed webhook or (b) our own authenticated
call to Razorpay confirming the payment is captured. A browser callback alone
never marks anything paid.
"""
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import hmac
import json
import re
import logging
import requests
from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.cart import Cart, CartItem
from app.models.coupon import Coupon
from app.models.order import Order, OrderItem, OrderMode
from app.models.payment import PaymentEvent
from app.models.user import User, UserRole
from app.services import stock
from app.services.coupons import InvalidCoupon, get_valid_coupon

logger = logging.getLogger(__name__)

API_BASE = "https://api.razorpay.com/v1"
HANDLED_EVENTS = ("payment.captured", "order.paid", "payment.failed")


class ProviderError(Exception):
    """Razorpay could not be reached or refused a request."""


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


def credentials() -> tuple[str, str]:
    """(key_id, key_secret) once everything checkout needs is configured, else 503.

    Production accepts only live keys and every other environment only test
    keys, so a test charge can never reach a real customer and vice versa.
    """
    key_id = settings.RAZORPAY_KEY_ID or ""
    secret = settings.RAZORPAY_KEY_SECRET or ""
    prefix = "rzp_live_" if settings.is_production else "rzp_test_"
    if (not key_id.startswith(prefix) or len(key_id) < len(prefix) + 8
            or "fake" in key_id.lower() or len(secret) < 16 or "fake" in secret.lower()):
        raise HTTPException(503, "Payment is currently unavailable. Please try again later.")
    webhook_secret()
    return key_id, secret


def webhook_secret() -> str:
    secret = settings.RAZORPAY_WEBHOOK_SECRET or ""
    if len(secret) < 8:
        raise HTTPException(503, "Payment confirmation is not configured. Please try again later.")
    return secret


def _request(method: str, path: str, *, json=None, params=None) -> dict:
    """The single door to Razorpay's REST API (tests replace this)."""
    key_id, secret = credentials()
    try:
        response = requests.request(method, API_BASE + path, auth=(key_id, secret),
                                    json=json, params=params, timeout=(5, 20))
    except requests.RequestException as error:
        raise ProviderError(f"Razorpay unreachable: {type(error).__name__}") from error
    if response.status_code >= 400:
        try:
            code = (response.json().get("error") or {}).get("code")
        except ValueError:
            code = None
        logger.warning("Razorpay %s %s -> %s %s", method, path.split("?")[0], response.status_code, code)
        raise ProviderError(f"Razorpay returned {response.status_code}")
    try:
        return response.json()
    except ValueError as error:
        raise ProviderError("Razorpay returned an unreadable response") from error


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


# ---- Checkout hold -------------------------------------------------------------
# A started checkout is a pending order that holds stock for CHECKOUT_HOLD_MINUTES.
# The customer's cart is untouched until payment is confirmed.

def hold_expires_at(order: Order) -> datetime:
    return (order.created_at or datetime.utcnow()) + timedelta(minutes=settings.CHECKOUT_HOLD_MINUTES)


def hold_is_live(order: Order) -> bool:
    return order.status == "pending_payment" and datetime.utcnow() < hold_expires_at(order)


def open_hold(db: Session, user_id: int) -> Order | None:
    order = (db.query(Order).filter(Order.customer_id == user_id, Order.status == "pending_payment")
             .order_by(Order.id.desc()).first())
    return order if order is not None and hold_is_live(order) else None


def hold_matches(order: Order, lines: list[dict], address: dict | None, total: int) -> bool:
    """True when a live hold already describes exactly what the cart would buy now."""
    held = sorted((i.product_id, (i.selected_config or {}).get("purchase_type") or "", i.quantity,
                   minor_units(i.price_at_purchase)) for i in order.items)
    wanted = sorted((line["product_id"], line["selected_config"]["purchase_type"], line["quantity"],
                     line["unit_minor"]) for line in lines)
    return held == wanted and order.amount_minor == total and (order.shipping_address or None) == (address or None)


def release_hold(db: Session, order: Order, reason: str) -> None:
    """Give back everything an unpaid hold took: stock, coupon use, and the order itself."""
    stock.release_for_order(db, order, reason=reason)
    if order.coupon_id:
        coupon = db.query(Coupon).filter(Coupon.id == order.coupon_id).with_for_update().first()
        if coupon is not None and coupon.times_used > 0:
            coupon.times_used -= 1
    order.status = "cancelled"
    order.status_history = [*(order.status_history or []), {
        "status": "cancelled", "timestamp": datetime.utcnow().isoformat(), "note": reason}]


def consume_cart(db: Session, order: Order) -> None:
    """Remove from the customer's cart exactly what this paid order bought.

    Quantities are subtracted, not whole lines deleted, so anything the customer
    added while the hold was open stays in their cart.
    """
    cart = db.query(Cart).filter(Cart.user_id == order.customer_id).first()
    if cart is None:
        return
    for line in order.items:
        kind = (line.selected_config or {}).get("purchase_type")
        remaining = line.quantity
        for item in list(cart.items):
            if remaining <= 0:
                break
            if item.product_id == line.product_id and (item.selected_config or {}).get("purchase_type") == kind:
                taken = min(item.quantity, remaining)
                remaining -= taken
                item.quantity -= taken
                if item.quantity <= 0:
                    db.delete(item)


def expire_stale_holds(db: Session, *, customer_id: int | None = None,
                       product_ids: list[int] | None = None, limit: int = 50) -> int:
    """Release unpaid holds older than the hold window. Returns how many were released.

    There is no background worker in production, so this runs inside requests:
    when a customer starts a checkout, when anyone needs stock on the same
    products, and from the (optional) Celery task. Nothing is released while
    Razorpay shows a captured or authorised payment, or cannot be reached.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=settings.CHECKOUT_HOLD_MINUTES)
    query = db.query(Order.id).filter(Order.status == "pending_payment", Order.created_at < cutoff)
    if customer_id is not None or product_ids is not None:
        scope = []
        if customer_id is not None:
            scope.append(Order.customer_id == customer_id)
        if product_ids:
            scope.append(Order.items.any(OrderItem.product_id.in_(product_ids)))
        if not scope:
            return 0
        query = query.filter(or_(*scope))
    released = 0
    for (order_id,) in query.order_by(Order.id).limit(limit).all():
        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if order is None or order.status != "pending_payment":
            continue
        if order.razorpay_order_id:
            try:
                attempts = provider_payments(order)
                if any(entry.get("status") == "captured" for entry in attempts):
                    reconcile_order(db, order)  # it was paid after all: settle, do not release
                    continue
            except ProviderError:
                continue
            except HTTPException:
                db.rollback()
                continue
            if any(entry.get("status") == "authorized" for entry in attempts):
                continue
        release_hold(db, order, "hold expired")
        db.commit()
        released += 1
    return released


def unavailable_reason(item, sellable: int | None) -> str | None:
    """Why a cart line cannot be bought right now (None when it can). `sellable` is the
    stock the customer could take for this product, or None for made-to-order items."""
    try:
        line = price_line(item)
    except HTTPException as error:
        return str(error.detail)
    if line["selected_config"]["purchase_type"] == "physical" and sellable is not None and item.quantity > sellable:
        return "Out of stock" if sellable == 0 else f"Only {sellable} left"
    return None


def current_hold(db: Session, user: User) -> dict | None:
    expire_stale_holds(db, customer_id=user.id)
    order = open_hold(db, user.id)
    if order is None:
        return None
    return {"order_id": order.id, "hold_expires_at": hold_expires_at(order).isoformat() + "Z",
            "total": order.total, "currency": order.currency}


def prepare_order(db: Session, user: User, request) -> Order:
    """Serialize buyer snapshots, reserve inventory, and persist BEFORE provider I/O."""
    fingerprint = hashlib.sha256(json.dumps(request.model_dump(), sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    # Free anything stale first (this customer's holds, and anyone's on the same products).
    carted = [row[0] for row in db.query(CartItem.product_id).join(Cart, Cart.id == CartItem.cart_id)
              .filter(Cart.user_id == user.id).all()]
    expire_stale_holds(db, customer_id=user.id, product_ids=carted)
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
    live = open_hold(db, user.id)
    if live is not None:
        if hold_matches(live, lines, address, total):
            return live  # same cart, same details: carry on with the hold they already have
        cancel_pending_order(db, live)  # a changed cart replaces it, unless a payment is in flight
    order = Order(customer_id=user.id, currency="INR", amount_minor=total, coupon_id=coupon.id if coupon else None,

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
    db.commit()  # the cart stays; it is only reduced once payment is confirmed
    return order


# ---- Starting and resuming a payment ----------------------------------------

def start_payment(db: Session, user: User, request) -> dict:
    key_id, _ = credentials()
    try:
        order = prepare_order(db, user, request)
        order = db.query(Order).filter(Order.id == order.id).with_for_update().one()
        return payment_for_order(db, order, key_id)
    except HTTPException:
        db.rollback()
        raise
    except ProviderError:
        db.rollback()
        raise HTTPException(503, "Payment could not be prepared. Retry this checkout; your order is saved.")


def resume_payment(db: Session, user: User, order_id: int) -> dict:
    key_id, _ = credentials()
    try:
        order = db.query(Order).filter(Order.id == order_id, Order.customer_id == user.id).with_for_update().first()
        if not order:
            raise HTTPException(404, "Order not found")
        return payment_for_order(db, order, key_id)
    except HTTPException:
        db.rollback()
        raise
    except ProviderError:
        db.rollback()
        raise HTTPException(503, "Payment could not be prepared. Your order is saved; please retry.")


def receipt_for(order: Order) -> str:
    return f"3dv-{order.id}"


def payment_for_order(db: Session, order: Order, key_id: str) -> dict:
    if order.currency != "INR" or not order.amount_minor:
        raise HTTPException(409, "This legacy order cannot be charged through INR checkout")
    if order.status != "pending_payment":
        raise HTTPException(409, "This checkout is already completed or cancelled. View your orders.")
    if not hold_is_live(order):
        # The hold ran out. Release it unless Razorpay shows money moving for it.
        expire_stale_holds(db, customer_id=order.customer_id)
        db.refresh(order)
        if order.status != "pending_payment":
            raise HTTPException(409, "This checkout is already completed or cancelled. View your orders.")
    if order.razorpay_order_id:
        provider_order = _request("GET", f"/orders/{order.razorpay_order_id}")
    else:
        provider_order = adopt_or_create_provider_order(db, order)
    validate_binding(order, provider_order)
    if provider_order.get("status") == "paid":
        # Paid at the provider but our webhook has not landed (or was lost):
        # settle from the provider's own record instead of asking to pay again.
        reconcile_order(db, order)
        if order.status != "pending_payment":
            raise HTTPException(409, "This checkout is already completed or cancelled. View your orders.")
    db.commit()
    return {"order_id": order.id, "key_id": key_id, "razorpay_order_id": order.razorpay_order_id,
            "amount_minor": order.amount_minor, "total": order.total, "currency": order.currency,
            "hold_expires_at": hold_expires_at(order).isoformat() + "Z",
            "subtotal": order.subtotal, "shipping_cost": order.shipping_cost,
            "payment_status": provider_order.get("status", "created"),
            "shipping_address": order.shipping_address,
            "items": [{"title": (item.selected_config or {}).get("product_title", "Purchased item"),
                       "purchase_type": (item.selected_config or {}).get("purchase_type"),
                       "quantity": item.quantity, "unit_price": item.price_at_purchase} for item in order.items]}


def adopt_or_create_provider_order(db: Session, order: Order) -> dict:
    """Bind this order to a Razorpay order, creating one only if none exists.

    Razorpay has no idempotency key for order creation, so a timeout can leave
    an order we never learned about. The marker below survives that failure;
    on retry we look the order up by its receipt before creating another.
    """
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
    else:
        found = _request("GET", "/orders", params={"receipt": receipt_for(order)}).get("items") or []
        for candidate in found:
            if (candidate.get("amount") == order.amount_minor and candidate.get("status") != "paid"
                    and (candidate.get("notes") or {}).get("order_id") == str(order.id)):
                order.razorpay_order_id = candidate["id"]
                return candidate
    created = _request("POST", "/orders", json={
        "amount": order.amount_minor, "currency": order.currency, "receipt": receipt_for(order),
        "notes": {"order_id": str(order.id), "customer_id": str(order.customer_id)}})
    order.razorpay_order_id = created["id"]
    return created


def payment_was_attempted(order: Order) -> bool:
    return any(entry.get("status") == "payment_preparing" for entry in (order.status_history or []))


# ---- Binding and settlement ---------------------------------------------------

def validate_binding(order: Order, provider_order: dict):
    """The provider order must be exactly the order we stored."""
    notes = provider_order.get("notes") or {}
    if (not order.razorpay_order_id
            or provider_order.get("id") != order.razorpay_order_id
            or notes.get("order_id") != str(order.id)
            or notes.get("customer_id") != str(order.customer_id)
            or provider_order.get("amount") != order.amount_minor
            or str(provider_order.get("currency", "")).upper() != order.currency.upper()
            or order.amount_minor is None or order.amount_minor <= 0):
        raise HTTPException(400, "Payment does not match its order")


def validate_payment_binding(order: Order, payment: dict):
    """A payment must belong to our provider order, for the full stored amount."""
    if (not order.razorpay_order_id
            or payment.get("order_id") != order.razorpay_order_id
            or payment.get("amount") != order.amount_minor
            or str(payment.get("currency", "")).upper() != order.currency.upper()
            or order.amount_minor is None or order.amount_minor <= 0):
        raise HTTPException(400, "Payment does not match its order")


def settle_payment(order: Order, payment: dict) -> bool:
    """Mark the order paid iff this payment is captured for it. True when newly paid."""
    validate_payment_binding(order, payment)
    if payment.get("status") != "captured":
        return False  # created/authorized/failed: nothing is owed to us yet
    if order.payment_verified_at:
        return False
    if order.status != "pending_payment":
        raise HTTPException(409, "Payment requires reconciliation for this order state")
    order.status = "paid"
    order.payment_verified_at = datetime.utcnow()
    order.razorpay_payment_id = payment.get("id")
    order.status_history = [*(order.status_history or []), {
        "status": "paid", "timestamp": order.payment_verified_at.isoformat(),
        "note": "Payment confirmed by Razorpay"}]
    return True


def apply_payment(db: Session, order: Order, payment: dict) -> bool:
    newly_paid = settle_payment(order, payment)
    if newly_paid:
        consume_cart(db, order)
    if newly_paid and order.shipping_address:
        partner = db.query(User).filter(User.role == UserRole.print_partner,
            User.pincode == order.shipping_address["zip"], User.is_active.is_(True)).first()
        if partner:
            order.print_partner_id = partner.id
            order.status = "queued"
    return newly_paid


def issue_receipt(db: Session, order: Order):
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


def provider_payments(order: Order) -> list[dict]:
    return _request("GET", f"/orders/{order.razorpay_order_id}/payments").get("items") or []


def reconcile_order(db: Session, order: Order) -> bool:
    """Settle from Razorpay's own record of this order's payments. True when newly paid."""
    newly_paid = False
    for entry in provider_payments(order):
        if entry.get("status") == "captured":
            newly_paid = apply_payment(db, order, entry) or newly_paid
    if newly_paid:
        db.commit()
        issue_receipt(db, order)
    return newly_paid


# ---- Browser confirmation -----------------------------------------------------

def checkout_signature_valid(provider_order_id: str, payment_id: str, signature: str) -> bool:
    _, secret = credentials()
    expected = hmac.new(secret.encode(), f"{provider_order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    return isinstance(signature, str) and hmac.compare_digest(expected, signature)


def complete_callback(db: Session, provider_order_id, payment_id, signature) -> int | None:
    """Razorpay's phone redirect (callback_url mode). It carries the signed result, so no
    login is needed. Returns our order id when the post is genuine, else None.

    When Razorpay cannot be read right now the order is left for the webhook or the
    return page's polling to settle; the customer is still sent to the return page.
    """
    if not all(isinstance(value, str) and value for value in (provider_order_id, payment_id, signature)):
        return None
    try:
        genuine = checkout_signature_valid(provider_order_id, payment_id, signature)
    except HTTPException:
        return None
    if not genuine:
        return None
    order = db.query(Order).filter(Order.razorpay_order_id == provider_order_id).with_for_update().first()
    if order is None:
        return None
    order_id, newly_paid = order.id, False
    if not order.payment_verified_at:
        try:
            newly_paid = apply_payment(db, order, _request("GET", f"/payments/{payment_id}"))
            db.commit()
        except (ProviderError, HTTPException):
            db.rollback()
    if newly_paid:
        issue_receipt(db, db.get(Order, order_id))
    return order_id


def verify_checkout(db: Session, user: User, order_id: int, provider_order_id: str,
                    payment_id: str, signature: str) -> dict:
    """Confirm what Checkout.js reported, without trusting the browser.

    The signature proves Razorpay issued this payment for this order; the
    payment's status and amount are then read from Razorpay itself.
    """
    credentials()
    try:
        order = db.query(Order).filter(Order.id == order_id, Order.customer_id == user.id).with_for_update().first()
        if not order:
            raise HTTPException(404, "Order not found")
        if not order.razorpay_order_id or provider_order_id != order.razorpay_order_id \
                or not checkout_signature_valid(provider_order_id, payment_id, signature):
            raise HTTPException(400, "Payment could not be verified")
        newly_paid = False
        if not order.payment_verified_at:
            try:
                entity = _request("GET", f"/payments/{payment_id}")
            except ProviderError:
                raise HTTPException(503, "Payment confirmation is delayed. Check your orders shortly.")
            newly_paid = apply_payment(db, order, entity)
            db.commit()
    except HTTPException:
        db.rollback()
        raise
    if newly_paid:
        issue_receipt(db, order)
    return {"order_id": order.id, "status": "paid" if order.payment_verified_at else "pending"}


# ---- Webhook ------------------------------------------------------------------

def verify_webhook(payload: bytes, signature: str | None, event_id: str | None) -> dict:
    secret = webhook_secret()
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    if not signature or not hmac.compare_digest(expected, signature):
        raise HTTPException(400, "Invalid payment signature")
    try:
        event = json.loads(payload)
    except ValueError:
        raise HTTPException(400, "Invalid payment payload")
    if not isinstance(event, dict):
        raise HTTPException(400, "Invalid payment payload")
    # The replay key comes from Razorpay's event-id header; a body hash is the
    # fallback so a missing header can never skip the replay barrier.
    event["id"] = event_id or hashlib.sha256(payload).hexdigest()
    return event


def refund_for_cancelled_order(order: Order, payment: dict):
    """Money arrived for an order we already cancelled: give it back, once."""
    validate_payment_binding(order, payment)
    if any(entry.get("status") == "payment_refunded" and entry.get("payment_id") == payment.get("id")
           for entry in (order.status_history or [])):
        return
    try:
        _request("POST", f"/payments/{payment['id']}/refund", json={
            "amount": order.amount_minor,
            "notes": {"order_id": str(order.id), "reason": "order was cancelled before payment"}})
    except ProviderError:
        raise HTTPException(503, "Refund could not be issued yet; the provider will retry")
    order.status_history = [*(order.status_history or []), {
        "status": "payment_refunded", "payment_id": payment.get("id"),
        "timestamp": datetime.utcnow().isoformat(),
        "note": "Payment arrived after cancellation and was refunded in full"}]


def process_event(db: Session, event: dict) -> dict:
    if event.get("event") not in HANDLED_EVENTS:
        return {"received": True}
    entity = ((event.get("payload") or {}).get("payment") or {}).get("entity") or {}
    provider_order_id = entity.get("order_id")
    if not provider_order_id:
        return {"received": True}
    order = db.query(Order).filter(Order.razorpay_order_id == provider_order_id).with_for_update().first()
    if not order:
        # Not ours: the same Razorpay account may also run a Payment Page
        # (e.g. /support) or other products. Acknowledge so it is not retried.
        return {"received": True}
    # Same-order deliveries serialize. The event's unique PK is a second boundary.
    if db.query(PaymentEvent).filter(PaymentEvent.id == event["id"]).first():
        return {"received": True}
    newly_paid = False
    if order.status == "cancelled" and not order.payment_verified_at and entity.get("status") == "captured":
        refund_for_cancelled_order(order, entity)
    else:
        newly_paid = apply_payment(db, order, entity)
    db.add(PaymentEvent(id=event["id"], order_id=order.id, event_type=event["event"]))
    db.commit()
    if newly_paid:
        issue_receipt(db, order)
    return {"received": True}


# ---- Cancellation -------------------------------------------------------------

def cancel_pending_order(db: Session, order: Order):
    if order.status != "pending_payment":
        raise HTTPException(400, "Only an unpaid order can be cancelled")
    if not order.razorpay_order_id and payment_was_attempted(order):
        raise HTTPException(409, "Payment creation is awaiting reconciliation. Resume this checkout or contact support before cancelling.")
    if order.razorpay_order_id:
        # Razorpay orders cannot be cancelled; they simply stop being offered.
        # Refuse while money may be moving, and settle if it already did.
        try:
            attempts = provider_payments(order)
        except ProviderError:
            raise HTTPException(409, "Payment could not be cancelled. Check your order again shortly.")
        if any(entry.get("status") == "captured" for entry in attempts):
            reconcile_order(db, order)
            raise HTTPException(409, "This order has just been paid and can no longer be cancelled. View your orders.")
        if any(entry.get("status") == "authorized" for entry in attempts):
            raise HTTPException(409, "A payment is still being processed; check your order again shortly")
    release_hold(db, order, "cancelled by customer")
