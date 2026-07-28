"""Backfill embeddings for any product missing one (e.g. after a bulk import).

Run (from backend/):  python scripts/generate_embeddings.py
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.product import Product
from app.models.user import User
from app.core.ai import get_embedding

def main():
    db = SessionLocal()
    products = db.query(Product).filter(Product.embedding == None).all()
    print(f"Found {len(products)} products needing embeddings.")
    
    for product in products:
        text_for_embedding = f"{product.title} {product.description or ''} {product.category or ''}".strip()
        print(f"Generating embedding for product ID {product.id}: {text_for_embedding[:50]}...")
        product.embedding = get_embedding(text_for_embedding)
        db.add(product)
        db.commit()
    
    print("Done generating embeddings.")
    db.close()

if __name__ == "__main__":
    main()
