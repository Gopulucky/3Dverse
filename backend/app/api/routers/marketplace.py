from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, func

from app.api import deps
from app.models.product import Product, ProductStatus
from app.models.review import Review
from app.models.user import User
from app.schemas.product import PublicProduct as ProductSchema

router = APIRouter()


def enrich_products(db: Session, products: List[Product]) -> List[Product]:
    """Attach avg_rating, review_count and creator identity to ORM products
    so the ProductSchema enrichment fields serialize with real values."""
    if not products:
        return products
    ids = [p.id for p in products]
    rating_rows = (
        db.query(Review.product_id, func.avg(Review.rating), func.count(Review.id))
        .filter(Review.product_id.in_(ids))
        .group_by(Review.product_id)
        .all()
    )
    ratings = {pid: (round(float(avg), 1), count) for pid, avg, count in rating_rows}
    for p in products:
        avg, count = ratings.get(p.id, (None, 0))
        p.avg_rating = avg
        p.review_count = count
        if p.creator:
            p.creator_name = p.creator.full_name or p.creator.company_name or p.creator.email.split("@")[0]
            p.creator_avatar = p.creator.avatar_url
    return products

@router.get("/homepage")
def get_homepage(db: Session = Depends(deps.get_db)) -> Any:
    from app.models.user import User, UserRole
    
    # 1. Fetch real popular creators
    creators = db.query(User).filter(User.role == UserRole.creator).limit(5).all()
    popular_creators = []
    for c in creators:
        role_label = "Creator"
        if c.specializations and len(c.specializations) > 0:
            role_label = c.specializations[0]
        elif c.business_type:
            role_label = c.business_type.value.capitalize()
            
        popular_creators.append({
            "name": c.company_name or c.full_name or c.email.split("@")[0],
            "followers": "1k", # Placeholder as we don't track followers yet
            "role": role_label,
            "initials": (c.company_name or c.full_name or c.email)[0].upper(),
            "image": c.avatar_url or "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=150"
        })

    # 2. Fetch real categories and their images
    distinct_categories = db.query(Product.category).filter(Product.category != None, Product.status == ProductStatus.published).distinct().all()
    categories = []
    for (cat_name,) in distinct_categories:
        # Get an image from a product in this category
        product = db.query(Product).filter(Product.category == cat_name, Product.status == ProductStatus.published).first()
        image_url = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=500"
        if product and product.media:
            primary_media = next((m for m in product.media if m.is_primary), product.media[0])
            image_url = primary_media.media_url
            
        categories.append({
            "name": cat_name,
            "image": image_url
        })
        
    if not categories:
        # Fallback if DB has no products
        categories = [
            {"name": "Architecture", "image": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=500"},
            {"name": "Miniatures", "image": "https://images.unsplash.com/photo-1590483736622-398541ce0ce6?auto=format&fit=crop&q=80&w=500"}
        ]
    
    featured = db.query(Product).filter(Product.status == ProductStatus.published, Product.is_featured == True).limit(4).all()
    trending = db.query(Product).filter(Product.status == ProductStatus.published).order_by(desc(Product.mock_order_count)).limit(4).all()
    new_arrivals = db.query(Product).filter(Product.status == ProductStatus.published).order_by(desc(Product.created_at)).limit(4).all()

    # Pydantic v2 requires explicit serialization if no response_model is provided
    return {
        "categories": categories,
        "popular_creators": popular_creators,
        "featured": [ProductSchema.model_validate(p).model_dump() for p in enrich_products(db, featured)],
        "trending": [ProductSchema.model_validate(p).model_dump() for p in enrich_products(db, trending)],
        "new_arrivals": [ProductSchema.model_validate(p).model_dump() for p in enrich_products(db, new_arrivals)]
    }

@router.get("/products", response_model=List[ProductSchema])
def get_products(
    db: Session = Depends(deps.get_db),
    q: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    skip: int = 0,
    limit: int = Query(20, le=100),
) -> Any:
    query = db.query(Product).filter(Product.status == ProductStatus.published)

    if q:
        search_term = q.strip()
        from app.core.ai import get_embedding
        query_embedding = get_embedding(search_term)

        text_match = or_(
            func.to_tsvector('english', Product.title).op('@@')(func.plainto_tsquery('english', search_term)),
            func.to_tsvector('english', func.coalesce(Product.description, '')).op('@@')(func.plainto_tsquery('english', search_term)),
        )

        if query_embedding is None:
            query = query.filter(text_match)
        else:
            query = query.filter(
                or_(text_match, Product.embedding.cosine_distance(query_embedding) < 0.7)
            ).order_by(Product.embedding.cosine_distance(query_embedding))

    if category:
        query = query.filter(Product.category == category)
        
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
        
    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    return enrich_products(db, query.offset(skip).limit(limit).all())

@router.get("/suggestions")
def get_suggestions(
    db: Session = Depends(deps.get_db),
    q: Optional[str] = Query(None, min_length=1),
) -> Any:
    """
    Fast autocomplete suggestions for the search bar.
    Returns product title matches + matching categories.
    Lightweight — no AI embedding, just ilike prefix match.
    """
    if not q or not q.strip():
        return {"products": [], "categories": []}

    term = q.strip()
    pattern = f"%{term}%"

    # Product title suggestions (fast ilike — no FTS, no embedding)
    product_rows = (
        db.query(Product.id, Product.title, Product.category, Product.price)
        .filter(
            Product.status == ProductStatus.published,
            Product.title.ilike(pattern),
        )
        .order_by(Product.title)
        .limit(6)
        .all()
    )

    # Category suggestions
    CATEGORIES = [
        "Tabletop", "Jewelry", "Cosplay", "Miniatures",
        "Home Decor", "Gadgets", "Architecture", "Engineering", "Medical", "Gaming",
    ]
    matching_categories = [c for c in CATEGORIES if term.lower() in c.lower()]

    return {
        "products": [
            {"id": r.id, "title": r.title, "category": r.category, "price": float(r.price)}
            for r in product_rows
        ],
        "categories": matching_categories[:3],
    }

@router.get("/products/{id}", response_model=ProductSchema)
def get_product(
    id: int,
    db: Session = Depends(deps.get_db),
) -> Any:
    product = db.query(Product).filter(Product.id == id, Product.status == ProductStatus.published).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return enrich_products(db, [product])[0]

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

    return enrich_products(db, similar)
