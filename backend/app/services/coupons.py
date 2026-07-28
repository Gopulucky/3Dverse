import datetime

from sqlalchemy.orm import Session

from app.models.coupon import Coupon


class InvalidCoupon(Exception):
    pass


def get_valid_coupon(db: Session, code: str, lock: bool = False) -> Coupon:
    """Look up a coupon and raise InvalidCoupon if it can't be applied, instead
    of letting callers silently ignore a bad code. Pass lock=True when the
    caller is about to increment times_used, so two concurrent checkouts can't
    both read the count before either writes it back."""
    query = db.query(Coupon).filter(Coupon.code == code)
    if lock:
        query = query.with_for_update()
    coupon = query.first()
    if not coupon:
        raise InvalidCoupon("Coupon not found")
    if coupon.expiry_date and coupon.expiry_date < datetime.datetime.utcnow():
        raise InvalidCoupon("Coupon has expired")
    if coupon.usage_limit and coupon.times_used >= coupon.usage_limit:
        raise InvalidCoupon("Coupon usage limit reached")
    return coupon


def compute_discount(coupon: Coupon, subtotal: float) -> float:
    """Discount is always clamped to the subtotal so a flat_off coupon can
    never push the total negative and a percent_off > 100 can never appear."""
    if coupon.percent_off:
        discount = subtotal * (min(coupon.percent_off, 100.0) / 100.0)
    elif coupon.flat_off:
        discount = coupon.flat_off
    else:
        discount = 0.0
    return min(max(discount, 0.0), subtotal)
