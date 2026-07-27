from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User, UserRole
from app.models.order import Order
from app.models.printer import PrinterProfile
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

@router.get("/printers")
def get_printers(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get fleet of printers assigned to this print partner."""
    if current_user.role != UserRole.print_partner:
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    printers = db.query(PrinterProfile).filter(PrinterProfile.owner_id == current_user.id, PrinterProfile.owner_type == "print_partner").all()
    return [
        {
            "id": p.id,
            "name": f"{p.technology.value.upper()} Printer {p.id}",
            "technology": p.technology.value if hasattr(p.technology, "value") else p.technology,
            "status": "active",
            "last_maintenance_at": None,
        }
        for p in printers
    ]

@router.get("/analytics")
def get_analytics(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get KPI metrics for the print partner dashboard."""
    if current_user.role != UserRole.print_partner:
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    jobs = db.query(Order).filter(Order.print_partner_id == current_user.id).all()
    active_jobs = sum(1 for j in jobs if j.status in ["queued", "printing"])
    pending_qc = sum(1 for j in jobs if j.status == "qc")
    
    printers = db.query(PrinterProfile).filter(PrinterProfile.owner_id == current_user.id, PrinterProfile.owner_type == "print_partner").all()
    
    active_printers = len(printers)
    maintenance_alerts = 0
    
    return {
        "active_jobs": active_jobs,
        "pending_qc": pending_qc,
        "active_printers": active_printers,
        "maintenance_alerts": maintenance_alerts
    }
