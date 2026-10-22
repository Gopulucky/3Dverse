"""Dev helper (not a test): print the SQL the marketplace queries compile to, so it
can be run against a real database to validate it. Run from backend/:
    python tests/_print_sql.py
"""
import os

os.environ.setdefault("ENVIRONMENT", "development")

from sqlalchemy import desc
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session, defer

import app.main  # noqa: F401  (importing the app registers every model, as in production)
from app.models.product import Product, ProductMedia, ProductStatus


def sql(q):
    return str(q.statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


s = Session()  # never connects: we only compile
published = Product.status == ProductStatus.published

queries = {
    "categories_with_image": s.query(Product.category, ProductMedia.media_url)
    .outerjoin(ProductMedia, ProductMedia.product_id == Product.id)
    .filter(Product.category != None, published)
    .order_by(Product.category, ProductMedia.is_primary.desc(), ProductMedia.id),
    "featured_ids": s.query(Product.id).filter(published, Product.is_featured == True).limit(4),
    "trending_ids": s.query(Product.id).filter(published).order_by(desc(Product.mock_order_count)).limit(4),
    "new_ids": s.query(Product.id).filter(published).order_by(desc(Product.created_at)).limit(4),
    "products_list_deferred": s.query(Product).options(defer(Product.embedding)).filter(published).offset(0).limit(20),
}
for name, q in queries.items():
    print(f"-- {name}\n{sql(q)};\n")
