"""Small display copies of uploaded product photos.

Cards, the cart and order lists show images a few hundred pixels wide, but the
original upload can be many megabytes. A 480px WebP is typically 20-50x smaller.
"""
import logging
from typing import BinaryIO, Optional
import io

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

THUMB_MAX_SIDE = 480
THUMB_QUALITY = 80
# Decoding costs roughly 4 bytes a pixel. Past this, skip the thumbnail (the
# original is still shown) rather than risk exhausting the small web instance.
MAX_SOURCE_PIXELS = 25_000_000


def make_thumbnail(source: BinaryIO) -> Optional[bytes]:
    """WebP bytes no larger than THUMB_MAX_SIDE on either side, or None.

    Never raises: a photo we cannot decode must not stop the upload. Images
    smaller than the limit are not enlarged."""
    try:
        with Image.open(source) as image:
            if image.width * image.height > MAX_SOURCE_PIXELS:
                logger.info("Skipping thumbnail for a %sx%s image", image.width, image.height)
                return None
            image = ImageOps.exif_transpose(image)  # phone photos carry their rotation in metadata
            image.thumbnail((THUMB_MAX_SIDE, THUMB_MAX_SIDE), Image.Resampling.LANCZOS)
            has_alpha = image.mode in ("RGBA", "LA") or "transparency" in image.info
            image = image.convert("RGBA" if has_alpha else "RGB")
            out = io.BytesIO()
            image.save(out, "WEBP", quality=THUMB_QUALITY, method=4)
            return out.getvalue()
    except Exception:
        logger.info("Could not make a thumbnail", exc_info=True)
        return None
