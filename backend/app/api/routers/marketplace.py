import time
from typing import Any, Callable, List, Optional, Literal
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, defer, selectinload
from sqlalchemy import or_, desc, func

from app.api import deps
from app.models.product import Product, ProductMedia, ProductStatus, ProductVersion
from app.models.review import Review
from app.models.user import User
from app.schemas.product import PublicProduct as ProductSchema

router = APIRouter()


# --- Small in-process TTL cache ----------------------------------------------
# The marketplace read endpoints are public and identical for every visitor, but
# the database sits in another region from the API, so each query costs a
# network round trip (~200ms+). Serving a result for a few seconds turns a burst
# of visitors into one database hit. In-process on purpose: it works with no
# Redis, and a stale entry lives at most MARKETPLACE_CACHE_TTL seconds.
MARKETPLACE_CACHE_TTL = 30
_CACHE_MAX_ENTRIES = 200
_cache: dict[str, tuple[float, Any]] = {}


def _cached(key: str, build: Callable[[], Any]) -> Any:
    now = time.monotonic()
    hit = _cache.get(key)
    if hit and hit[0] > now:
        return hit[1]
    value = build()
    if len(_cache) >= _CACHE_MAX_ENTRIES:
        # Drop expired entries first, then everything if that wasn't enough.
        for k in [k for k, (exp, _) in _cache.items() if exp <= now]:
            _cache.pop(k, None)
        if len(_cache) >= _CACHE_MAX_ENTRIES:
            _cache.clear()
    _cache[key] = (now + MARKETPLACE_CACHE_TTL, value)
    return value


def clear_marketplace_cache() -> None:
    """Call after a change that must show up immediately (tests, admin tools)."""
    _cache.clear()


def _public_product_loading():
    """Load everything PublicProduct serializes in a fixed handful of queries.

    Relationships are lazy by default, so serializing N products used to fire
    several extra queries *per product* (media, creator, versions, each
    version's printability report). Across regions that was seconds of pure
    latency. The 384-float embedding is deferred: no marketplace response uses
    it, and it would otherwise be shipped for every row.
    """
    return (
        selectinload(Product.media),
        selectinload(Product.creator),
        selectinload(Product.versions).selectinload(ProductVersion.printability_report),
        defer(Product.embedding),
    )


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


FALLBACK_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=500"


def _build_homepage(db: Session) -> dict:
    from app.models.user import UserRole

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
            "role": role_label,
            "initials": (c.company_name or c.full_name or c.email)[0].upper(),
            # Only a creator's own uploaded avatar. This used to fall back to a
            # stock photo of an unrelated person, which showed real names beside
            # a face that was not theirs. None here lets the card render their
            # initials instead.
            "image": c.avatar_url or None,
        })

    # 2. Categories and one image each, in a single query. This used to run one
    # query per category and then lazy-load that product's media on top.
    rows = (
        db.query(Product.category, ProductMedia.media_url)
        .outerjoin(ProductMedia, ProductMedia.product_id == Product.id)
        .filter(Product.category != None, Product.status == ProductStatus.published)
        .order_by(Product.category, ProductMedia.is_primary.desc(), ProductMedia.id)
        .all()
    )
    category_images: dict[str, str] = {}
    for cat_name, media_url in rows:
        if cat_name not in category_images or (category_images[cat_name] == FALLBACK_CATEGORY_IMAGE and media_url):
            category_images[cat_name] = media_url or FALLBACK_CATEGORY_IMAGE
    categories = [{"name": name, "image": image} for name, image in category_images.items()]

    if not categories:
        # Fallback if DB has no products
        categories = [
            {"name": "Architecture", "image": FALLBACK_CATEGORY_IMAGE},
            {"name": "Miniatures", "image": "https://images.unsplash.com/photo-1590483736622-398541ce0ce6?auto=format&fit=crop&q=80&w=500"},
        ]

    # 3. The three product shelves. Pick the ids with three cheap id-only
    # queries, then load all of those products together so the related rows are
    # fetched once for the whole page instead of once per shelf.
    published = Product.status == ProductStatus.published
    featured_ids = [i for (i,) in db.query(Product.id).filter(published, Product.is_featured == True).limit(4).all()]
    trending_ids = [i for (i,) in db.query(Product.id).filter(published).order_by(desc(Product.mock_order_count)).limit(4).all()]
    new_ids = [i for (i,) in db.query(Product.id).filter(published).order_by(desc(Product.created_at)).limit(4).all()]

    wanted = set(featured_ids) | set(trending_ids) | set(new_ids)
    by_id: dict[int, Product] = {}
    if wanted:
        loaded = (
            db.query(Product)
            .options(*_public_product_loading())
            .filter(Product.id.in_(wanted))
            .all()
        )
        by_id = {p.id: p for p in enrich_products(db, loaded)}

    def shelf(ids: List[int]) -> List[dict]:
        # model_dump(mode="json") so the cached value is plain, immutable-ish data.
        return [ProductSchema.model_validate(by_id[i]).model_dump(mode="json") for i in ids if i in by_id]

    # Pydantic v2 requires explicit serialization if no response_model is provided
    return {
        "categories": categories,
        "popular_creators": popular_creators,
        "featured": shelf(featured_ids),
        "trending": shelf(trending_ids),
        "new_arrivals": shelf(new_ids),
    }


