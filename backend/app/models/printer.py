from sqlalchemy import Column, Integer, String, Enum, DateTime
from sqlalchemy.sql import func
from datetime import datetime
import enum
from app.core.database import Base


class PrinterStatus(str, enum.Enum):
    ACTIVE = "active"
    MAINTENANCE = "maintenance"
    OFFLINE = "offline"


class PrinterTechnology(str, enum.Enum):
    FDM = "fdm"                 # Material Extrusion
    SLA = "sla"                 # Vat Photopolymerization (SLA/DLP/MSLA)
    SLS = "sls"                 # Powder Bed Fusion
    SLM = "slm"
    DMLS = "dmls"
    EBM = "ebm"
    MJF = "mjf"
    MATERIAL_JETTING = "material_jetting"   # PolyJet
    BINDER_JETTING = "binder_jetting"
    DED = "ded"                 # Directed Energy Deposition
    SHEET_LAMINATION = "sheet_lamination"


TECHNOLOGY_MATERIAL_FORM = {
    PrinterTechnology.FDM: "filament_spool",       # grams
    PrinterTechnology.SLA: "resin_bottle",          # ml
    PrinterTechnology.SLS: "powder_batch",          # kg
    PrinterTechnology.SLM: "powder_batch",          # kg
    PrinterTechnology.DMLS: "powder_batch",         # kg
    PrinterTechnology.EBM: "powder_batch",          # kg
    PrinterTechnology.MJF: "powder_batch",          # kg
    PrinterTechnology.MATERIAL_JETTING: "resin_bottle",
    PrinterTechnology.BINDER_JETTING: "powder_batch",
    PrinterTechnology.DED: "wire_or_powder",
    PrinterTechnology.SHEET_LAMINATION: "sheet_stock",
}


class PrinterProfile(Base):
    """
    Generic printer-ownership record. owner_type covers creator, print_partner,
    and (optionally) customer -- kept generic per your request to track
    technology usage across all four account types, not just creators.
    """
    __tablename__ = "printer_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    owner_type = Column(String, nullable=False)     # "creator" | "print_partner" | "customer"
    owner_id = Column(Integer, nullable=False)
    label = Column(String, nullable=True)           # optional free-text name, e.g. "Bambu X1 Carbon #1"
    technology = Column(Enum(PrinterTechnology, values_callable=lambda obj: [e.value for e in obj]), nullable=False)
    material_form = Column(String, nullable=False)  # derived from TECHNOLOGY_MATERIAL_FORM at write time
    status = Column(Enum(PrinterStatus, values_callable=lambda obj: [e.value for e in obj]), default=PrinterStatus.ACTIVE, nullable=False)
    added_at = Column(DateTime, server_default=func.now())
