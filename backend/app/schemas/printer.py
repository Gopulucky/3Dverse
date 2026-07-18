from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.printer import PrinterTechnology, PrinterStatus


class PrinterBase(BaseModel):
    name: str
    technology: PrinterTechnology
    brand: Optional[str] = None
    model: Optional[str] = None
    build_volume_x: Optional[float] = None
    build_volume_y: Optional[float] = None
    build_volume_z: Optional[float] = None
    nozzle_diameter: Optional[float] = 0.4
    layer_resolution_min: Optional[float] = None
    layer_resolution_max: Optional[float] = None
    heated_bed: bool = True
    enclosure: bool = False
    multi_color: bool = False
    auto_leveling: bool = False
    avg_print_speed: Optional[float] = None
    max_prints_per_week: Optional[int] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None


class PrinterCreate(PrinterBase):
    pass


class PrinterUpdate(BaseModel):
    name: Optional[str] = None
    technology: Optional[PrinterTechnology] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    build_volume_x: Optional[float] = None
    build_volume_y: Optional[float] = None
    build_volume_z: Optional[float] = None
    nozzle_diameter: Optional[float] = None
    layer_resolution_min: Optional[float] = None
    layer_resolution_max: Optional[float] = None
    heated_bed: Optional[bool] = None
    enclosure: Optional[bool] = None
    multi_color: Optional[bool] = None
    auto_leveling: Optional[bool] = None
    status: Optional[PrinterStatus] = None
    avg_print_speed: Optional[float] = None
    max_prints_per_week: Optional[int] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None


class PrinterResponse(PrinterBase):
    id: int
    creator_id: int
    status: PrinterStatus = PrinterStatus.active
    maintenance_log: Optional[list] = []
    last_maintenance_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MaintenanceLogEntry(BaseModel):
    type: str  # "routine", "repair", "calibration", "nozzle_change"
    notes: Optional[str] = None
