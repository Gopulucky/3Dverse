from pydantic import BaseModel, EmailStr, field_validator
from typing import Literal, Optional, List
from datetime import datetime
from app.models.user import UserRole, BusinessType, CreatorTier, CreatorType

# Shared properties
class UserBase(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.customer
    pincode: str | None = None

# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str
    # Seller onboarding is explicit; partner/admin roles require operator approval.
    role: Literal[UserRole.customer] = UserRole.customer

    @field_validator("password")
    @classmethod
    def password_long_enough(cls, v: str) -> str:
        # Matches the rule already enforced on password change; registration
        # used to accept a one-character password.
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must be at most 128 characters")
        return v

# Properties to receive via API on update
class UserUpdate(UserBase):
    password: str | None = None

class UserInDBBase(UserBase):
    auth_provider: str = "password"
    id: int
    is_active: bool
    email_verified: bool = False
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
    creator_type: CreatorType | None = None
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

# --- Account Schemas (portal-agnostic: customer / partner / admin) ---

class AccountProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    company_name: Optional[str] = None
    business_type: Optional[BusinessType] = None
    tax_id: Optional[str] = None
    website_url: Optional[str] = None
    social_links: Optional[dict] = None
    pincode: Optional[str] = None
    # Print partner facility fields
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    capacity: Optional[int] = None
    capabilities: Optional[dict] = None


class AccountProfileResponse(BaseModel):
    auth_provider: str = "password"
    id: int
    email: str
    email_verified: bool = False
    role: UserRole
    creator_type: CreatorType | None = None
    full_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    company_name: str | None = None
    business_type: BusinessType | None = None
    tax_id: str | None = None
    website_url: str | None = None
    social_links: dict | None = None
    pincode: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    capacity: int | None = None
    capabilities: dict | None = None
    rating: float | None = None
    on_time_rate: float | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


# --- Onboarding Schemas ---

class OnboardingStepUpdate(BaseModel):
    step: int  # 1-6
    data: dict = {}  # step-specific data (profile info, equipment, materials, etc.)

