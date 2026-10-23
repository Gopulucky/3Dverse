from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api import deps
from app.models.user import User, UserRole
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.defect_report import DefectReport
from app.models.reward_ledger import RewardLedger
from app.models.filament_spool import FilamentSpool
from app.services import filament, metrics

router = APIRouter()


def require_creator(user: User) -> User:
    # Prototype: Allow any logged in user to test the Creator Studio
    return user


# --- Revenue Metrics ---

@router.get("/metrics/summary")
def get_summary(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Revenue summary for creators (total sales, earnings, orders, etc.)."""
    require_creator(current_user)
    return metrics.creator_financial_summary(db, creator_id=current_user.id)


# --- Take Rate Transparency ---

@router.get("/orders/{order_id}/take-rate")
def get_take_rate(
    order_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Transparent, single-screen fee breakdown for a specific order."""
    require_creator(current_user)
    # Find order that contains this creator's products, and which of their
    # products it is (needed to know the 2-way vs 3-way split fulfillment path)
    result = (db.query(Order, Product)
              .join(OrderItem, Order.id == OrderItem.order_id)
              .join(Product, OrderItem.product_id == Product.id)
              .filter(Order.id == order_id, Product.creator_id == current_user.id)
              .first())
    if not result:
        raise HTTPException(404, "Order not found")
    order, product = result
    return metrics.take_rate_breakdown(order, product)


# --- Defect Report ---

@router.post("/orders/{order_id}/defect-report")
def report_defect(
    order_id: int,
    description: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Report a defect within the 48h window — triggers free reprint, not refund."""
    require_creator(current_user)
    order = db.query(Order).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    within_window = datetime.utcnow() - order.created_at <= timedelta(hours=48)
    report = DefectReport(
        order_id=order_id,
        print_partner_id=order.print_partner_id,
        within_window=within_window,
        description=description,
    )
    order.defect_reported = True
    db.add(report)
    db.commit()
    return {"within_window": within_window, "status": "pending_review"}


# --- Filament Inventory ---

@router.post("/filament/spools")
def add_spool(
    material_type: str,
    color: str,
    total_weight_g: float,
    cost: float,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Add a new filament spool to creator's inventory."""
    require_creator(current_user)
    spool = FilamentSpool(
        creator_id=current_user.id,
        material_type=material_type,
        color=color,
        total_weight_g=total_weight_g,
        cost=cost,
    )
    db.add(spool)
    db.commit()
    db.refresh(spool)
    return {
        "id": spool.id,
        "material_type": spool.material_type,
        "color": spool.color,
        "total_weight_g": spool.total_weight_g,
        "cost": spool.cost,
        "cost_per_gram": spool.cost_per_gram,
        "is_depleted": spool.is_depleted,
    }


@router.get("/filament/spools")
def list_spools(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """List all filament spools for the current creator with remaining weight."""
    require_creator(current_user)
    spools = db.query(FilamentSpool).filter_by(creator_id=current_user.id).all()
    result = []
    for s in spools:
        remaining = filament.remaining_weight_g(db, s)
        result.append({
            "id": s.id,
            "material_type": s.material_type,
            "color": s.color,
            "total_weight_g": s.total_weight_g,
            "remaining_weight_g": remaining,
            "cost": s.cost,
            "cost_per_gram": s.cost_per_gram,
            "is_depleted": s.is_depleted,
            "purchase_date": s.purchase_date.isoformat() if s.purchase_date else None,
        })
    return result


@router.post("/filament/production-log")
def log_batch(
    spool_id: int,
    product_id: int,
    units_produced: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Log a production batch — consumes filament and awards reward points."""
    require_creator(current_user)
    try:
        log = filament.log_production(db, spool_id, product_id, units_produced)
    except ValueError as e:
        raise HTTPException(400, str(e))
    # Award reward points on successful production (Prusameters-style)
    db.add(RewardLedger(
        creator_id=current_user.id,
        points_delta=units_produced,
        reason="production_logged",
    ))
    db.commit()
    return {
        "id": log.id,
        "spool_id": log.spool_id,
        "product_id": log.product_id,
        "units_produced": log.units_produced,
        "grams_used": log.grams_used,
    }


@router.get("/filament/whole-units-remaining/{product_id}")
def get_units_remaining(
    product_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get whole units remaining for a product (floor of scarcest material).

    Internal stock data: it used to be readable by anyone, including anonymous
    visitors, for any product id. Now only the product's creator (or an admin).
    """
    owner_id = db.query(Product.creator_id).filter(Product.id == product_id).scalar()
    if owner_id is None or (owner_id != current_user.id and current_user.role.value != "admin"):
        raise HTTPException(404, "Product not found")
    units = filament.whole_units_remaining(db, product_id)
    return {
        "product_id": product_id,
        "whole_units_remaining": units,
        "reorder_alert": filament.reorder_alert(units),
    }


# --- Reward Points ---

@router.get("/rewards/balance")
def reward_balance(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get the creator's reward points balance."""
    require_creator(current_user)
    total = (db.query(func.sum(RewardLedger.points_delta))
               .filter_by(creator_id=current_user.id).scalar() or 0)
    return {"points_balance": total}


@router.post("/rewards/redeem")
def redeem_points(
    points: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Redeem reward points for free filament (100 points = 1kg spool voucher)."""
    require_creator(current_user)
    balance = (db.query(func.sum(RewardLedger.points_delta))
                 .filter_by(creator_id=current_user.id).scalar() or 0)
    if points > balance:
        raise HTTPException(400, "Insufficient points")
    db.add(RewardLedger(
        creator_id=current_user.id,
        points_delta=-points,
        reason="redeemed_filament",
    ))
    db.commit()
    # 100 points = 1kg free spool voucher, adjust ratio as needed
    return {"grams_awarded": points * 10}
