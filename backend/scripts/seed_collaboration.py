import os
import sys

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.creator import Creator
from app.models.printer import PrinterProfile, PrinterTechnology
from app.models.print_partner import PrintPartner, PrintPartnerCapability

import app.models.material # Register mappers
import app.models.product
import app.models.order
import app.models.review
import app.models.collaboration
import app.models.defect_report
import app.models.cart
import app.models.notification
import app.models.wishlist
import app.models.reward_ledger
import app.models.coupon
import app.models.ad_campaign
import app.models.printer_assumption


def seed():
    # Make sure tables exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    print("Seeding Collaboration Test Accounts...")
    
    pwd_hash = get_password_hash("password123")
    
    # 1. Customers (3)
    for i in range(1, 4):
        email = f"customer{i}@test.com"
        if not db.query(User).filter_by(email=email).first():
            user = User(
                email=email,
                hashed_password=pwd_hash,
                role=UserRole.customer,
                full_name=f"Customer {i}",
                onboarding_completed=True
            )
            db.add(user)
    
    # 2. Self-Fulfilling Creators (3) - Have printers
    for i in range(1, 4):
        email = f"self_creator{i}@test.com"
        user = db.query(User).filter_by(email=email).first()
        if not user:
            user = User(
                email=email,
                hashed_password=pwd_hash,
                role=UserRole.creator,
                full_name=f"Self Fulfilling Creator {i}",
                onboarding_completed=True
            )
            db.add(user)
            db.flush()
            
            creator = Creator(user_id=user.id)
            db.add(creator)
            db.flush()
            
            printer = PrinterProfile(
                owner_type="creator",
                owner_id=user.id,
                technology=PrinterTechnology.FDM,
                material_form="filament_spool"
            )
            db.add(printer)

    # 3. Designer-Only Creators (3) - No printers
    for i in range(1, 4):
        email = f"designer_creator{i}@test.com"
        user = db.query(User).filter_by(email=email).first()
        if not user:
            user = User(
                email=email,
                hashed_password=pwd_hash,
                role=UserRole.creator,
                full_name=f"Designer Creator {i}",
                onboarding_completed=True
            )
            db.add(user)
            db.flush()
            
            creator = Creator(user_id=user.id)
            db.add(creator)
    
    # 4. Print Partners (3)
    regions = ["North America", "Europe", "Asia"]
    technologies = [PrinterTechnology.FDM, PrinterTechnology.SLA, PrinterTechnology.SLS]
    materials = ["PLA", "Resin", "Nylon"]
    
    for i in range(1, 4):
        email = f"partner{i}@test.com"
        user = db.query(User).filter_by(email=email).first()
        if not user:
            user = User(
                email=email,
                hashed_password=pwd_hash,
                role=UserRole.print_partner,
                full_name=f"Print Partner {i}",
                onboarding_completed=True
            )
            db.add(user)
            db.flush()
            
            partner = PrintPartner(
                id=user.id, # Map directly for easy ID linking
                name=f"Partner Facility {i}",
                region=regions[i-1],
                cost_tier=i + 1
            )
            db.add(partner)
            db.flush()
            
            cap = PrintPartnerCapability(
                print_partner_id=partner.id,
                technology=technologies[i-1],
                material_type=materials[i-1]
            )
            db.add(cap)

    db.commit()
    print("Seed complete. 12 accounts created.")
    db.close()


if __name__ == "__main__":
    seed()
