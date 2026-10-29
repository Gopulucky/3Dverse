from datetime import datetime, timedelta

from app.models.order import Order
from app.models.product import Product
from app.models.user import CreatorType

DEFECT_WINDOW_HOURS = 48
STANDARD_RETURN_DAYS = 7


def policy_for_product(product: Product, purchase_type: str | None = None) -> str:
    """
    Which return policy an item falls under. This is a property of the seller's
    subsection, not of print-fulfillment plumbing: a Direct Seller (subsection C)
    ships pre-made stock and gets a real return window, exactly like any
    conventional e-commerce order. A Studio or Designer creator's item was
    printed to order -- there is no resale value in a print that only exists
    because someone ordered it, so it gets a defect-only reprint window instead.
    """
    if purchase_type == "digital":
        return "digital_no_return"
    if purchase_type != "physical" and product.digital_download_enabled and not product.is_mode_3_active:
        return "digital_no_return"
    if product.creator and product.creator.creator_type == CreatorType.seller:
        return "standard_return"
    return "defect_reprint"


def order_return_policy(order: Order) -> dict:
    """
    Keep the defect action at 48 hours; standard-return lines retain their own
    seven-day window even when purchased alongside made-to-order products.
    """
    items = [
        {
            "order_item_id": item.id,
            "product_id": item.product_id,
            "quantity": item.quantity,
            "policy": policy_for_product(item.product, (getattr(item, "selected_config", None) or {}).get("purchase_type")),
        }
        for item in order.items
        if item.product is not None
    ]
    policies = {i["policy"] for i in items}
    # An unknown legacy delivery date must be backfilled from evidence; order
    # creation is not evidence that the customer received the goods.
    delivered_at = order.delivered_at if order.status == "delivered" else None
    now = datetime.utcnow()
    for item in items:
        duration = (timedelta(hours=DEFECT_WINDOW_HOURS) if item["policy"] == "defect_reprint"
                    else timedelta(days=STANDARD_RETURN_DAYS) if item["policy"] == "standard_return" else None)
        item_deadline = delivered_at + duration if delivered_at and duration else None
        item["window_closes_at"] = item_deadline
        item["window_open"] = bool(item_deadline and now <= item_deadline)

    if "defect_reprint" in policies:
        policy = "defect_reprint"
        deadline = delivered_at + timedelta(hours=DEFECT_WINDOW_HOURS) if delivered_at else None
    elif "standard_return" in policies:
        policy = "standard_return"
        deadline = delivered_at + timedelta(days=STANDARD_RETURN_DAYS) if delivered_at else None
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
