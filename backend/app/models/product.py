from sqlalchemy import Column, Integer, String, Float, Enum, ForeignKey, JSON, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from pgvector.sqlalchemy import Vector
from app.core.database import Base

class ProductStatus(str, enum.Enum):
    draft = "draft"
    published = "published"

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, index=True, nullable=True)
    tags = Column(JSON, nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    license_type = Column(String, nullable=True)
    status = Column(Enum(ProductStatus), default=ProductStatus.draft, nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)

    # 3D Printing Specifics
    print_settings = Column(JSON, default=dict)
    hardware_required = Column(Boolean, default=False)
    assembly_instructions = Column(String, nullable=True)

    # Marketplace Flags
    is_featured = Column(Boolean, default=False)
    mock_order_count = Column(Integer, default=0)

    # Mode Activations
    is_mode_2_active = Column(Boolean, default=False)
    is_mode_3_active = Column(Boolean, default=False)
    is_mode_4_active = Column(Boolean, default=False)

    # Mode 2 (Digital Download) Config
    digital_download_enabled = Column(Boolean, default=False)
    watermark_enabled = Column(Boolean, default=False)

    # Mode 3 (Physical Print) Config
    available_materials = Column(JSON, default=list)
    available_colors = Column(JSON, default=list)
    available_sizes = Column(JSON, default=list)
    base_print_price = Column(Float, default=0.0)

    # Mode 4 (Customizable) Config
    mode_4_config = Column(JSON, default=dict)

    # Embeddings for Semantic Search (all-MiniLM-L6-v2 uses 384 dims)
    embedding = Column(Vector(384), nullable=True)

    # Relationships
    creator = relationship("User")
    versions = relationship("ProductVersion", back_populates="product", cascade="all, delete-orphan")
    media = relationship("ProductMedia", back_populates="product", cascade="all, delete-orphan")

class ProductVersion(Base):
    __tablename__ = "product_versions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    file_url = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False) # Size in bytes
    version_number = Column(Integer, nullable=False)
    is_latest = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="versions")
    printability_report = relationship("PrintabilityReport", back_populates="version", uselist=False, cascade="all, delete-orphan")

class PrintabilityReport(Base):
    __tablename__ = "printability_reports"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("product_versions.id"), nullable=False, unique=True)
    status = Column(String, default="pending", nullable=False) # pending, pass, warning, fail, needs-manual-review
    issues = Column(JSON, nullable=True) # list of string issues
    volume_mm3 = Column(Float, nullable=True)
    dimensions = Column(JSON, nullable=True) # e.g. {"x": 10, "y": 10, "z": 10}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    version = relationship("ProductVersion", back_populates="printability_report")

class ProductMedia(Base):
    __tablename__ = "product_media"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    media_url = Column(String, nullable=False)
    media_type = Column(String, nullable=False) # e.g., 'image' or 'video'
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="media")
