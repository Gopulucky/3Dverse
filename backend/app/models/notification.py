from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, default="info") # info, success, warning, error, order_update
    read = Column(Boolean, default=False)
    data = Column(JSON, nullable=True) # Optional related data (e.g. order_id)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