@router.get("/homepage")
def get_homepage(db: Session = Depends(deps.get_db)) -> Any:
    return _cached("homepage", lambda: _build_homepage(db))


def _catalogue_filters(query, format=None, sort="featured"):
    """Apply offer permissions and a deterministic order before pagination."""
    if format == "digital":
        query = query.filter(Product.is_mode_2_active.is_(True), Product.digital_download_enabled.is_(True))
    elif format == "physical":
        query = query.filter(or_(Product.is_mode_3_active.is_(True), Product.is_mode_4_active.is_(True)))
    # Explicit catalogue sorting replaces semantic-search order. Every sort has
    # an id tie-break so equal prices/timestamps cannot repeat across pages.
    query = query.order_by(None)
    price = Product.base_print_price if format == "physical" else Product.price
    if sort == "price_asc":
        return query.order_by(price.asc(), Product.id.asc())
    if sort == "price_desc":
        return query.order_by(price.desc(), Product.id.asc())
    if sort == "newest":
        return query.order_by(Product.created_at.desc(), Product.id.desc())
    return query.order_by(Product.is_featured.desc(), Product.created_at.desc(), Product.id.desc())


@router.get("/products", response_model=List[ProductSchema])
def get_products(
    db: Session = Depends(deps.get_db),
    q: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    format: Optional[Literal["physical", "digital"]] = None,
    sort: Literal["featured", "newest", "price_asc", "price_desc"] = "featured",
    currency: Optional[Literal["INR", "USD"]] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    def build() -> list:
        query = db.query(Product).options(*_public_product_loading()).filter(Product.status == ProductStatus.published)

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
                # The embedding column is deferred above for response payloads;
                # ordering by it in SQL does not need it loaded into Python.
                query = query.filter(
                    or_(text_match, Product.embedding.cosine_distance(query_embedding) < 0.7)
                ).order_by(Product.embedding.cosine_distance(query_embedding))

        if category:
            query = query.filter(Product.category == category)

        if currency:
            query = query.filter(Product.currency == currency)

        price_column = Product.base_print_price if format == "physical" else Product.price
        if min_price is not None:
            query = query.filter(price_column >= min_price)

        if max_price is not None:
            query = query.filter(price_column <= max_price)

        query = _catalogue_filters(query, format=format, sort=sort)

        products = enrich_products(db, query.offset(skip).limit(limit).all())
        return [ProductSchema.model_validate(p).model_dump(mode="json") for p in products]

    key = f"products:{q}:{category}:{min_price}:{max_price}:{format}:{sort}:{currency}:{skip}:{limit}"
    return _cached(key, build)


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
        db.query(Product.id, Product.title, Product.category, Product.price, Product.currency)
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
            {"id": r.id, "title": r.title, "category": r.category, "price": float(r.price), "currency": r.currency}
            for r in product_rows
        ],
        "categories": matching_categories[:3],
    }

@router.get("/products/{id}", response_model=ProductSchema)
def get_product(
    id: int,
    db: Session = Depends(deps.get_db),
) -> Any:
    product = (
        db.query(Product)
        .options(*_public_product_loading())
        .filter(Product.id == id, Product.status == ProductStatus.published)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return enrich_products(db, [product])[0]

@router.get("/products/{id}/similar", response_model=List[ProductSchema])
def get_similar_products(
    id: int,
    db: Session = Depends(deps.get_db),
    limit: int = Query(4, ge=1, le=20),
) -> Any:
    # This one needs the source product's embedding, so it is loaded without the
    # deferral; the candidates it is compared against stay deferred.
    product = db.query(Product).filter(Product.id == id, Product.status == ProductStatus.published).first()
    if not product or product.embedding is None:
        return []

    similar = (
        db.query(Product)
        .options(*_public_product_loading())
        .filter(
            Product.id != id,
            Product.status == ProductStatus.published,
            Product.embedding != None,
        )
        .order_by(Product.embedding.cosine_distance(product.embedding))
        .limit(limit)
        .all()
    )

    return enrich_products(db, similar)
