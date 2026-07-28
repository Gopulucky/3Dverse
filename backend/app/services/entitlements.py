from sqlalchemy.orm import Session

from app.models.order import Order, OrderItem, UNPAID_STATUSES


def has_purchased(db: Session, user_id: int, product_id: int) -> bool:
    return (
        db.query(Order.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .filter(
            Order.customer_id == user_id,
            OrderItem.product_id == product_id,
            Order.status.notin_(UNPAID_STATUSES),
        )
        .first()
        is not None
    )
