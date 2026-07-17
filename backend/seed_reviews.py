import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.product import Product, ProductStatus
from app.models.user import User
from app.models.review import Review

def seed():
    db: Session = SessionLocal()
    # Ensure there's a user
    user = db.query(User).first()
    if not user:
        print("No users found. Creating a fake user.")
        user = User(email="fake@test.com", full_name="Fake User", hashed_password="fake")
        db.add(user)
        db.commit()
        db.refresh(user)

    # Get a published product
    product = db.query(Product).filter(Product.status == ProductStatus.published).first()
    if not product:
        print("No published products found.")
        return

    # Check if already seeded
    existing = db.query(Review).filter(Review.product_id == product.id).first()
    if existing:
        print("Reviews already seeded.")
        return

    # Create reviews
    reviews = [
        Review(user_id=user.id, product_id=product.id, rating=5, text="Amazing quality and detail! Highly recommended."),
        Review(user_id=user.id, product_id=product.id, rating=4, text="Really good, but took a while to print."),
        Review(user_id=user.id, product_id=product.id, rating=5, text="Perfect for my tabletop campaign.")
    ]
    
    db.add_all(reviews)
    db.commit()
    print(f"Seeded 3 reviews for product '{product.title}'")

if __name__ == "__main__":
    seed()
