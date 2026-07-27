from datetime import datetime, timedelta

from app.models.order import Order
from app.models.product import Product
from app.models.user import CreatorType

DEFECT_WINDOW_HOURS = 48
STANDARD_RETURN_DAYS = 7


def policy_for_product(product: Product) -> str:
    """
    Which return policy an item falls under. This is a property of the seller's
    subsection, not of print-fulfillment plumbing: a Direct Seller (subsection C)
    ships pre-made stock and gets a real return window, exactly like any
    conventional e-commerce order. A Studio or Designer creator's item was
    printed to order -- there is no resale value in a print that only exists
    because someone ordered it, so it gets a defect-only reprint window instead.
    """
    if product.digital_download_enabled and not product.is_mode_3_active:
        return "digital_no_return"
    if product.creator and product.creator.creator_type == CreatorType.seller:
        return "standard_return"
    return "defect_reprint"


def order_return_policy(order: Order) -> dict:
    """
    Resolves the whole order to the policy the customer actually sees. A cart can
    mix items, so the strictest policy present wins for the order-level action --
    per-item detail is returned alongside it.
    """
    items = [
        {
            "order_item_id": item.id,
            "product_id": item.product_id,
            "quantity": item.quantity,
            "policy": policy_for_product(item.product),
        }
        for item in order.items
        if item.product is not None
    ]
    policies = {i["policy"] for i in items}

    if "defect_reprint" in policies:
        policy = "defect_reprint"
        deadline = order.created_at + timedelta(hours=DEFECT_WINDOW_HOURS)
    elif "standard_return" in policies:
        policy = "standard_return"
        deadline = order.created_at + timedelta(days=STANDARD_RETURN_DAYS)
    else:
        policy = "digital_no_return"
        deadline = None

    return {
        "policy": policy,
        "window_closes_at": deadline,
        "window_open": bool(deadline and datetime.utcnow() <= deadline),
        "already_reported": bool(order.defect_reported),
        "items": items,
    }
