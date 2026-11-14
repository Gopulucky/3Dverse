"""What the storefront can honestly offer right now.

The homepage uses this to decide whether to promise printed delivery and
payment, so those claims only appear once they work.
"""
from fastapi import HTTPException

from app.core.config import settings
from app.services.payments import payment_key


def checkout_ready() -> bool:
    """True when a payment key and its webhook secret are configured."""
    try:
        payment_key()
    except HTTPException:
        return False
    return True


def store_availability(*, has_printed_listing: bool) -> dict[str, bool]:
    checkout = checkout_ready()
    printed = checkout and has_printed_listing and settings.CHECKOUT_SHIPPING_INR is not None
    return {"checkout": checkout, "printed": printed}
