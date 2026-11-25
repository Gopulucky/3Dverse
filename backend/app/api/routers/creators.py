"""Public creator pages and following.

Everything except the follow endpoints is public. A creator only has a page once
they have something published, so the page can never be an empty or private shell.
"""
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.api.routers.marketplace import _public_product_loading, enrich_products
from app.models.follow import CreatorFollow
from app.models.product import Product, ProductStatus
from app.models.user import User, UserRole
from app.schemas.product import PublicProduct as ProductSchema
from app.services.follows import creator_display_name, follower_count
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()


class CreatorProfile(BaseModel):
    id: int
    name: str
    avatar_url: str | None = None
    bio: str | None = None
    member_since: datetime | None = None
    product_count: int
    follower_count: int


class FollowState(BaseModel):
    following: bool
    follower_count: int


def _published(db: Session, creator_id: int):
    return db.query(Product).filter(Product.creator_id == creator_id, Product.status == ProductStatus.published)


def _public_creator(db: Session, creator_id: int) -> User:
    creator = db.get(User, creator_id)
    if (
        creator is None
        or creator.deleted_at is not None
        or not creator.is_active
        or creator.role not in (UserRole.creator, UserRole.admin)
        or _published(db, creator_id).first() is None
    ):
        raise HTTPException(status_code=404, detail="Creator not found")
    return creator


@router.get("/{creator_id}", response_model=CreatorProfile)
def get_creator(creator_id: int, db: Session = Depends(deps.get_db)) -> Any:
    creator = _public_creator(db, creator_id)
    return CreatorProfile(
        id=creator.id,
        name=creator_display_name(creator),
        avatar_url=creator.avatar_url,
        bio=creator.bio,
        member_since=creator.created_at,
        product_count=_published(db, creator_id).count(),
        follower_count=follower_count(db, creator_id),
    )


@router.get("/{creator_id}/products", response_model=List[ProductSchema])
def get_creator_products(
    creator_id: int,
    db: Session = Depends(deps.get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(24, ge=1, le=100),
) -> Any:
    _public_creator(db, creator_id)
    products = (
        _published(db, creator_id)
        .options(*_public_product_loading())
        .order_by(Product.created_at.desc(), Product.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return enrich_products(db, products)


def _state(db: Session, follower: User, creator_id: int) -> FollowState:
    following = (
        db.query(CreatorFollow)
        .filter(CreatorFollow.follower_id == follower.id, CreatorFollow.creator_id == creator_id)
        .first()
        is not None
    )
    return FollowState(following=following, follower_count=follower_count(db, creator_id))


@router.get("/{creator_id}/follow", response_model=FollowState)
def get_follow_state(
    creator_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    return _state(db, current_user, creator_id)


@router.post("/{creator_id}/follow", response_model=FollowState)
def follow_creator(
    creator_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    _public_creator(db, creator_id)
    if creator_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't follow yourself.")
    if not _state(db, current_user, creator_id).following:
        db.add(CreatorFollow(follower_id=current_user.id, creator_id=creator_id))
        db.commit()
    return _state(db, current_user, creator_id)


@router.delete("/{creator_id}/follow", response_model=FollowState)
def unfollow_creator(
    creator_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    db.query(CreatorFollow).filter(
        CreatorFollow.follower_id == current_user.id, CreatorFollow.creator_id == creator_id
    ).delete()
    db.commit()
    return _state(db, current_user, creator_id)
