from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from datetime import datetime
from app.core.database import Base


class FilamentSpool(Base):
    __tablename__ = "filament_spools"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    material_type = Column(String, nullable=False)
    color = Column(String, nullable=True)
    total_weight_g = Column(Float, nullable=False)
    cost = Column(Float, nullable=False)
    purchase_date = Column(DateTime, default=datetime.utcnow)
    is_depleted = Column(Boolean, default=False)

    @property
    def cost_per_gram(self) -> float:
        return self.cost / self.total_weight_g if self.total_weight_g else 0


class ProductFilamentRequirement(Base):
    """BOM -- supports multiple rows per product for multi-material prints."""
    __tablename__ = "product_filament_requirements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    material_type = Column(String, nullable=False)
    grams_per_unit = Column(Float, nullable=False)


class ProductionLog(Base):
    __tablename__ = "production_logs"

    id = Column(Integer, primary_key=True, index=True)
    spool_id = Column(Integer, ForeignKey("filament_spools.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    units_produced = Column(Integer, nullable=False)
    grams_used = Column(Float, nullable=False)  # computed at write time, stored for audit trail
    logged_at = Column(DateTime, default=datetime.utcnow)
