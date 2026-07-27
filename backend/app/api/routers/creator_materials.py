from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User, UserRole
from app.models.material import Material, CreatorMaterial, FinishOption, PostProcessCapability
from app.schemas.material import (
    MaterialResponse,
    CreatorMaterialCreate,
    CreatorMaterialUpdate,
    CreatorMaterialResponse,
    FinishOptionCreate,
    FinishOptionResponse,
    PostProcessCapabilityCreate,
    PostProcessCapabilityResponse,
)

router = APIRouter()


def require_creator(user: User) -> User:
    # Prototype: Allow any logged in user to test the Creator Studio
    return user


# --- Platform Material Catalog (read-only for creators) ---

@router.get("/catalog", response_model=List[MaterialResponse])
def list_material_catalog(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """List all available materials in the platform catalog."""
    require_creator(current_user)
    return db.query(Material).filter(Material.is_active == True).order_by(Material.name).all()


# --- Creator Materials (what the creator stocks) ---

@router.get("/my-materials", response_model=List[CreatorMaterialResponse])
def list_creator_materials(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """List materials the creator has in stock."""
    require_creator(current_user)
    items = (
        db.query(CreatorMaterial)
        .filter(CreatorMaterial.creator_id == current_user.id)
        .all()
    )
    return items


@router.post("/my-materials", response_model=CreatorMaterialResponse)
def add_creator_material(
    item_in: CreatorMaterialCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Add a material to the creator's stock."""
    require_creator(current_user)

    # Check material exists
    material = db.query(Material).filter(Material.id == item_in.material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found in catalog")

    # Check not already added
    existing = db.query(CreatorMaterial).filter(
        CreatorMaterial.creator_id == current_user.id,
        CreatorMaterial.material_id == item_in.material_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Material already in your stock")

    creator_mat = CreatorMaterial(
        creator_id=current_user.id,
        **item_in.dict(),
    )
    db.add(creator_mat)
    db.commit()
    db.refresh(creator_mat)
    return creator_mat


@router.put("/my-materials/{item_id}", response_model=CreatorMaterialResponse)
def update_creator_material(
    item_id: int,
    item_in: CreatorMaterialUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Update a creator's material stock entry."""
    require_creator(current_user)
    item = db.query(CreatorMaterial).filter(
        CreatorMaterial.id == item_id,
        CreatorMaterial.creator_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Material stock entry not found")

    update_data = item_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/my-materials/{item_id}")
def remove_creator_material(
    item_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Remove a material from the creator's stock."""
    require_creator(current_user)
    item = db.query(CreatorMaterial).filter(
        CreatorMaterial.id == item_id,
        CreatorMaterial.creator_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Material stock entry not found")
    db.delete(item)
    db.commit()
    return {"detail": "Material removed from stock"}


# --- Finish Options ---

@router.get("/finishes", response_model=List[FinishOptionResponse])
def list_finish_options(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """List all finish options the creator offers."""
    require_creator(current_user)
    return db.query(FinishOption).filter(
        FinishOption.creator_id == current_user.id,
        FinishOption.is_active == True,
    ).all()


@router.post("/finishes", response_model=FinishOptionResponse)
def create_finish_option(
    item_in: FinishOptionCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Add a finish option."""
    require_creator(current_user)
    item = FinishOption(creator_id=current_user.id, **item_in.dict())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/finishes/{item_id}")
def delete_finish_option(
    item_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Remove a finish option."""
    require_creator(current_user)
    item = db.query(FinishOption).filter(
        FinishOption.id == item_id,
        FinishOption.creator_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Finish option not found")
    db.delete(item)
    db.commit()
    return {"detail": "Finish option removed"}


# --- Post-Processing Capabilities ---

@router.get("/post-process", response_model=List[PostProcessCapabilityResponse])
def list_post_process(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """List all post-processing capabilities."""
    require_creator(current_user)
    return db.query(PostProcessCapability).filter(
        PostProcessCapability.creator_id == current_user.id,
        PostProcessCapability.is_active == True,
    ).all()


@router.post("/post-process", response_model=PostProcessCapabilityResponse)
def create_post_process(
    item_in: PostProcessCapabilityCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Add a post-processing capability."""
    require_creator(current_user)
    item = PostProcessCapability(creator_id=current_user.id, **item_in.dict())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/post-process/{item_id}")
def delete_post_process(
    item_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Remove a post-processing capability."""
    require_creator(current_user)
    item = db.query(PostProcessCapability).filter(
        PostProcessCapability.id == item_id,
        PostProcessCapability.creator_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Capability not found")
    db.delete(item)
    db.commit()
    return {"detail": "Capability removed"}
