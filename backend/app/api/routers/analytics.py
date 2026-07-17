from typing import Any, List, Dict
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, cast, Date
from datetime import datetime, timedelta

from app.api import deps
from app.models.user import User, UserRole
from app.models.order import Order, OrderItem
from app.models.product import Product

router = APIRouter()

@router.get("/creator")
def get_creator_analytics(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    if current_user.role != UserRole.creator:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    threshold_date = datetime.utcnow() - timedelta(days=days)

    # Base query for order items belonging to this creator's products in paid/processing state
    base_query = (
        db.query(OrderItem, Order)
        .join(Order, OrderItem.order_id == Order.id)
        .join(Product, OrderItem.product_id == Product.id)
        .filter(
            Product.creator_id == current_user.id,
            Order.status != "pending",
            Order.created_at >= threshold_date
        )
    )

    items_and_orders = base_query.all()

    total_revenue = sum(item.price_at_purchase * item.quantity for item, order in items_and_orders)
    total_sales = sum(item.quantity for item, order in items_and_orders)

    # Group by date for charts
    chart_data_dict = {}
    
    # Initialize all dates in range with 0
    for i in range(days):
        d = (datetime.utcnow() - timedelta(days=days - 1 - i)).strftime('%Y-%m-%d')
        chart_data_dict[d] = {"date": d, "revenue": 0.0, "sales": 0}

    for item, order in items_and_orders:
        date_str = order.created_at.strftime('%Y-%m-%d')
        if date_str in chart_data_dict:
            chart_data_dict[date_str]["revenue"] += item.price_at_purchase * item.quantity
            chart_data_dict[date_str]["sales"] += item.quantity

    chart_data = list(chart_data_dict.values())

    return {
        "total_revenue": total_revenue,
        "total_sales": total_sales,
        "chart_data": chart_data
    }

@router.get("/admin")
def get_admin_analytics(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    threshold_date = datetime.utcnow() - timedelta(days=days)

    orders = db.query(Order).filter(
        Order.status != "pending",
        Order.created_at >= threshold_date
    ).all()

    total_platform_revenue = sum(o.total for o in orders)
    total_order_volume = len(orders)
    
    physical_orders_count = sum(1 for o in orders if o.shipping_address is not None)
    digital_orders_count = total_order_volume - physical_orders_count

    # New users in time period
    new_users = db.query(User).filter(User.id > 0).count() # Just getting total users for now as placeholder for active users

    # Group by date for charts
    chart_data_dict = {}
    for i in range(days):
        d = (datetime.utcnow() - timedelta(days=days - 1 - i)).strftime('%Y-%m-%d')
        chart_data_dict[d] = {"date": d, "revenue": 0.0, "orders": 0}

    for order in orders:
        date_str = order.created_at.strftime('%Y-%m-%d')
        if date_str in chart_data_dict:
            chart_data_dict[date_str]["revenue"] += order.total
            chart_data_dict[date_str]["orders"] += 1

    chart_data = list(chart_data_dict.values())

    return {
        "platform_revenue": total_platform_revenue,
        "order_volume": total_order_volume,
        "total_users": new_users,
        "physical_orders": physical_orders_count,
        "digital_orders": digital_orders_count,
        "chart_data": chart_data
    }
