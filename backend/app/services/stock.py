from sqlalchemy.orm import Session

from app.models.order import Order, OrderItem
from app.models.stock import StockItem, StockMovement, StockMovementReason


class InsufficientStock(Exception):
    def __init__(self, product_title: str, requested: int, sellable: int):
        self.product_title = product_title
        self.requested = requested
        self.sellable = sellable
        super().__init__(
            f"Only {sellable} of '{product_title}' left in stock (you asked for {requested})."
        )


def _record(db: Session, item: StockItem, quantity: int, reason: StockMovementReason,
            order_id: int | None = None, note: str | None = None) -> None:
    db.add(StockMovement(
        stock_item_id=item.id,
        order_id=order_id,
        quantity=quantity,
        reason=reason,
        note=note,
    ))


def reserve_for_order(db: Session, order: Order) -> None:
    """
    Hold stock for every stocked line on an order. Rows are locked for the
    duration so two checkouts racing for the last unit cannot both win.

    Products with no stock_items row are made to order (Subsection A/B) and are
    skipped -- they consume material, not countable units.
    """
    for line in order.items:
        if (line.selected_config or {}).get("purchase_type") == "digital":
            continue
        item = (
            db.query(StockItem)
            .filter(StockItem.product_id == line.product_id)
            .with_for_update()
            .first()
        )
        if item is None:
            continue

        if line.quantity > item.sellable:
            raise InsufficientStock(
                line.product.title if line.product else f"product {line.product_id}",
                line.quantity,
                item.sellable,
            )

        item.reserved += line.quantity
        db.add(item)
        _record(db, item, line.quantity, StockMovementReason.RESERVED, order.id)


def release_for_order(db: Session, order: Order, reason: str = "order cancelled") -> None:
    """Return held stock to the shelf when an order is cancelled or expires."""
    for line in order.items:
        if (line.selected_config or {}).get("purchase_type") == "digital":
            continue
        item = (
            db.query(StockItem)
            .filter(StockItem.product_id == line.product_id)
            .with_for_update()
            .first()
        )
        if item is None:
            continue

        released = min(line.quantity, item.reserved)
        if released == 0:
            continue
        item.reserved -= released
        db.add(item)
        _record(db, item, -released, StockMovementReason.RELEASED, order.id, reason)


def ship_order(db: Session, order: Order) -> None:
    """Consume reserved stock once the units physically leave."""
    for line in order.items:
        if (line.selected_config or {}).get("purchase_type") == "digital":
            continue
        item = (
            db.query(StockItem)
            .filter(StockItem.product_id == line.product_id)
            .with_for_update()
            .first()
        )
        if item is None:
            continue

        shipped = min(line.quantity, item.reserved, item.on_hand)
        if shipped == 0:
            continue
        item.reserved -= shipped
        item.on_hand -= shipped
        db.add(item)
        _record(db, item, -shipped, StockMovementReason.SHIPPED, order.id)


def restock_from_return(db: Session, order_item: OrderItem, quantity: int,
                        resellable: bool, order_id: int | None = None) -> None:
    """A received return either goes back on the shelf or into the damaged
    bucket -- it should never silently vanish from the count."""
    item = (
        db.query(StockItem)
        .filter(StockItem.product_id == order_item.product_id)
        .with_for_update()
        .first()
    )
    if item is None:
        return

    item.on_hand += quantity
    if not resellable:
        item.damaged += quantity
    db.add(item)
    _record(
        db, item, quantity,
        StockMovementReason.RETURNED if resellable else StockMovementReason.DAMAGED,
        order_id,
    )


def adjust(db: Session, item: StockItem, on_hand_delta: int = 0, damaged_delta: int = 0,
           note: str | None = None) -> StockItem:
    """Manual correction by the seller (stock count, breakage, write-off)."""
    item.on_hand = max(0, item.on_hand + on_hand_delta)
    item.damaged = max(0, item.damaged + damaged_delta)
    db.add(item)
    _record(
        db, item, on_hand_delta or damaged_delta,
        StockMovementReason.DAMAGED if damaged_delta else StockMovementReason.ADJUSTMENT,
        None, note,
    )
    return item
