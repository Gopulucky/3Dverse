import enum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class StockMovementReason(str, enum.Enum):
    RESTOCK = "restock"
    RESERVED = "reserved"
    RELEASED = "released"
    SHIPPED = "shipped"
    DAMAGED = "damaged"
    RETURNED = "returned"
    ADJUSTMENT = "adjustment"


class StockItem(Base):
    """
    Classic stock-on-hand for a Direct Seller's pre-made units -- a different
    shape to the material/filament tracking a self-fulfilling creator needs,
    which measures consumable weight rather than countable units.
    """
    __tablename__ = "stock_items"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, unique=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # on_hand counts every physical unit held, including those already promised
    # to an order; available = on_hand - reserved - damaged.
    on_hand = Column(Integer, nullable=False, default=0)
    reserved = Column(Integer, nullable=False, default=0)
    damaged = Column(Integer, nullable=False, default=0)
    safety_stock = Column(Integer, nullable=False, default=0)
    reorder_point = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    product = relationship("Product")
    movements = relationship("StockMovement", back_populates="stock_item", cascade="all, delete-orphan")

    @property
    def available(self) -> int:
        return max(0, self.on_hand - self.reserved - self.damaged)

    @property
    def sellable(self) -> int:
        """What may actually be sold: available less the buffer the seller holds
        back so a burst of orders cannot oversell the shelf."""
        return max(0, self.available - self.safety_stock)

    @property
    def needs_reorder(self) -> bool:
        return self.reorder_point > 0 and self.available <= self.reorder_point


class StockMovement(Base):
    """Append-only ledger. Stock levels are derived from real events rather than
    edited in place, so discrepancies stay auditable."""
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    quantity = Column(Integer, nullable=False)  # signed against the affected bucket
    reason = Column(Enum(StockMovementReason, values_callable=lambda obj: [e.value for e in obj]), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    stock_item = relationship("StockItem", back_populates="movements")
