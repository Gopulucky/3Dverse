import os
import shutil
import uuid
from typing import Optional
from fastapi import UploadFile
import boto3
from botocore.exceptions import ClientError

# Read AWS credentials from environment
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_BUCKET_NAME = os.getenv("AWS_BUCKET_NAME")

# Local fallback directory
LOCAL_UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")

def get_s3_client():
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        return boto3.client(
            "s3",
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION
        )
    return None

async def save_upload_file(upload_file: UploadFile, subfolder: str = "models") -> tuple[str, int]:
    """
    Saves the file to S3 if credentials are provided, otherwise saves locally.
    Returns (url, file_size).
    """
    file_extension = upload_file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    s3_client = get_s3_client()
    
    # Calculate file size by reading it
    file_bytes = await upload_file.read()
    file_size = len(file_bytes)
    # Reset cursor for potential S3 upload
    await upload_file.seek(0)
    
    if s3_client and AWS_BUCKET_NAME:
        # Upload to S3
        object_name = f"{subfolder}/{unique_filename}"
        try:
            s3_client.upload_fileobj(
                upload_file.file, 
                AWS_BUCKET_NAME, 
                object_name,
                ExtraArgs={'ContentType': upload_file.content_type}
            )
            # Generate the URL (assuming bucket is public or URL structure is standard)
            url = f"https://{AWS_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{object_name}"
            return url, file_size
        except ClientError as e:
            print(f"Failed to upload to S3: {e}")
            # Fall back to local storage on failure
            pass
    
    # Local Storage Fallback
    target_dir = os.path.join(LOCAL_UPLOADS_DIR, subfolder)
    os.makedirs(target_dir, exist_ok=True)
    
    file_path = os.path.join(target_dir, unique_filename)
    with open(file_path, "wb") as buffer:
        buffer.write(file_bytes)
        
    # Return local URL path relative to the server
    url = f"/uploads/{subfolder}/{unique_filename}"
    return url, file_size

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
