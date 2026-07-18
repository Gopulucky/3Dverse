from typing import Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User, UserRole
from app.models.printer import Printer
from app.schemas.printer import (
    PrinterCreate,
    PrinterUpdate,
    PrinterResponse,
    MaintenanceLogEntry,
)

router = APIRouter()


def require_creator(user: User) -> User:
    if user.role != UserRole.creator:
        raise HTTPException(status_code=403, detail="Only creators can access this endpoint")
    return user


@router.get("/", response_model=List[PrinterResponse])
def list_printers(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """List all printers owned by the current creator."""
    require_creator(current_user)
    printers = db.query(Printer).filter(Printer.creator_id == current_user.id).order_by(Printer.created_at.desc()).all()
    return printers


@router.post("/", response_model=PrinterResponse)
def create_printer(
    printer_in: PrinterCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Add a new printer to the creator's fleet."""
    require_creator(current_user)
    printer = Printer(
        creator_id=current_user.id,
        **printer_in.dict(),
    )
    db.add(printer)
    db.commit()
    db.refresh(printer)
    return printer


@router.get("/{printer_id}", response_model=PrinterResponse)
def get_printer(
    printer_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get a specific printer by ID."""
    require_creator(current_user)
    printer = db.query(Printer).filter(
        Printer.id == printer_id,
        Printer.creator_id == current_user.id,
    ).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    return printer


@router.put("/{printer_id}", response_model=PrinterResponse)
def update_printer(
    printer_id: int,
    printer_in: PrinterUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Update a printer's details."""
    require_creator(current_user)
    printer = db.query(Printer).filter(
        Printer.id == printer_id,
        Printer.creator_id == current_user.id,
    ).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")

    update_data = printer_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(printer, field, value)

    db.add(printer)
    db.commit()
    db.refresh(printer)
    return printer


@router.delete("/{printer_id}")
def delete_printer(
    printer_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Remove a printer from the fleet."""
    require_creator(current_user)
    printer = db.query(Printer).filter(
        Printer.id == printer_id,
        Printer.creator_id == current_user.id,
    ).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    db.delete(printer)
    db.commit()
    return {"detail": "Printer deleted"}


@router.post("/{printer_id}/maintenance", response_model=PrinterResponse)
def log_maintenance(
    printer_id: int,
    entry: MaintenanceLogEntry,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Log a maintenance event for a printer."""
    require_creator(current_user)
    printer = db.query(Printer).filter(
        Printer.id == printer_id,
        Printer.creator_id == current_user.id,
    ).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")

    log = printer.maintenance_log or []
    log.append({
        "date": datetime.utcnow().isoformat(),
        "type": entry.type,
        "notes": entry.notes,
    })
    printer.maintenance_log = log
    printer.last_maintenance_at = datetime.utcnow()

    db.add(printer)
    db.commit()
    db.refresh(printer)
    return printer
