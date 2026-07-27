from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.models.product import Product
from app.models.stock import StockItem, StockMovement, StockMovementReason
from app.services import stock as stock_service

router = APIRouter()


class StockUpsert(BaseModel):
    product_id: int
    on_hand: int = Field(ge=0)
    safety_stock: int = Field(default=0, ge=0)
    reorder_point: int = Field(default=0, ge=0)


class StockAdjust(BaseModel):
    on_hand_delta: int = 0
    damaged_delta: int = 0
    note: Optional[str] = None


def _payload(item: StockItem) -> dict:
    return {
        "id": item.id,
        "product_id": item.product_id,
        "product_title": item.product.title if item.product else None,
        "on_hand": item.on_hand,
        "reserved": item.reserved,
        "damaged": item.damaged,
        "available": item.available,
        "safety_stock": item.safety_stock,
        "sellable": item.sellable,
        "reorder_point": item.reorder_point,
        "needs_reorder": item.needs_reorder,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _owned_item(db: Session, stock_id: int, user: User) -> StockItem:
    item = db.query(StockItem).filter(StockItem.id == stock_id).first()
    if not item or item.seller_id != user.id:
        raise HTTPException(status_code=404, detail="Stock record not found")
    return item


@router.get("/")
def list_stock(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Stock-on-hand across the seller's pre-made products."""
    items = (
        db.query(StockItem)
        .filter(StockItem.seller_id == current_user.id)
        .order_by(StockItem.id)
        .all()
    )
    return [_payload(i) for i in items]


@router.post("/")
def upsert_stock(
    body: StockUpsert,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Start tracking stock for a product, or reset its levels."""
    product = db.query(Product).filter(Product.id == body.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this product")

    item = db.query(StockItem).filter(StockItem.product_id == body.product_id).first()
    if item is None:
        item = StockItem(
            product_id=body.product_id,
            seller_id=current_user.id,
            on_hand=body.on_hand,
            safety_stock=body.safety_stock,
            reorder_point=body.reorder_point,
        )
        db.add(item)
        db.flush()
        db.add(StockMovement(
            stock_item_id=item.id,
            quantity=body.on_hand,
            reason=StockMovementReason.RESTOCK,
            note="initial stock",
        ))
    else:
        delta = body.on_hand - item.on_hand
        item.safety_stock = body.safety_stock
        item.reorder_point = body.reorder_point
        if delta:
            stock_service.adjust(db, item, on_hand_delta=delta, note="manual stock count")
        else:
            db.add(item)

    db.commit()
    db.refresh(item)
    return _payload(item)


@router.post("/{stock_id}/adjust")
def adjust_stock(
    stock_id: int,
    body: StockAdjust,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Record breakage, a write-off, or a correction after a physical count."""
    item = _owned_item(db, stock_id, current_user)
    stock_service.adjust(
        db, item,
        on_hand_delta=body.on_hand_delta,
        damaged_delta=body.damaged_delta,
        note=body.note,
    )
    db.commit()
    db.refresh(item)
    return _payload(item)


@router.get("/{stock_id}/movements")
def stock_history(
    stock_id: int,
    limit: int = 50,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """The audit trail behind a product's current stock level."""
    item = _owned_item(db, stock_id, current_user)
    movements = (
        db.query(StockMovement)
        .filter(StockMovement.stock_item_id == item.id)
        .order_by(StockMovement.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": m.id,
            "quantity": m.quantity,
            "reason": m.reason.value,
            "order_id": m.order_id,
            "note": m.note,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in movements
    ]
