from sqlalchemy import Column, Integer, String, Float, Boolean, Enum, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.core.database import Base


class MaterialCategory(str, enum.Enum):
    filament = "filament"
    resin = "resin"
    powder = "powder"
    metal = "metal"


class Material(Base):
    """Platform-wide material catalog. Admin-managed reference data."""
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)  # e.g. "PLA", "ABS", "PETG"
    category = Column(Enum(MaterialCategory), nullable=False)

    # Technology compatibility
    technology_compatibility = Column(JSON, nullable=True, default=list)  # ["FDM", "SLA"]

    # Properties
    properties = Column(JSON, nullable=True, default=dict)  # {"strength": "medium", "flexibility": "low", ...}
    min_wall_thickness = Column(Float, nullable=True)  # mm
    max_temp = Column(Float, nullable=True)  # °C heat resistance
    density = Column(Float, nullable=True)  # g/cm³

    # Available colors (platform defaults)
    color_options = Column(JSON, nullable=True, default=list)  # ["White", "Black", "Red", ...]

    # Certifications
    food_safe = Column(Boolean, default=False)
    flame_retardant = Column(Boolean, default=False)
    biocompatible = Column(Boolean, default=False)
    uv_stable = Column(Boolean, default=False)
    recyclable = Column(Boolean, default=False)

    # Description & metadata
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    creator_materials = relationship("CreatorMaterial", back_populates="material")


class CreatorMaterial(Base):
    """Which materials a specific creator has in stock and can print with."""
    __tablename__ = "creator_materials"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)

    # Creator-specific overrides
    in_stock = Column(Boolean, default=True)
    colors_available = Column(JSON, nullable=True, default=list)  # subset of material colors they actually have
    price_per_gram = Column(Float, nullable=True)  # creator's cost per gram
    brand_used = Column(String, nullable=True)  # e.g. "eSUN", "Hatchbox"
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="creator_materials")
    material = relationship("Material", back_populates="creator_materials")


class FinishOption(Base):
    """Post-processing finish options a creator offers."""
    __tablename__ = "finish_options"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g. "Sanding", "Painting", "Vapor Smoothing"
    description = Column(String, nullable=True)
    additional_cost = Column(Float, default=0.0)  # extra charge for this finish
    estimated_extra_days = Column(Integer, default=0)  # extra production days
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PostProcessCapability(Base):
    """Post-processing capabilities a creator can perform."""
    __tablename__ = "post_process_capabilities"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g. "Support Removal", "Assembly", "Threading"
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
