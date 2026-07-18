from sqlalchemy import Column, Integer, String, Float, Boolean, Enum, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.core.database import Base


class PrinterTechnology(str, enum.Enum):
    fdm = "FDM"
    sla = "SLA"
    sls = "SLS"
    mjf = "MJF"
    dlp = "DLP"
    dmls = "DMLS"
    other = "Other"


class PrinterStatus(str, enum.Enum):
    active = "active"
    maintenance = "maintenance"
    offline = "offline"


class Printer(Base):
    __tablename__ = "printers"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Basic info
    name = Column(String, nullable=False)  # e.g. "Bambu Lab X1 Carbon #1"
    technology = Column(Enum(PrinterTechnology), nullable=False)
    brand = Column(String, nullable=True)  # e.g. "Bambu Lab"
    model = Column(String, nullable=True)  # e.g. "X1 Carbon"

    # Build specifications
    build_volume_x = Column(Float, nullable=True)  # mm
    build_volume_y = Column(Float, nullable=True)  # mm
    build_volume_z = Column(Float, nullable=True)  # mm
    nozzle_diameter = Column(Float, nullable=True, default=0.4)  # mm (FDM)
    layer_resolution_min = Column(Float, nullable=True)  # mm (finest layer)
    layer_resolution_max = Column(Float, nullable=True)  # mm (coarsest layer)

    # Features
    heated_bed = Column(Boolean, default=True)
    enclosure = Column(Boolean, default=False)
    multi_color = Column(Boolean, default=False)
    auto_leveling = Column(Boolean, default=False)

    # Operational
    status = Column(Enum(PrinterStatus), default=PrinterStatus.active)
    avg_print_speed = Column(Float, nullable=True)  # mm/s
    max_prints_per_week = Column(Integer, nullable=True)
    maintenance_log = Column(JSON, nullable=True, default=list)  # [{"date": "...", "type": "...", "notes": "..."}]
    last_maintenance_at = Column(DateTime, nullable=True)

    # Metadata
    image_url = Column(String, nullable=True)  # photo of the actual printer
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="printers")
