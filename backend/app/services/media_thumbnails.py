"""Create thumbnails for product images uploaded before thumbnails existed."""
import io
import logging
import urllib.request
from dataclasses import dataclass
from typing import Callable, Optional

from sqlalchemy.orm import Session

from app.core import storage
from app.core.images import make_thumbnail
from app.models.product import ProductMedia

logger = logging.getLogger(__name__)

MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024  # a little above the 25MB upload limit
Fetch = Callable[[str], Optional[bytes]]
Store = Callable[[bytes], str]


@dataclass
class BackfillReport:
    candidates: int = 0
    created: int = 0
    failed: int = 0


def fetch_original(url: str) -> Optional[bytes]:
    """Bytes of a stored image, from local disk or its public URL. None if unavailable."""
    try:
        if url.startswith("http"):
            with urllib.request.urlopen(url, timeout=30) as response:  # noqa: S310 - our own stored URLs
                data = response.read(MAX_DOWNLOAD_BYTES + 1)
            return data if len(data) <= MAX_DOWNLOAD_BYTES else None
        with open(storage.local_path_for(url), "rb") as handle:
            return handle.read()
    except Exception:
        logger.warning("Could not read %s", url, exc_info=True)
        return None


def store_thumbnail(data: bytes) -> str:
    return storage.store_bytes(data, "media", "webp", "image/webp")


def backfill_thumbnails(
    db: Session,
    *,
    apply: bool,
    fetch: Fetch = fetch_original,
    store: Store = store_thumbnail,
    limit: Optional[int] = None,
) -> BackfillReport:
    """Give every image without a thumbnail one. With apply=False nothing is written.

    Safe to re-run: images that already have a thumbnail are skipped, and one bad
    image never stops the rest."""
    query = (
        db.query(ProductMedia)
        .filter(ProductMedia.media_type == "image", ProductMedia.thumb_url.is_(None))
        .order_by(ProductMedia.id)
    )
    if limit:
        query = query.limit(limit)
    report = BackfillReport()
    for media in query.all():
        report.candidates += 1
        if not apply:
            continue
        original = fetch(media.media_url)
        thumb = make_thumbnail(io.BytesIO(original)) if original else None
        if not thumb:
            report.failed += 1
            continue
        try:
            media.thumb_url = store(thumb)
            db.commit()
            report.created += 1
        except Exception:
            db.rollback()
            logger.warning("Could not store the thumbnail for media %s", media.id, exc_info=True)
            report.failed += 1
    return report
