from pydantic import BaseModel, field_validator, model_validator
from typing import List, Optional, Any, Literal
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
    file_name -- the source model is only reachable through /api/downloads,
    and shoppers get the decimated preview mesh instead. Its type and size are
    given, so a buyer knows what they are paying to download."""
    file_format: Optional[str] = None
    file_size: Optional[int] = None
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
    caption: Optional[str] = None

class ProductMediaCreate(ProductMediaBase):
    pass

def clean_caption(value: Optional[str]) -> Optional[str]:
    """Trim a caption; blank means "no caption". Longer than the column allows is an error, not a silent cut."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if len(value) > 200:
        raise ValueError("A caption can be at most 200 characters")
    return value

class MediaCaptionUpdate(BaseModel):
    caption: Optional[str] = None

    @field_validator("caption")
    @classmethod
    def tidy(cls, value: Optional[str]) -> Optional[str]:
        return clean_caption(value)

class ProductMedia(ProductMediaBase):
    id: int
    product_id: int
    created_at: datetime
    thumb_url: Optional[str] = None

    class Config:
        from_attributes = True

def clean_print_settings(value: Any) -> Optional[dict]:
    """Keep only the print settings we know, with sensible values. These are shown
    to buyers, so anything else is dropped rather than stored. Both shapes are
    accepted: numbers from the creator form, and the strings the catalogue
    importer writes ("0.2mm")."""
    if not isinstance(value, dict):
        return None
    out: dict = {}
    height = value.get("layer_height")
    if isinstance(height, (int, float)) and not isinstance(height, bool) and 0 < height <= 2:
        out["layer_height"] = height
    elif isinstance(height, str) and 0 < len(height.strip()) <= 20:
        out["layer_height"] = height.strip()
    infill = value.get("infill_percentage")
    if isinstance(infill, int) and not isinstance(infill, bool) and 0 < infill <= 100:
        out["infill_percentage"] = infill
    for key in ("supports_required", "raft_brim_required"):
        if isinstance(value.get(key), bool):
            out[key] = value[key]
    materials = value.get("recommended_materials")
    if isinstance(materials, list):
        names = [m.strip() for m in materials if isinstance(m, str) and 0 < len(m.strip()) <= 40][:10]
        if names:
            out["recommended_materials"] = names
    for key, limit in (("supports", 200), ("infill", 20)):
        text = value.get(key)
        if isinstance(text, str) and 0 < len(text.strip()) <= limit:
            out[key] = text.strip()
    return out


# Product Schemas
class ProductBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = []
    price: float = 0.0
    currency: Literal["INR", "USD"] = "INR"
    license_type: Optional[str] = None
    status: ProductStatus = ProductStatus.draft
    fulfillment_status: Optional[FulfillmentStatus] = FulfillmentStatus.pending_partner

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

    print_settings: Optional[Any] = None

    @field_validator("print_settings")
    @classmethod
    def known_print_settings(cls, value: Any) -> Optional[dict]:
        return clean_print_settings(value)

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

    @model_validator(mode="after")
    def explicit_repricing(self):
        if "currency" in self.model_fields_set:
            if self.price is None or self.base_print_price is None:
                raise ValueError("Changing currency requires explicit digital and physical prices")
        return self

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


class LineProduct(BaseModel):
    """The few product fields a cart line or order line needs to display, price
    and (when paid) offer a download. No file paths, versions or creator rows,
    so it loads with one batched query for images."""
    id: int
    title: str
    price: float = 0.0
    base_print_price: Optional[float] = 0.0
    currency: Literal["INR", "USD"] = "INR"
    is_mode_2_active: Optional[bool] = False
    is_mode_3_active: Optional[bool] = False
    is_mode_4_active: Optional[bool] = False
    digital_download_enabled: Optional[bool] = False
    media: List[ProductMedia] = []

    class Config:
        from_attributes = True


class PublicProduct(Product):
    """What anonymous marketplace traffic sees: everything except the paths to
    the paid source files."""
    versions: List[PublicProductVersion] = []
