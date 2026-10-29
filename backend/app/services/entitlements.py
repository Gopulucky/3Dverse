from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.order import Order, OrderItem, UNPAID_STATUSES


def has_purchased(db: Session, user_id: int, product_id: int, *, digital_only: bool = False) -> bool:
    query = (
        db.query(Order.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .filter(
            Order.customer_id == user_id,
            OrderItem.product_id == product_id,
            Order.status.notin_(UNPAID_STATUSES),
            or_(Order.currency == "USD", Order.payment_verified_at.is_not(None)),
        )
    )
    if digital_only:
        query = query.filter(or_(Order.currency == "USD",
            OrderItem.selected_config["purchase_type"].as_string() == "digital"))
    return query.first() is not None
