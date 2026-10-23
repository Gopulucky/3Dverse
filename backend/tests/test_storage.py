import asyncio
import io
import os

import pytest
from starlette.datastructures import UploadFile

from app.core import storage
from app.core.storage import (
    InvalidUpload,
    UploadTooLarge,
    local_path_for,
    looks_like_image,
    safe_extension,
)


# --- extension allow-list ------------------------------------------------------
@pytest.mark.parametrize("name,ext", [("Model.STL", "stl"), ("pic.jpeg", "jpeg"), ("a.b.c.png", "png"), ("clip.mp4", "mp4")])
def test_allowed_extensions_are_accepted_and_lowercased(name, ext):
    assert safe_extension(name) == ext


@pytest.mark.parametrize(
    "name",
    [
        "malware.exe",
        "page.html",
        "vector.svg",          # SVG can carry script; must never be accepted as an image
        "script.php",
        "noextension",
        "",
        None,
        "a.png/../../../app/x.py",  # path smuggling
        "weird.p ng",
        "archive.tar.gz",
    ],
)
def test_dangerous_or_unknown_filenames_are_rejected(name):
    with pytest.raises(InvalidUpload):
        safe_extension(name)


# --- magic-byte image check ----------------------------------------------------
def test_real_image_headers_pass():
    assert looks_like_image(b"\x89PNG\r\n\x1a\n" + b"x" * 8)
    assert looks_like_image(b"\xff\xd8\xff\xe0" + b"x" * 8)
    assert looks_like_image(b"GIF89a" + b"x" * 8)
    assert looks_like_image(b"RIFF\x00\x00\x00\x00WEBP" + b"x" * 4)


def test_html_or_svg_pretending_to_be_an_image_fails():
    assert not looks_like_image(b"<html><script>alert(1)</script>")
    assert not looks_like_image(b"<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>")
    assert not looks_like_image(b"")
    # RIFF container that is not WEBP (e.g. a WAV) must not pass.
    assert not looks_like_image(b"RIFF\x00\x00\x00\x00WAVE" + b"x" * 4)


# --- path traversal ------------------------------------------------------------
def test_local_path_for_stays_inside_uploads_root():
    ok = local_path_for("/uploads/images/abc.png")
    assert ok.endswith(os.path.join("uploads", "images", "abc.png"))


@pytest.mark.parametrize("evil", ["/uploads/../../etc/passwd", "/uploads/images/../../../app/main.py", "/uploads//../../secret"])
def test_local_path_for_refuses_to_escape(evil):
    with pytest.raises(InvalidUpload):
        local_path_for(evil)


# --- streaming size limit ------------------------------------------------------
def test_oversized_upload_is_rejected_and_nothing_is_left_on_disk(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "LOCAL_UPLOADS_DIR", str(tmp_path))
    monkeypatch.setattr(storage, "UPLOAD_CHUNK_SIZE", 1024)
    monkeypatch.setattr(storage, "get_s3_client", lambda: None)

    upload = UploadFile(filename="big.png", file=io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * 10_000))
    with pytest.raises(UploadTooLarge):
        asyncio.run(storage.save_upload_file(upload, subfolder="images", max_bytes=2048))

    leftovers = [p for p in (tmp_path / "images").glob("*")] if (tmp_path / "images").exists() else []
    assert leftovers == [], "a rejected upload must not leave a partial file behind"


def test_valid_upload_is_saved_with_a_random_name(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "LOCAL_UPLOADS_DIR", str(tmp_path))
    monkeypatch.setattr(storage, "get_s3_client", lambda: None)
    payload = b"\x89PNG\r\n\x1a\n" + b"0" * 100

    url, size = asyncio.run(
        storage.save_upload_file(UploadFile(filename="../../evil name.PNG", file=io.BytesIO(payload)), subfolder="images")
    )
    assert size == len(payload)
    assert url.startswith("/uploads/images/") and url.endswith(".png")
    assert ".." not in url and "evil" not in url, "the user's filename must never reach the stored name"
    assert (tmp_path / "images" / url.rsplit("/", 1)[1]).read_bytes() == payload


