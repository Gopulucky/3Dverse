from sqlalchemy import Column, Integer, Float, ForeignKey
from app.core.database import Base


class PrinterAssumption(Base):
    """Per-creator overhead assumptions used for true-cost calculations."""
    __tablename__ = "printer_assumptions"

    creator_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    printer_cost = Column(Float, default=35000)
    expected_lifetime_prints = Column(Integer, default=3000)
    wattage_w = Column(Float, default=250)
    electricity_rate_per_kwh = Column(Float, default=8)
    maintenance_per_print = Column(Float, default=5)
    failed_print_rate = Column(Float, default=0.07)
    labor_rate_per_hour = Column(Float, default=100)
