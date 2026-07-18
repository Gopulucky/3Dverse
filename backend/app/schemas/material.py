from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.material import MaterialCategory


# --- Platform Material (admin-managed catalog) ---

class MaterialBase(BaseModel):
    name: str
    category: MaterialCategory
    technology_compatibility: Optional[List[str]] = []
    properties: Optional[dict] = {}
    min_wall_thickness: Optional[float] = None
    max_temp: Optional[float] = None
    density: Optional[float] = None
    color_options: Optional[List[str]] = []
    food_safe: bool = False
    flame_retardant: bool = False
    biocompatible: bool = False
    uv_stable: bool = False
    recyclable: bool = False
    description: Optional[str] = None
    image_url: Optional[str] = None


class MaterialCreate(MaterialBase):
    pass


class MaterialResponse(MaterialBase):
    id: int
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


# --- Creator Material (per-creator stock) ---

class CreatorMaterialBase(BaseModel):
    material_id: int
    in_stock: bool = True
    colors_available: Optional[List[str]] = []
    price_per_gram: Optional[float] = None
    brand_used: Optional[str] = None
    notes: Optional[str] = None


class CreatorMaterialCreate(CreatorMaterialBase):
    pass


class CreatorMaterialUpdate(BaseModel):
    in_stock: Optional[bool] = None
    colors_available: Optional[List[str]] = None
    price_per_gram: Optional[float] = None
    brand_used: Optional[str] = None
    notes: Optional[str] = None


class CreatorMaterialResponse(CreatorMaterialBase):
    id: int
    creator_id: int
    created_at: datetime
    material: Optional[MaterialResponse] = None

    class Config:
        from_attributes = True


# --- Finish Options ---

class FinishOptionBase(BaseModel):
    name: str
    description: Optional[str] = None
    additional_cost: float = 0.0
    estimated_extra_days: int = 0


class FinishOptionCreate(FinishOptionBase):
    pass


class FinishOptionResponse(FinishOptionBase):
    id: int
    creator_id: int
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


# --- Post Process Capabilities ---

class PostProcessCapabilityBase(BaseModel):
    name: str
    description: Optional[str] = None


class PostProcessCapabilityCreate(PostProcessCapabilityBase):
    pass


class PostProcessCapabilityResponse(PostProcessCapabilityBase):
    id: int
    creator_id: int
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True
