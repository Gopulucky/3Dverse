from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Enum
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.printer import PrinterTechnology


class PrintPartner(Base):
    """
    The collaboration-matching identity for a partner business (capabilities,
    tickets, certification, agreements). Distinct from the `User(role=
    print_partner)` row used for login and order fulfillment (Order.
    print_partner_id, PrinterProfile fleet) -- user_id links the two so a
    logged-in partner's tickets resolve correctly instead of comparing a
    users.id against a print_partners.id.
    """
    __tablename__ = "print_partners"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True)
    name = Column(String, nullable=False)
    region = Column(String, nullable=True)
    cost_tier = Column(Integer, nullable=True)   # 1 (⭐) to 5 (⭐⭐⭐⭐⭐)
    total_orders_fulfilled = Column(Integer, default=0)
    total_defect_reports = Column(Integer, default=0)
    # reship_rate is computed, not stored -- see services/metrics.py


class PrintPartnerCapability(Base):
    """A partner can support multiple technologies/materials -- one row each."""
    __tablename__ = "print_partner_capabilities"
    id = Column(Integer, primary_key=True)
    print_partner_id = Column(Integer, ForeignKey("print_partners.id"), nullable=False)
    technology = Column(Enum(PrinterTechnology, values_callable=lambda obj: [e.value for e in obj]), nullable=False)
    material_type = Column(String, nullable=False)   # e.g. "PLA", "Ti-6Al-4V", "Nylon PA12"


class CreatorPartnerRelationship(Base):
    """Private/pre-negotiated partnership -- overrides auto-recommendation."""
    __tablename__ = "creator_partner_relationships"
    id = Column(Integer, primary_key=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    print_partner_id = Column(Integer, ForeignKey("print_partners.id"), nullable=False)
    is_exclusive = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
