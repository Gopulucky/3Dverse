from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime
from app.models.product import ProductStatus, FulfillmentStatus, SafetyReviewStatus

# Product Version Schemas
class ProductVersionBase(BaseModel):
    file_url: str
    file_name: str
    file_size: int
    version_number: int
    is_latest: bool = True

class ProductVersionCreate(ProductVersionBase):
    pass

class PrintabilityReportBase(BaseModel):
    status: str
    issues: Optional[List[str]] = None
    volume_mm3: Optional[float] = None
    dimensions: Optional[dict] = None

class PrintabilityReportResponse(PrintabilityReportBase):
    id: int
    version_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProductVersionResponse(ProductVersionBase):
    id: int
    product_id: int
    is_latest: bool
    preview_url: Optional[str] = None
    created_at: datetime
    printability_report: Optional[PrintabilityReportResponse] = None

    class Config:
        from_attributes = True


class PublicProductVersion(BaseModel):
    """Marketplace-facing version info. Deliberately omits file_url and
    file_size -- the source model is only reachable through /api/downloads,
    and shoppers get the decimated preview mesh instead."""
    id: int
    product_id: int
    version_number: int
    is_latest: bool
    preview_url: Optional[str] = None
    printability_report: Optional[PrintabilityReportResponse] = None

    class Config:
        from_attributes = True

# Product Media Schemas
class ProductMediaBase(BaseModel):
    media_url: str
    media_type: str
    is_primary: bool = False

class ProductMediaCreate(ProductMediaBase):
    pass

class ProductMedia(ProductMediaBase):
    id: int
    product_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Product Schemas
class ProductBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = []
    price: float = 0.0
    license_type: Optional[str] = None
    status: ProductStatus = ProductStatus.draft
    fulfillment_status: Optional[FulfillmentStatus] = FulfillmentStatus.PENDING_PARTNER

    is_mode_2_active: Optional[bool] = False
    is_mode_3_active: Optional[bool] = False
    is_mode_4_active: Optional[bool] = False

    digital_download_enabled: Optional[bool] = False
    watermark_enabled: Optional[bool] = False

    available_materials: Optional[List[str]] = []
    available_colors: Optional[List[str]] = []
    available_sizes: Optional[List[str]] = []
    base_print_price: Optional[float] = 0.0

    mode_4_config: Optional[dict] = {}

class ProductCreate(ProductBase):
    pass

class ProductUpdate(ProductBase):
    title: Optional[str] = None
    price: Optional[float] = None
    status: Optional[ProductStatus] = None
    
    is_mode_2_active: Optional[bool] = None
    is_mode_3_active: Optional[bool] = None
    is_mode_4_active: Optional[bool] = None
    digital_download_enabled: Optional[bool] = None
    watermark_enabled: Optional[bool] = None
    available_materials: Optional[List[str]] = None
    available_colors: Optional[List[str]] = None
    available_sizes: Optional[List[str]] = None
    base_print_price: Optional[float] = None
    mode_4_config: Optional[dict] = None

class Product(ProductBase):
    id: int
    creator_id: int
    created_at: datetime
    updated_at: datetime
    versions: List[ProductVersionResponse] = []
    media: List[ProductMedia] = []

    # Marketplace enrichment (populated by marketplace endpoints)
    avg_rating: Optional[float] = None
    review_count: int = 0
    creator_name: Optional[str] = None
    creator_avatar: Optional[str] = None

    # Admin-set, read-only from the creator's side
    safety_review_status: SafetyReviewStatus = SafetyReviewStatus.pending
    safety_review_note: Optional[str] = None

    class Config:
        from_attributes = True


class PublicProduct(Product):
    """What anonymous marketplace traffic sees: everything except the paths to
    the paid source files."""
    versions: List[PublicProductVersion] = []
