from sqlalchemy import Column, Integer, String, Float, Boolean, Enum, JSON, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.core.database import Base

class UserRole(str, enum.Enum):
    creator = "creator"
    customer = "customer"
    print_partner = "print_partner"
    admin = "admin"

class BusinessType(str, enum.Enum):
    individual = "individual"
    company = "company"

class CreatorType(str, enum.Enum):
    """
    Account-level creator path, chosen once on entering the Creator Studio.
    Locked after selection — the only way out is deleting the account.
    """
    studio = "studio"      # owns a printer: designs, prints and sells; may offload overflow
    seller = "seller"      # no printer: sells designs directly on the marketplace
    designer = "designer"  # no printer: sells designs, partners with printers to fulfil


class CreatorTier(str, enum.Enum):
    bronze = "bronze"
    silver = "silver"
    gold = "gold"
    platinum = "platinum"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.customer, nullable=False)
    
    # Profile fields
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    
    # Creator business identity
    company_name = Column(String, nullable=True)
    business_type = Column(Enum(BusinessType), nullable=True)
    tax_id = Column(String, nullable=True)  # GST / Tax ID
    website_url = Column(String, nullable=True)
    social_links = Column(JSON, nullable=True)  # {"instagram": "...", "twitter": "...", "youtube": "..."}
    
    # Creator path — set once, then immutable (see CreatorType)
    creator_type = Column(Enum(CreatorType), nullable=True, default=None)

    # Creator onboarding state
    onboarding_completed = Column(Boolean, default=False)
    onboarding_step = Column(Integer, default=0)  # 0=not started, 1-6=step number
    
    # Creator tier & reputation
    creator_tier = Column(Enum(CreatorTier), nullable=True, default=None)
    specializations = Column(JSON, nullable=True)  # ["miniatures", "prototyping", "jewelry"]
    response_time_hours = Column(Float, nullable=True)  # avg response time
    on_time_rate = Column(Float, nullable=True)  # % orders delivered on time
    portfolio_images = Column(JSON, nullable=True)  # list of image URLs of past work
    
    # Partner specific fields
    pincode = Column(String, nullable=True) # Used for print partner assignment matching
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    rating = Column(Float, nullable=True)
    capacity = Column(Integer, nullable=True, default=100) # e.g. prints per week
    capabilities = Column(JSON, nullable=True) # e.g. {"materials": ["PLA", "ABS"], "colors": ["red", "blue"]}
    
    is_active = Column(Boolean, default=True)
    # Set when the user deletes their own account. The row and its email are
    # retained so order history survives and the address cannot be re-registered;
    # an admin can restore or purge it.
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    creator_materials = relationship("CreatorMaterial", back_populates="creator", cascade="all, delete-orphan")
