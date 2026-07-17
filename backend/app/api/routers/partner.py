from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User, UserRole
from app.models.order import Order
from app.schemas.order import OrderResponse
from pydantic import BaseModel
from app.core.shiprocket import create_shiprocket_order, generate_awb

router = APIRouter()

class StatusUpdateRequest(BaseModel):
    status: str

@router.get("/jobs", response_model=List[OrderResponse])
def get_jobs(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    if current_user.role != UserRole.print_partner:
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    jobs = db.query(Order).filter(Order.print_partner_id == current_user.id).order_by(Order.created_at.desc()).all()
    return jobs

@router.put("/jobs/{order_id}/status", response_model=OrderResponse)
def update_job_status(
    order_id: int,
    req: StatusUpdateRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    if current_user.role != UserRole.print_partner:
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    order = db.query(Order).filter(Order.id == order_id, Order.print_partner_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Job not found")
        
    valid_statuses = ["queued", "printing", "qc", "packed", "shipped", "delivered"]
    if req.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    order.status = req.status
    
    # If packed, generate shiprocket label and tracking
    if req.status == "packed" and not order.shiprocket_order_id:
        try:
            sr_data = create_shiprocket_order(order)
            order.shiprocket_order_id = sr_data["order_id"]
            order.shiprocket_shipment_id = sr_data["shipment_id"]
            
            tracking_url = generate_awb(sr_data["shipment_id"])
            order.tracking_url = tracking_url
        except Exception as e:
            # We log it but do not fail the status update completely
            print(f"Shiprocket integration failed: {e}")
            
    db.add(order)
    db.commit()
    db.refresh(order)
    
    return order
