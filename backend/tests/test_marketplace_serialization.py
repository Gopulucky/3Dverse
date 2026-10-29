"""The marketplace now caches products as plain JSON-able dicts and FastAPI
re-validates them against the response model on the way out. This proves the
whole round trip (ORM object -> dict -> response model) is lossless, without a
database: the objects are built in memory and never persisted."""
from datetime import datetime

from pydantic import TypeAdapter

import app.main  # noqa: F401  (importing the app registers every model, as in production)
from app.models.product import (
    PrintabilityReport,
    Product,
    ProductMedia,
    ProductStatus,
    ProductVersion,
    SafetyReviewStatus,
)
from app.schemas.product import PublicProduct


def make_product() -> Product:
    now = datetime(2026, 10, 22, 12, 0, 0)
    p = Product(
        id=7, creator_id=3, title="Dragon", description="A dragon", category="Miniatures",
        tags=["dragon"], price=19.5, currency="USD", status=ProductStatus.published,
        created_at=now, updated_at=now,
        available_materials=["PLA"], available_colors=["red"], available_sizes=["S"],
        mode_4_config={"a": 1}, is_mode_2_active=True,
        # Column defaults are applied by the database on insert, so an unsaved
        # in-memory object needs them set explicitly.
        safety_review_status=SafetyReviewStatus.pending,
    )
    p.media = [ProductMedia(id=1, product_id=7, media_url="/uploads/media/x.jpg", media_type="image", is_primary=True, created_at=now)]
    v = ProductVersion(
        id=2, product_id=7, file_url="/uploads/models/secret.stl", file_name="secret.stl",
        file_size=123, version_number=1, is_latest=True, preview_url="/uploads/media/p.glb", created_at=now,
    )
    v.printability_report = PrintabilityReport(
        id=4, version_id=2, status="pass", issues=[], volume_mm3=1.5, dimensions={"x": 1, "y": 2, "z": 3},
        created_at=now, updated_at=now,
    )
    p.versions = [v]
    # Marketplace enrichment attributes, as enrich_products() sets them.
    p.avg_rating, p.review_count, p.creator_name, p.creator_avatar = 4.5, 2, "Ada", None
    return p


def test_round_trip_through_the_cache_format_is_lossless():
    dumped = PublicProduct.model_validate(make_product()).model_dump(mode="json")

    # mode="json" must leave only JSON-native values (safe to cache and re-serve).
    assert isinstance(dumped["created_at"], str)
    assert dumped["status"] == "published"

    revalidated = TypeAdapter(list[PublicProduct]).validate_python([dumped])[0]
    assert revalidated.title == "Dragon"
    assert revalidated.avg_rating == 4.5 and revalidated.review_count == 2
    assert revalidated.creator_name == "Ada"
    assert revalidated.media[0].media_url == "/uploads/media/x.jpg"
    assert revalidated.versions[0].printability_report.status == "pass"


def test_public_response_never_exposes_the_paid_source_file_path():
    dumped = PublicProduct.model_validate(make_product()).model_dump(mode="json")
    version = dumped["versions"][0]
    assert "file_url" not in version and "file_size" not in version
    assert "secret.stl" not in str(dumped), "the gated model file must not leak through the public schema"


def test_embedding_vector_is_not_part_of_the_public_response():
    dumped = PublicProduct.model_validate(make_product()).model_dump(mode="json")
    assert "embedding" not in dumped
