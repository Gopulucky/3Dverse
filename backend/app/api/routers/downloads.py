import os
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User, UserRole
from app.models.order import Order, OrderItem, UNPAID_STATUSES
from app.models.product import Product, ProductVersion
from app.models.collaboration import CollaborationTicket, CertificationReport, PaymentStatus
from app.models.commission import CustomDesignRequest
from app.models.print_partner import PrintPartner
from app.core.storage import LOCAL_UPLOADS_DIR, get_s3_client, AWS_BUCKET_NAME
from app.services.entitlements import has_purchased

router = APIRouter()


def _serve(url: Optional[str], download_name: Optional[str] = None) -> Any:
    """Serve a stored file by its recorded URL, whether it lives on S3 or disk."""
    if not url:
        raise HTTPException(status_code=404, detail="File not found")

    if url.startswith("http"):
        s3 = get_s3_client()
        if not s3 or not AWS_BUCKET_NAME:
            return RedirectResponse(url)
        # Presign so the bucket itself can stay private.
        key = url.split(f"{AWS_BUCKET_NAME}.s3", 1)[-1].split("/", 1)[-1]
        signed = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": AWS_BUCKET_NAME, "Key": key},
            ExpiresIn=300,
        )
        return RedirectResponse(signed)

    # Local file. Resolve inside the uploads root and refuse anything that
    # escapes it, so a crafted stored path can never read arbitrary files.
    relative = url.replace("/uploads/", "", 1).lstrip("/")
    root = os.path.realpath(LOCAL_UPLOADS_DIR)
    path = os.path.realpath(os.path.join(root, relative))
    if not path.startswith(root + os.sep) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(path, filename=download_name or os.path.basename(path))


def _is_assigned_partner(db: Session, user_id: int, product_id: int) -> bool:
    """A print partner fulfilling an order needs the model file to print it."""
    return (
        db.query(Order.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .filter(
            Order.print_partner_id == user_id,
            OrderItem.product_id == product_id,
            Order.status.notin_(UNPAID_STATUSES),
        )
        .first()
        is not None
    )


@router.get("/products/{product_id}/model")
def download_product_model(
    product_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Download a product's current model file. Restricted to the creator, an
    admin, a customer who bought it, or the partner printing it."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    allowed = (
        product.creator_id == current_user.id
        or current_user.role == UserRole.admin
        or has_purchased(db, current_user.id, product_id)
        or _is_assigned_partner(db, current_user.id, product_id)
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="You do not have access to this file")

    version = (
        db.query(ProductVersion)
        .filter(ProductVersion.product_id == product_id, ProductVersion.is_latest == True)
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="No model file for this product")

    return _serve(version.file_url, version.file_name)


@router.get("/orders/{order_id}/invoice")
def download_invoice(
    order_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Invoices carry the buyer's name and shipping address, so they are limited
    to the buyer and admins."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.customer_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="You do not have access to this invoice")

    return _serve(order.invoice_url, f"invoice_{order.id}.pdf")


def _ticket_party(db: Session, ticket: CollaborationTicket, user: User) -> bool:
    if user.role == UserRole.admin or ticket.creator_id == user.id:
        return True
    partner = db.query(PrintPartner).filter(PrintPartner.id == ticket.print_partner_id).first()
    return partner is not None and ticket.print_partner_id == user.id


@router.get("/tickets/{ticket_id}/design")
def download_ticket_design(
    ticket_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """An unreleased design submitted for evaluation -- only the creator who
    submitted it and the partner evaluating it may fetch it."""
    ticket = db.query(CollaborationTicket).filter(CollaborationTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not _ticket_party(db, ticket, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this design")

    return _serve(ticket.design_file_url)


@router.get("/tickets/{ticket_id}/sample-photo")
def download_sample_photo(
    ticket_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Certification sample photo attached to a ticket's cost report."""
    ticket = db.query(CollaborationTicket).filter(CollaborationTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not _ticket_party(db, ticket, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this file")

    report = db.query(CertificationReport).filter(CertificationReport.ticket_id == ticket_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="No certification report for this ticket")

    return _serve(report.sample_photo)


def _load_commission(db: Session, request_id: int, user: User) -> CustomDesignRequest:
    req = db.query(CustomDesignRequest).filter(CustomDesignRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if user.role != UserRole.admin and user.id not in (req.customer_id, req.creator_id):
        raise HTTPException(status_code=403, detail="You do not have access to this file")
    return req


@router.get("/custom-designs/{request_id}/final")
def download_custom_design(
    request_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """The delivered custom design. The commissioning customer only gets it once
    the agreed design fee is paid; the creator who made it always can."""
    req = _load_commission(db, request_id, current_user)

    if (
        current_user.id == req.customer_id
        and req.design_fee_status != PaymentStatus.COMPLETED
    ):
        raise HTTPException(status_code=403, detail="Pay the agreed design fee to download this file")

    return _serve(req.final_design_url, req.final_design_name)


@router.get("/custom-designs/{request_id}/reference")
def download_commission_reference(
    request_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """A reference image attached to a brief — private to the two parties."""
    req = _load_commission(db, request_id, current_user)
    return _serve(req.reference_image_url)
