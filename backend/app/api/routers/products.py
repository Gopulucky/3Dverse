from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User, UserRole
from app.models.product import Product, ProductVersion, ProductMedia, ProductStatus, FulfillmentStatus, SafetyReviewStatus
from app.schemas.product import ProductCreate, ProductUpdate, Product as ProductSchema, ProductVersionResponse as ProductVersionSchema, ProductMedia as ProductMediaSchema
from app.core.storage import save_upload_file, InvalidUpload, looks_like_image

router = APIRouter()

def get_product(db: Session, product_id: int, user: User) -> Product:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return product

@router.get("/creator", response_model=List[ProductSchema])
def read_creator_products(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Retrieve products for the logged-in creator."""
    products = db.query(Product).filter(Product.creator_id == current_user.id).all()
    return products

@router.post("/", response_model=ProductSchema)
def create_product(
    *,
    db: Session = Depends(deps.get_db),
    product_in: ProductCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Create new product."""
    if current_user.role != UserRole.creator:
        raise HTTPException(status_code=403, detail="Only creators can create products")
    
    from app.core.ai import get_embedding
    text_for_embedding = f"{product_in.title} {product_in.description or ''} {product_in.category or ''}".strip()
    embedding = get_embedding(text_for_embedding)

    product = Product(
        title=product_in.title,
        description=product_in.description,
        category=product_in.category,
        tags=product_in.tags,
        price=product_in.price,
        license_type=product_in.license_type,
        status=product_in.status,
        fulfillment_status=product_in.fulfillment_status,
        creator_id=current_user.id,
        embedding=embedding
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@router.put("/{product_id}", response_model=ProductSchema)
def update_product(
    *,
    db: Session = Depends(deps.get_db),
    product_id: int,
    product_in: ProductUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Update a product."""
    product = get_product(db, product_id, current_user)
    
    update_data = product_in.dict(exclude_unset=True)

    # Publishing Validation
    if update_data.get("status") == ProductStatus.published and product.status != ProductStatus.published:
        # Restricted/dangerous design screening -- independent of whether the
        # geometry is manufacturable, and required for every fulfillment path.
        if product.safety_review_status != SafetyReviewStatus.approved:
            detail = (
                "This product is pending safety review and cannot be published yet."
                if product.safety_review_status == SafetyReviewStatus.pending
                else f"This product failed safety review: {product.safety_review_note or 'contact support'}"
            )
            raise HTTPException(status_code=400, detail=detail)

        if product.fulfillment_status == FulfillmentStatus.self:
            if not product.media:
                raise HTTPException(status_code=400, detail="Cannot publish a self-fulfilled product without uploading at least one photo.")
        else:
            latest_version = db.query(ProductVersion).filter(ProductVersion.product_id == product.id, ProductVersion.is_latest == True).first()
            if not latest_version:
                raise HTTPException(status_code=400, detail="Cannot publish a product without an uploaded 3D model.")
                
            report = latest_version.printability_report
            if not report or report.status in ["fail", "pending", "needs-manual-review"]:
                raise HTTPException(status_code=400, detail=f"Cannot publish product. Printability analysis status is: {report.status if report else 'missing'}")
        
        # Trigger watermarking if enabled
        if update_data.get("watermark_enabled", product.watermark_enabled):
            from app.core.storage import apply_watermarks
            apply_watermarks(product.id, db)

    if "title" in update_data or "description" in update_data or "category" in update_data:
        from app.core.ai import get_embedding
        t = update_data.get("title", product.title)
        d = update_data.get("description", product.description) or ""
        c = update_data.get("category", product.category) or ""
        text_for_embedding = f"{t} {d} {c}".strip()
        new_embedding = get_embedding(text_for_embedding)
        # Keep the existing embedding rather than blanking it when no worker
        # is available to compute a fresh one.
        if new_embedding is not None:
            update_data["embedding"] = new_embedding

    for field, value in update_data.items():
        setattr(product, field, value)
        
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@router.get("/{product_id}/versions", response_model=List[ProductVersionSchema])
def read_product_versions(
    *,
    db: Session = Depends(deps.get_db),
    product_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get version history for a product."""
    product = get_product(db, product_id, current_user)
    return product.versions

from app.worker.tasks import analyze_model

@router.post("/{product_id}/upload-model", response_model=ProductVersionSchema)
async def upload_model(product_id: int, file: UploadFile = File(...), db: Session = Depends(deps.get_db), current_user: User = Depends(deps.get_current_active_user)):
    if current_user.role != UserRole.creator:
        raise HTTPException(status_code=403, detail="Only creators can upload models")

    product = db.query(Product).filter(Product.id == product_id, Product.creator_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    extension = file.filename.split(".")[-1].lower()
    allowed_extensions = ["stl", "obj", "3mf", "step", "fbx", "blend"]
    if extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    # Read file size
    contents = await file.read()
    file_size = len(contents)
    # Seek back to 0 for upload_file stream
    await file.seek(0)
    
    if file_size > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 100MB.")

    # Upload to storage (pass the bytes already read above instead of
    # re-reading the whole file a second time)
    try:
        file_url, _ = await save_upload_file(file, subfolder="models", content=contents)
    except InvalidUpload as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Create new version
    latest_version = db.query(ProductVersion).filter(ProductVersion.product_id == product_id, ProductVersion.is_latest == True).first()
    if latest_version:
        latest_version.is_latest = False
        new_version_num = latest_version.version_number + 1
    else:
        new_version_num = 1

    new_version = ProductVersion(
        product_id=product_id,
        file_url=file_url,
        file_name=file.filename,
        file_size=file_size,
        version_number=new_version_num,
        is_latest=True
    )

    db.add(new_version)
    db.commit()
    db.refresh(new_version)

    # Dispatch Celery background task for printability analysis
    analyze_model.delay(new_version.id)

    return new_version

@router.post("/{product_id}/upload-media", response_model=ProductMediaSchema)
async def upload_media(
    *,
    db: Session = Depends(deps.get_db),
    product_id: int,
    file: UploadFile = File(...),
    is_primary: bool = Form(False),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Upload an image or video for the product."""
    product = get_product(db, product_id, current_user)

    media_type = "image" if file.content_type.startswith("image/") else "video" if file.content_type.startswith("video/") else "unknown"
    if media_type == "unknown":
         raise HTTPException(status_code=400, detail="Only images and videos are allowed.")

    # The Content-Type header is client-supplied and easily spoofed (e.g. an
    # HTML/SVG file declaring image/png so it gets served back inline and
    # executes in the victim's browser). Verify the real file signature for
    # images before trusting the declared type; videos are checked by
    # extension only via save_upload_file's whitelist.
    if media_type == "image":
        head = await file.read(16)
        await file.seek(0)
        if not looks_like_image(head):
            raise HTTPException(status_code=400, detail="File content does not match an allowed image format.")

    try:
        url, _ = await save_upload_file(file, subfolder="media")
    except InvalidUpload as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # If is_primary, unset others
    if is_primary:
        db.query(ProductMedia).filter(ProductMedia.product_id == product_id).update({"is_primary": False})
        
    new_media = ProductMedia(
        product_id=product.id,
        media_url=url,
        media_type=media_type,
        is_primary=is_primary
    )
    db.add(new_media)
    db.commit()
    db.refresh(new_media)
    return new_media
