from typing import Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User, UserRole
from app.models.order import Order
from app.models.printer import PrinterProfile
from app.schemas.order import OrderResponse
from pydantic import BaseModel
from app.core.shiprocket import create_shiprocket_order, generate_awb, shipment_payload, ShippingPackage, ensure_carrier_configured
from app.core.config import settings
from app.services.stock import ship_order

router = APIRouter()

class StatusUpdateRequest(BaseModel):
    status: str
    shipping_package: ShippingPackage | None = None


NEXT_STATUS = {"paid": "queued", "queued": "printing", "printing": "qc",
               "qc": "packed", "packed": "shipped", "shipped": "delivered"}

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
        
    order = db.query(Order).filter(Order.id == order_id, Order.print_partner_id == current_user.id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Job not found")
        
    valid_statuses = ["queued", "printing", "qc", "packed", "shipped", "delivered"]
    if req.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    if order.currency == "INR" and not order.payment_verified_at:
        raise HTTPException(status_code=409, detail="Payment must be confirmed before fulfilment")
    if settings.is_production and (
        any(str(value or "").startswith("SR_") for value in (order.shiprocket_order_id, order.shiprocket_shipment_id))
        or "tracking.mock.com" in (order.tracking_url or "")
    ):
        raise HTTPException(status_code=409, detail="Replace the development shipment before production fulfilment")
    if order.status == req.status:
        return order
    if NEXT_STATUS.get(order.status) != req.status:
        raise HTTPException(status_code=409, detail="Complete the current fulfilment step before proceeding")

    if req.status == "packed":
        if req.shipping_package:
            package = req.shipping_package.model_dump()
            if order.shiprocket_shipment_id and package != order.shipping_package:
                raise HTTPException(status_code=409, detail="A shipment already exists with different parcel measurements")
            order.shipping_package = package
        try:
            shipment_payload(order)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        try:
            if not order.shiprocket_shipment_id:
                if settings.is_production:
                    ensure_carrier_configured()
                    if any(entry.get("event") == "shipment_creation_started" for entry in (order.status_history or [])):
                        raise HTTPException(status_code=409, detail="A previous shipment request needs operator reconciliation in Shiprocket before retrying")
                    # A timeout can mean the carrier accepted the request but its
                    # response was lost. Persist the attempt before the side effect
                    # so neither a retry nor process restart creates a duplicate.
                    order.status_history = [*(order.status_history or []), {
                        "status": order.status, "event": "shipment_creation_started",
                        "timestamp": datetime.utcnow().isoformat(),
                    }]
                    db.add(order)
                    db.commit()
                    order = db.query(Order).filter(Order.id == order_id, Order.print_partner_id == current_user.id).with_for_update().first()
                sr_data = create_shiprocket_order(order)
                order.shiprocket_order_id = sr_data["order_id"]
                order.shiprocket_shipment_id = sr_data["shipment_id"]
                # Persist the confirmed carrier identity before AWB assignment.
                # A failed label request can then be retried without recreating it.
                db.add(order)
                db.commit()
                order = db.query(Order).filter(Order.id == order_id, Order.print_partner_id == current_user.id).with_for_update().first()
                if order.status == req.status:
                    return order
                if NEXT_STATUS.get(order.status) != req.status:
                    raise HTTPException(status_code=409, detail="The job changed while creating its shipment; reload before continuing")
            if not order.tracking_url:
                order.tracking_url = generate_awb(order.shiprocket_shipment_id)
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(status_code=503, detail="Shipping could not be confirmed. Check Shiprocket, then retry this step.") from error

    if req.status in {"shipped", "delivered"} and not (order.shiprocket_shipment_id and order.tracking_url):
        raise HTTPException(status_code=409, detail="A confirmed shipment and label are required")
    if req.status == "shipped":
        ship_order(db, order)
    now = datetime.utcnow()
    order.status = req.status
    order.status_history = [*(order.status_history or []), {"status": req.status, "timestamp": now.isoformat()}]
    if req.status == "delivered" and not order.delivered_at:
        order.delivered_at = now

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
