import logging
from typing import Any, List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.api import deps
from app.core.dispatch import dispatch_task
from app.models.user import User, UserRole
from app.models.product import Product, ProductVersion, ProductMedia, ProductStatus, FulfillmentStatus, SafetyReviewStatus, PrintabilityReport
from app.schemas.product import ProductCreate, ProductUpdate, Product as ProductSchema, ProductVersionResponse as ProductVersionSchema, ProductMedia as ProductMediaSchema
from app.core.storage import save_upload_file, InvalidUpload, UploadTooLarge, looks_like_image, safe_extension

logger = logging.getLogger(__name__)

router = APIRouter()

# Admins list and upload on the platform's own behalf while operating it, the
# same way collaboration.py already treats them as creator-equivalent. Keeping
# this as one constant means the create and upload checks cannot drift apart.
PRODUCT_AUTHOR_ROLES = (UserRole.creator, UserRole.admin)


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
    if current_user.role not in PRODUCT_AUTHOR_ROLES:
        raise HTTPException(
            status_code=403,
            detail=(
                "This account is not set up as a creator. Finish creator onboarding "
                "to start listing products."
            ),
        )
    
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

ALLOWED_MODEL_EXTENSIONS = {"stl", "obj", "3mf", "step", "stp", "fbx", "blend"}
MAX_MODEL_UPLOAD_BYTES = 100 * 1024 * 1024
MAX_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024


@router.post("/{product_id}/upload-model", response_model=ProductVersionSchema)
async def upload_model(product_id: int, background_tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(deps.get_db), current_user: User = Depends(deps.get_current_active_user)):
    if current_user.role not in PRODUCT_AUTHOR_ROLES:
        raise HTTPException(status_code=403, detail="Only creators can upload models")

    product = db.query(Product).filter(Product.id == product_id, Product.creator_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    try:
        extension = safe_extension(file.filename)
    except InvalidUpload:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    if extension not in ALLOWED_MODEL_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Supported: {', '.join(sorted(ALLOWED_MODEL_EXTENSIONS))}",
        )

    # Streamed to storage a chunk at a time, with the size limit enforced mid
    # stream -- reading the whole model into memory first is what made large
    # uploads die as an unexplained dropped connection.
    try:
        file_url, file_size = await save_upload_file(
            file, subfolder="models", max_bytes=MAX_MODEL_UPLOAD_BYTES
        )
    except UploadTooLarge:
        raise HTTPException(status_code=413, detail="File too large. Max 100MB.")
    except InvalidUpload as e:
        raise HTTPException(status_code=400, detail=str(e))

    if file_size == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

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

    # Create the report up front so the version always has a reportable state.
    # If the broker is unreachable the row stays "pending" and the creator sees
    # "analysis queued" instead of a version with no report at all, which the
    # publish check reports as the baffling "analysis status is: missing".
    db.add(PrintabilityReport(version=new_version, status="pending", issues=[]))
    db.commit()
    db.refresh(new_version)

    # Queueing the analysis is best-effort: the file is stored and the version
    # is committed, so a broker outage must not turn this into a failed upload.
    queued = await dispatch_task("app.worker.tasks.analyze_model", new_version.id)
    if not queued:
        # No worker (or no broker) -- run it here instead, but only *after* the
        # response has been sent, so mesh analysis cannot slow down or fail the
        # upload. Without this the report would sit at "pending" forever and the
        # creator could never publish the product.
        logger.warning(
            "Analysis not queued for version %s; running in-process instead.",
            new_version.id,
        )
        background_tasks.add_task(_analyze_in_process, new_version.id)

    return new_version


def _analyze_in_process(version_id: int) -> None:
    """Fallback analysis path for single-service deployments. Imported lazily:
    it pulls in trimesh/numpy, which the web process should not carry when a
    worker is doing this job."""
    from app.services.printability import analyze_version

    try:
        analyze_version(version_id)
    except Exception:
        logger.exception("In-process printability analysis failed for version %s", version_id)

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

    content_type = file.content_type or ""
    media_type = "image" if content_type.startswith("image/") else "video" if content_type.startswith("video/") else "unknown"
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
        url, _ = await save_upload_file(
            file, subfolder="media", max_bytes=MAX_MEDIA_UPLOAD_BYTES
        )
    except UploadTooLarge:
        raise HTTPException(status_code=413, detail="File too large. Max 25MB.")
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
