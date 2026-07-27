import enum
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from app.core.database import Base


class Creator(Base):
    __tablename__ = "creators"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    onboarded_at = Column(DateTime, nullable=True)
