from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stripe_payment_intent_id = Column(String, nullable=True)
    
    shipping_address = Column(JSON, nullable=True)
    shipping_cost = Column(Float, default=0.0)
    subtotal = Column(Float, nullable=False, default=0.0)
    total = Column(Float, nullable=False, default=0.0)
    
    status = Column(String, default="pending", nullable=False) # pending, paid, queued, printing, qc, packed, shipped, delivered
    invoice_url = Column(String, nullable=True)
    
    print_partner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    shiprocket_order_id = Column(String, nullable=True)
    shiprocket_shipment_id = Column(String, nullable=True)
    tracking_url = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("User", foreign_keys=[customer_id])
    print_partner = relationship("User", foreign_keys=[print_partner_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


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
