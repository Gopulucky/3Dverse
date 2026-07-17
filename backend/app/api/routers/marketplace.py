from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, func

from app.api import deps
from app.models.product import Product, ProductStatus
from app.models.user import User
from app.schemas.product import Product as ProductSchema

router = APIRouter()

@router.get("/homepage")
def get_homepage(db: Session = Depends(deps.get_db)) -> Any:
    categories = ["Tabletop", "Jewelry", "Cosplay", "Miniatures", "Home Decor", "Gadgets"]
    
    featured = db.query(Product).filter(Product.status == ProductStatus.published, Product.is_featured == True).limit(4).all()
    trending = db.query(Product).filter(Product.status == ProductStatus.published).order_by(desc(Product.mock_order_count)).limit(4).all()
    new_arrivals = db.query(Product).filter(Product.status == ProductStatus.published).order_by(desc(Product.created_at)).limit(4).all()

    # Pydantic v2 requires explicit serialization if no response_model is provided
    return {
        "categories": categories,
        "featured": [ProductSchema.model_validate(p).model_dump() for p in featured],
        "trending": [ProductSchema.model_validate(p).model_dump() for p in trending],
        "new_arrivals": [ProductSchema.model_validate(p).model_dump() for p in new_arrivals]
    }

@router.get("/products", response_model=List[ProductSchema])
def get_products(
    db: Session = Depends(deps.get_db),
    q: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    skip: int = 0,
    limit: int = 20,
) -> Any:
    query = db.query(Product).filter(Product.status == ProductStatus.published)

    if q:
        search_term = q.strip()
        from app.core.ai import get_embedding
        query_embedding = get_embedding(search_term)
        
        query = query.filter(
            or_(
                func.to_tsvector('english', Product.title).op('@@')(func.plainto_tsquery('english', search_term)),
                func.to_tsvector('english', func.coalesce(Product.description, '')).op('@@')(func.plainto_tsquery('english', search_term)),
                Product.embedding.cosine_distance(query_embedding) < 0.7
            )
        ).order_by(Product.embedding.cosine_distance(query_embedding))
        
    if category:
        query = query.filter(Product.category == category)
        
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
        
    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    return query.offset(skip).limit(limit).all()

@router.get("/products/{id}", response_model=ProductSchema)
def get_product(
    id: int,
    db: Session = Depends(deps.get_db),
) -> Any:
    product = db.query(Product).filter(Product.id == id, Product.status == ProductStatus.published).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return product

@router.get("/products/{id}/similar", response_model=List[ProductSchema])
def get_similar_products(
    id: int,
    db: Session = Depends(deps.get_db),
    limit: int = 4
) -> Any:
    product = db.query(Product).filter(Product.id == id, Product.status == ProductStatus.published).first()
    if not product or product.embedding is None:
        return []
    
    similar = db.query(Product).filter(
        Product.id != id,
        Product.status == ProductStatus.published,
        Product.embedding != None
    ).order_by(Product.embedding.cosine_distance(product.embedding)).limit(limit).all()
    
    return similar
