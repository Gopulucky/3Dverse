import contextlib
import logging
import os
import shutil
import tempfile
import urllib.parse
import uuid
from typing import Iterator, Optional
from fastapi import UploadFile
from starlette.concurrency import run_in_threadpool
import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)

# Uploads are streamed through in chunks rather than read into memory whole:
# a 100MB model read with `await file.read()` costs 100MB+ of RSS per concurrent
# upload and OOM-kills the web process, which the browser only ever sees as a
# dropped connection ("Failed to fetch").
UPLOAD_CHUNK_SIZE = 1024 * 1024

# Read AWS credentials from environment
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_BUCKET_NAME = os.getenv("AWS_BUCKET_NAME")
# Any S3-compatible endpoint (Supabase Storage, R2, MinIO...). Set this and the
# credentials above and the whole upload path uses object storage instead of the
# container's own disk, which is what actually has to happen in a hosted deploy:
# the API and the Celery worker are separate containers with separate,
# short-lived filesystems, so a file written to one is simply not there for the
# other -- and vanishes entirely on the next deploy.
AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL") or None

# Local fallback directory
LOCAL_UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")

# Every extension any upload endpoint may accept. Anything else -- including a
# filename crafted to smuggle path separators or ".." through naive parsing --
# is rejected before it ever reaches disk.
ALLOWED_UPLOAD_EXTENSIONS = {
    "stl", "obj", "3mf", "step", "stp", "fbx", "blend",  # 3D model files
    "png", "jpg", "jpeg", "gif", "webp",                  # images
    "mp4", "webm", "mov",                                 # videos
}


class InvalidUpload(Exception):
    pass


class UploadTooLarge(InvalidUpload):
    """Raised while streaming once an upload passes the caller's byte budget.
    Distinct from InvalidUpload so callers can answer 413 instead of 400."""
    pass


def safe_extension(filename: str) -> str:
    """Extract a whitelisted extension from a filename. os.path.splitext only
    looks at the final path segment, so a filename like
    "a.png/../../../app/x.py" yields no match here (its true extension after
    the last real path separator is empty) and is rejected, rather than
    letting a naive `filename.split(".")[-1]` smuggle a path through."""
    ext = os.path.splitext(filename or "")[1].lstrip(".").lower()
    if not ext or not ext.isalnum() or ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise InvalidUpload(f"Unsupported file extension: {ext!r}")
    return ext


def looks_like_image(head: bytes) -> bool:
    """Check the first bytes against known image magic numbers, so a file
    that merely claims Content-Type: image/* (client-controlled, easily
    spoofed) can't smuggle HTML/SVG through to be served back and executed."""
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    if head.startswith(b"\xff\xd8\xff"):  # JPEG
        return True
    if head.startswith((b"GIF87a", b"GIF89a")):
        return True
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return True
    return False

def get_s3_client():
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        return boto3.client(
            "s3",
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION,
            endpoint_url=AWS_S3_ENDPOINT_URL,
        )
    return None


def object_url(object_name: str) -> str:
    """URL recorded in the database for a stored object."""
    if AWS_S3_ENDPOINT_URL:
        # Non-AWS endpoints address buckets path-style.
        return f"{AWS_S3_ENDPOINT_URL.rstrip('/')}/{AWS_BUCKET_NAME}/{object_name}"
    return f"https://{AWS_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{object_name}"


def s3_key_for(url: str) -> str:
    """Recover an object key from a stored URL, for either addressing style.

    Parsed properly rather than by string-splitting on the bucket name, so keys
    that happen to contain the bucket name (or a path-style endpoint) resolve
    correctly instead of silently pointing at the wrong object."""
    key = urllib.parse.urlparse(url).path.lstrip("/")

    # A custom endpoint can carry its own path prefix (Supabase Storage serves
    # its S3 API under /storage/v1/s3), which is part of the endpoint, not the key.
    if AWS_S3_ENDPOINT_URL:
        prefix = urllib.parse.urlparse(AWS_S3_ENDPOINT_URL).path.strip("/")
        if prefix and key.startswith(f"{prefix}/"):
            key = key[len(prefix) + 1:]

    if AWS_BUCKET_NAME and key.startswith(f"{AWS_BUCKET_NAME}/"):
        key = key[len(AWS_BUCKET_NAME) + 1:]
    return key

