from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.core.database import Base


class OrderMode(str, enum.Enum):
    PHYSICAL = "mode_1"
    DIGITAL = "mode_2"
    PRINT_ON_DEMAND = "mode_3"
    PERSONALIZED = "mode_4"


# Orders in any of these statuses have not been paid for and must be excluded
# from revenue/GMV figures and from download entitlement checks. Order.status
# is created as "pending_payment" (see orders.py's confirm_order), not
# "pending" -- both are listed since old rows may still carry the latter.
UNPAID_STATUSES = {"pending", "pending_payment", "cancelled", "failed"}


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stripe_payment_intent_id = Column(String, nullable=True)
    mode = Column(Enum(OrderMode), nullable=True)  # nullable for backward compat with existing orders

    shipping_address = Column(JSON, nullable=True)
    shipping_cost = Column(Float, default=0.0)
    subtotal = Column(Float, nullable=False, default=0.0)
    total = Column(Float, nullable=False, default=0.0)

    # Financial metrics — cost breakdown per order
    cogs = Column(Float, default=0)
    packaging_cost = Column(Float, default=0)
    gateway_fee = Column(Float, default=0)
    marketplace_commission = Column(Float, default=0)
    ad_spend_attributed = Column(Float, default=0)
    print_partner_fee = Column(Float, default=0.0)

    # Trust-layer fields
    packaging_insert_url = Column(String, nullable=True)      # creator logo/insert for this order
    real_print_photo_url = Column(String, nullable=True)       # customer-uploaded "Make" photo
    defect_reported = Column(Boolean, default=False)           # replaces old is_refunded
    reprint_issued = Column(Boolean, default=False)

    status = Column(String, default="pending", nullable=False) # pending, paid, queued, printing, qc, packed, shipped, delivered
    status_history = Column(JSON, nullable=True, default=list) # [{"status": "paid", "timestamp": "...", "note": "..."}]
    invoice_url = Column(String, nullable=True)
    idempotency_key = Column(String, nullable=True)  # client-supplied; (customer_id, key) is unique

    print_partner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    shiprocket_order_id = Column(String, nullable=True)
    shiprocket_shipment_id = Column(String, nullable=True)
    tracking_url = Column(String, nullable=True)
    estimated_delivery = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("User", foreign_keys=[customer_id])
    print_partner = relationship("User", foreign_keys=[print_partner_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    defect_report = relationship("DefectReport", back_populates="order", uselist=False)


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    price_at_purchase = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    selected_config = Column(JSON, nullable=True)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")
