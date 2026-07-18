from pydantic import BaseModel, EmailStr
from typing import Optional, List
from app.models.user import UserRole, BusinessType, CreatorTier

# Shared properties
class UserBase(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.customer
    pincode: str | None = None

# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str

# Properties to receive via API on update
class UserUpdate(UserBase):
    password: str | None = None

class UserInDBBase(UserBase):
    id: int
    is_active: bool
    full_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    company_name: str | None = None
    business_type: BusinessType | None = None
    website_url: str | None = None
    social_links: dict | None = None
    onboarding_completed: bool | None = False
    onboarding_step: int | None = 0
    creator_tier: CreatorTier | None = None
    specializations: list | None = None
    portfolio_images: list | None = None

    class Config:
        from_attributes = True

# Additional properties to return via API
class User(UserInDBBase):
    pass

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    user: User | None = None

class TokenPayload(BaseModel):
    sub: str | None = None

# --- Creator Profile Schemas ---

class CreatorProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    company_name: Optional[str] = None
    business_type: Optional[BusinessType] = None
    tax_id: Optional[str] = None
    website_url: Optional[str] = None
    social_links: Optional[dict] = None
    specializations: Optional[List[str]] = None
    pincode: Optional[str] = None

class CreatorProfileResponse(BaseModel):
    id: int
    email: str
    full_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    company_name: str | None = None
    business_type: BusinessType | None = None
    tax_id: str | None = None
    website_url: str | None = None
    social_links: dict | None = None
    specializations: list | None = None
    portfolio_images: list | None = None
    creator_tier: CreatorTier | None = None
    rating: float | None = None
    on_time_rate: float | None = None
    onboarding_completed: bool | None = False
    onboarding_step: int | None = 0
    pincode: str | None = None

    class Config:
        from_attributes = True

# --- Onboarding Schemas ---

class OnboardingStepUpdate(BaseModel):
    step: int  # 1-6
    data: dict = {}  # step-specific data (profile info, equipment, materials, etc.)