async def save_upload_file(
    upload_file: UploadFile,
    subfolder: str = "models",
    max_bytes: Optional[int] = None,
) -> tuple[str, int]:
    """
    Saves the file to S3 if credentials are provided, otherwise saves locally.
    Returns (url, file_size).

    The body is streamed to disk a chunk at a time and never held in memory in
    full, and `max_bytes` is enforced *during* the stream so an oversized upload
    is rejected before it can fill the disk or the heap.
    """
    file_extension = safe_extension(upload_file.filename)
    unique_filename = f"{uuid.uuid4()}.{file_extension}"

    target_dir = os.path.join(LOCAL_UPLOADS_DIR, subfolder)
    os.makedirs(target_dir, exist_ok=True)
    file_path = os.path.join(target_dir, unique_filename)

    await upload_file.seek(0)
    file_size = 0
    try:
        with open(file_path, "wb") as buffer:
            while True:
                chunk = await upload_file.read(UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                file_size += len(chunk)
                if max_bytes is not None and file_size > max_bytes:
                    raise UploadTooLarge(
                        f"File exceeds the {max_bytes // (1024 * 1024)}MB limit."
                    )
                await run_in_threadpool(buffer.write, chunk)
    except BaseException:
        # Never leave a half-written file behind for a request that failed.
        _remove_quietly(file_path)
        raise

    s3_client = get_s3_client()
    if s3_client and AWS_BUCKET_NAME:
        object_name = f"{subfolder}/{unique_filename}"
        try:
            await run_in_threadpool(
                s3_client.upload_file,
                file_path,
                AWS_BUCKET_NAME,
                object_name,
                ExtraArgs={
                    "ContentType": upload_file.content_type or "application/octet-stream"
                },
            )
            _remove_quietly(file_path)
            return object_url(object_name), file_size
        except (ClientError, BotoCoreError) as e:
            # Keep the file we already streamed to disk and serve it from there
            # rather than failing an upload the user has already waited for.
            logger.warning("S3 upload failed, falling back to local storage: %s", e)

    # Local storage (dev, or S3 unavailable). Note this is the *web* process's
    # disk; see open_stored_file for how the Celery worker reaches it.
    url = f"/uploads/{subfolder}/{unique_filename}"
    return url, file_size


def _remove_quietly(path: str) -> None:
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass


def local_path_for(url: str) -> str:
    """Map a stored `/uploads/...` URL back to a path inside the uploads root,
    refusing anything that escapes it."""
    relative = url.replace("/uploads/", "", 1).lstrip("/")
    root = os.path.realpath(LOCAL_UPLOADS_DIR)
    path = os.path.realpath(os.path.join(root, relative))
    if not path.startswith(root + os.sep):
        raise InvalidUpload(f"Refusing to resolve path outside uploads root: {url!r}")
    return path


@contextlib.contextmanager
def open_stored_file(url: str) -> Iterator[str]:
    """Yield a readable local path for a stored file, whichever backend holds it.

    The Celery worker runs as a separate service with its own filesystem, so a
    file the web process wrote to S3 has to be pulled down before trimesh can
    open it. Without this the worker only ever saw "File not found on server"
    and every upload's printability report failed, which in turn blocked the
    creator from ever publishing the product.
    """
    if not url:
        raise FileNotFoundError("No file URL recorded")

    if not url.startswith("http"):
        path = local_path_for(url)
        if not os.path.isfile(path):
            raise FileNotFoundError(path)
        yield path
        return

    s3_client = get_s3_client()
    if not (s3_client and AWS_BUCKET_NAME):
        raise FileNotFoundError(f"No S3 credentials available to fetch {url}")

    key = s3_key_for(url)
    suffix = os.path.splitext(key)[1]
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        s3_client.download_file(AWS_BUCKET_NAME, key, tmp_path)
        yield tmp_path
    finally:
        _remove_quietly(tmp_path)


def store_local_file(source_path: str, subfolder: str, extension: str) -> str:
    """Publish a file the worker generated (e.g. a preview mesh) into shared
    storage and return its URL. Synchronous — this runs inside Celery tasks."""
    unique_filename = f"{uuid.uuid4()}.{extension.lstrip('.')}"
    s3_client = get_s3_client()

    if s3_client and AWS_BUCKET_NAME:
        object_name = f"{subfolder}/{unique_filename}"
        try:
            s3_client.upload_file(source_path, AWS_BUCKET_NAME, object_name)
            return object_url(object_name)
        except (ClientError, BotoCoreError) as e:
            logger.warning("S3 upload of generated file failed: %s", e)

    target_dir = os.path.join(LOCAL_UPLOADS_DIR, subfolder)
    os.makedirs(target_dir, exist_ok=True)
    destination = os.path.join(target_dir, unique_filename)
    shutil.copyfile(source_path, destination)
    return f"/uploads/{subfolder}/{unique_filename}"

def apply_watermarks(product_id: int, db):
    """
    Applies a basic watermark to all image media for a product.
    This modifies the files in-place for simplicity.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
        from app.models.product import ProductMedia
    except ImportError:
        print("Pillow not installed, skipping watermarking.")
        return

    medias = db.query(ProductMedia).filter(ProductMedia.product_id == product_id, ProductMedia.media_type == 'image').all()
    for media in medias:
        if media.media_url.startswith("http"):
            continue # Skip S3 for now
            
        file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), media.media_url.lstrip("/"))
        if not os.path.exists(file_path):
            continue
            
        try:
            with Image.open(file_path) as img:
                img = img.convert("RGBA")
                txt = Image.new('RGBA', img.size, (255,255,255,0))
                d = ImageDraw.Draw(txt)
                
                # Draw a simple repeating watermark or just one in the center
                text = "3DVERSE WATERMARK " * 5
                y = 0
                while y < img.size[1]:
                    d.text((10, y), text, fill=(255,255,255,100))
                    y += 50
                
                out = Image.alpha_composite(img, txt)
                out.convert("RGB").save(file_path)
                print(f"Watermarked {file_path}")
        except Exception as e:
            print(f"Failed to watermark {file_path}: {e}")