# --- public vs private bucket routing -----------------------------------------
class FakeS3:
    def __init__(self):
        self.uploads = []

    def upload_file(self, path, bucket, key, ExtraArgs=None):
        self.uploads.append((bucket, key))


def _configure_buckets(monkeypatch, *, public=True):
    fake = FakeS3()
    monkeypatch.setattr(storage, "get_s3_client", lambda: fake)
    monkeypatch.setattr(storage, "AWS_BUCKET_NAME", "private-models")
    monkeypatch.setattr(storage, "AWS_S3_ENDPOINT_URL", "https://x.supabase.co/storage/v1/s3")
    monkeypatch.setattr(storage, "AWS_PUBLIC_BUCKET_NAME", "public-media" if public else None)
    monkeypatch.setattr(
        storage, "AWS_PUBLIC_BASE_URL",
        "https://x.supabase.co/storage/v1/object/public/public-media" if public else None,
    )
    return fake


@pytest.mark.parametrize("folder", ["media", "images", "avatars", "portfolio", "media/previews"])
def test_public_folders_use_the_public_bucket_and_a_plain_url(monkeypatch, folder):
    _configure_buckets(monkeypatch)
    bucket, url = storage.storage_target(folder, f"{folder}/abc.jpg")
    assert bucket == "public-media"
    assert url == f"https://x.supabase.co/storage/v1/object/public/public-media/{folder}/abc.jpg"


@pytest.mark.parametrize("folder", ["models", "designs", "certifications", "commission_deliveries"])
def test_private_folders_never_use_the_public_bucket(monkeypatch, folder):
    _configure_buckets(monkeypatch)
    bucket, url = storage.storage_target(folder, f"{folder}/abc.stl")
    assert bucket == "private-models"
    assert "/object/public/" not in url


def test_without_a_public_bucket_everything_uses_the_private_one(monkeypatch):
    _configure_buckets(monkeypatch, public=False)
    bucket, _ = storage.storage_target("media", "media/abc.jpg")
    assert bucket == "private-models"


def test_no_object_storage_means_local_disk(monkeypatch):
    monkeypatch.setattr(storage, "get_s3_client", lambda: None)
    assert storage.storage_target("media", "media/abc.jpg") is None


def test_image_upload_goes_to_the_public_bucket_and_leaves_no_local_copy(tmp_path, monkeypatch):
    fake = _configure_buckets(monkeypatch)
    monkeypatch.setattr(storage, "LOCAL_UPLOADS_DIR", str(tmp_path))
    payload = b"\x89PNG\r\n\x1a\n" + b"0" * 100

    url, size = asyncio.run(
        storage.save_upload_file(UploadFile(filename="a.png", file=io.BytesIO(payload)), subfolder="media")
    )
    assert url.startswith("https://x.supabase.co/storage/v1/object/public/public-media/media/")
    assert fake.uploads and fake.uploads[0][0] == "public-media"
    assert list((tmp_path / "media").glob("*")) == []


def test_model_upload_goes_to_the_private_bucket(tmp_path, monkeypatch):
    fake = _configure_buckets(monkeypatch)
    monkeypatch.setattr(storage, "LOCAL_UPLOADS_DIR", str(tmp_path))

    url, _ = asyncio.run(
        storage.save_upload_file(UploadFile(filename="m.stl", file=io.BytesIO(b"solid x")), subfolder="models")
    )
    assert fake.uploads[0][0] == "private-models"
    assert "/object/public/" not in url


def test_failed_cloud_upload_falls_back_to_local_disk(tmp_path, monkeypatch):
    from botocore.exceptions import BotoCoreError

    class Broken(FakeS3):
        def upload_file(self, *a, **k):
            raise BotoCoreError()

    _configure_buckets(monkeypatch)
    monkeypatch.setattr(storage, "get_s3_client", lambda: Broken())
    monkeypatch.setattr(storage, "LOCAL_UPLOADS_DIR", str(tmp_path))
    payload = b"\x89PNG\r\n\x1a\n" + b"0" * 10

    url, _ = asyncio.run(
        storage.save_upload_file(UploadFile(filename="a.png", file=io.BytesIO(payload)), subfolder="media")
    )
    assert url.startswith("/uploads/media/")
