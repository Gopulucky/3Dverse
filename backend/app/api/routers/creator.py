from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User, UserRole
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.schemas.user import (
    CreatorProfileUpdate,
    CreatorProfileResponse,
    OnboardingStepUpdate,
)
from app.core.storage import save_upload_file

router = APIRouter()


def require_creator(user: User) -> User:
    if user.role != UserRole.creator:
        raise HTTPException(status_code=403, detail="Only creators can access this endpoint")
    return user


# --- Profile ---

@router.get("/profile", response_model=CreatorProfileResponse)
def get_creator_profile(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get the current creator's profile."""
    require_creator(current_user)
    return current_user


@router.put("/profile", response_model=CreatorProfileResponse)
def update_creator_profile(
    profile_in: CreatorProfileUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Update creator profile fields."""
    require_creator(current_user)
    update_data = profile_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/profile/avatar", response_model=CreatorProfileResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Upload creator avatar image."""
    require_creator(current_user)
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    url, _ = await save_upload_file(file, subfolder="avatars")
    current_user.avatar_url = url
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/profile/portfolio", response_model=CreatorProfileResponse)
async def upload_portfolio_image(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Upload a portfolio image (photo of past work)."""
    require_creator(current_user)
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    url, _ = await save_upload_file(file, subfolder="portfolio")
    portfolio = current_user.portfolio_images or []
    portfolio.append(url)
    current_user.portfolio_images = portfolio
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


# --- Orders ---

@router.get("/orders")
def get_creator_orders(
    status: Optional[str] = Query(None, description="Filter by order status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Orders containing this creator's products, newest first."""
    require_creator(current_user)

    base = (
        db.query(OrderItem, Order)
        .join(Order, OrderItem.order_id == Order.id)
        .join(Product, OrderItem.product_id == Product.id)
        .filter(Product.creator_id == current_user.id)
    )

    # Status summary counts (unfiltered)
    counts: dict[str, int] = {}
    for _, order in base.all():
        counts[order.status] = counts.get(order.status, 0) + 1

    if status:
        base = base.filter(Order.status == status)

    rows = (
        base.order_by(Order.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    orders = [
        {
            "order_id": order.id,
            "order_item_id": item.id,
            "product_id": item.product_id,
            "product_title": item.product.title if item.product else "Deleted product",
            "product_thumbnail": next(
                (m.media_url for m in (item.product.media if item.product else []) if m.is_primary),
                (item.product.media[0].media_url if item.product and item.product.media else None),
            ),
            "quantity": item.quantity,
            "amount": item.price_at_purchase * item.quantity,
            "selected_config": item.selected_config or {},
            "status": order.status,
            "buyer_name": (
                (order.customer.full_name or order.customer.email.split("@")[0])
                if order.customer else "Customer"
            ),
            "ship_city": (order.shipping_address or {}).get("city"),
            "is_physical": order.shipping_address is not None,
            "tracking_url": order.tracking_url,
            "created_at": order.created_at.isoformat(),
        }
        for item, order in rows
    ]

    return {
        "orders": orders,
        "status_counts": counts,
        "total": sum(counts.values()),
    }


# --- Onboarding ---

@router.get("/onboarding/status")
def get_onboarding_status(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get the current onboarding progress."""
    require_creator(current_user)
    return {
        "onboarding_completed": current_user.onboarding_completed,
        "current_step": current_user.onboarding_step,
        "total_steps": 5,
    }


@router.post("/onboarding/step")
def update_onboarding_step(
    step_in: OnboardingStepUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Save progress for an onboarding step.
    Step 1: Profile info (full_name, bio, company_name, business_type)
    Step 2: Equipment — handled via /api/creator/printers separately
    Step 3: Materials — handled via /api/creator/materials separately
    Step 4: Portfolio — upload photos of past work
    Step 5: Terms acceptance + specializations
    """
    require_creator(current_user)

    if step_in.step < 1 or step_in.step > 5:
        raise HTTPException(status_code=400, detail="Step must be between 1 and 5")

    data = step_in.data

    if step_in.step == 1:
        # Profile info
        for field in ["full_name", "bio", "company_name", "website_url", "pincode"]:
            if field in data:
                setattr(current_user, field, data[field])
        if "business_type" in data:
            current_user.business_type = data["business_type"]
        if "social_links" in data:
            current_user.social_links = data["social_links"]

    elif step_in.step == 4:
        # Portfolio images (URLs passed after upload)
        if "portfolio_images" in data:
            current_user.portfolio_images = data["portfolio_images"]

    elif step_in.step == 5:
        # Terms + specializations
        if "specializations" in data:
            current_user.specializations = data["specializations"]
        # Mark onboarding as completed
        current_user.onboarding_completed = True

    # Always update the step counter to the highest completed step
    if step_in.step > current_user.onboarding_step:
        current_user.onboarding_step = step_in.step

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return {
        "onboarding_completed": current_user.onboarding_completed,
        "current_step": current_user.onboarding_step,
        "total_steps": 5,
    }
