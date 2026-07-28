import os
import trimesh
import json
import logging
from datetime import datetime, timedelta
import numpy as np
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.user import User  # Must import so SQLAlchemy registry knows about it
from app.models.product import ProductVersion, PrintabilityReport
from app.models.order import Order
from app.services import stock

logger = logging.getLogger(__name__)

# Abandoned checkouts hold stock hostage forever otherwise -- release it back
# to the shelf once it's clear the buyer isn't coming back to pay.
PENDING_ORDER_EXPIRY_MINUTES = 30

# Basic threshold for overhang detection: face normal Z < -0.707 (45 degrees from vertical down)
OVERHANG_THRESHOLD = -0.707

# Face budget for the public marketplace preview. Enough to read the silhouette
# and surface detail in a viewer, far too coarse to print as a substitute for
# the real file.
PREVIEW_FACE_BUDGET = 4000


def _write_preview(mesh, version_id: int) -> str | None:
    """Write a decimated GLB stand-in for the marketplace viewer. The source
    file stays behind /api/downloads; only this reduced mesh is public."""
    try:
        preview = mesh.copy()
        if len(preview.faces) > PREVIEW_FACE_BUDGET:
            preview = preview.simplify_quadric_decimation(face_count=PREVIEW_FACE_BUDGET)

        # Normalise scale/position so the preview cannot be used to recover the
        # original's true dimensions.
        preview.apply_translation(-preview.bounds.mean(axis=0))
        longest = float(max(preview.extents)) or 1.0
        preview.apply_scale(1.0 / longest)

        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        preview_dir = os.path.join(base_dir, "uploads", "media", "previews")
        os.makedirs(preview_dir, exist_ok=True)
        file_name = f"preview_{version_id}.glb"
        preview.export(os.path.join(preview_dir, file_name))
        return f"/uploads/media/previews/{file_name}"
    except Exception as e:
        logger.warning(f"Preview generation failed for version {version_id}: {e}")
        return None

@celery_app.task
def analyze_model(version_id: int):
    logger.info(f"Starting analysis for version_id: {version_id}")
    db = SessionLocal()
    try:
        version = db.query(ProductVersion).filter(ProductVersion.id == version_id).first()
        if not version:
            logger.error(f"Version {version_id} not found.")
            return

        report = db.query(PrintabilityReport).filter(PrintabilityReport.version_id == version_id).first()
        if not report:
            report = PrintabilityReport(version_id=version_id, status="pending", issues=[])
            db.add(report)
            db.commit()

        # Construct file path from the file_url
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        # file_url is like /uploads/filename.ext
        file_path = os.path.join(base_dir, version.file_url.lstrip("/"))

        if not os.path.exists(file_path):
            report.status = "fail"
            report.issues = ["File not found on server."]
            db.commit()
            return

        issues = []
        status = "pass"
        volume = None
        dimensions = None

        try:
            # Load mesh
            mesh = trimesh.load(file_path, force='mesh')

            # Extract bounding box and dimensions
            dimensions = {
                "x": float(mesh.extents[0]),
                "y": float(mesh.extents[1]),
                "z": float(mesh.extents[2])
            }

            # Attempt auto-repair if not watertight
            if not mesh.is_watertight:
                trimesh.repair.fill_holes(mesh)
                trimesh.repair.fix_inversion(mesh)
                trimesh.repair.fix_winding(mesh)

            if not mesh.is_watertight:
                issues.append("Model is not watertight even after repair attempts. Needs manual review.")
                status = "needs-manual-review"
            else:
                volume = abs(float(mesh.volume))

            # Check for severe overhangs
            normals = mesh.face_normals
            # Find normals where Z is pointing significantly downwards
            overhangs = normals[normals[:, 2] < OVERHANG_THRESHOLD]
            if len(overhangs) > (len(normals) * 0.25): # more than 25% of faces are overhangs
                issues.append("Model contains significant overhangs (>45 degrees). May require supports.")
                if status == "pass":
                    status = "warning"

            # Approximate Wall Thickness Check
            # For a real implementation, we'd fire rays inward from sampled surface points.
            # Due to performance, we'll do a basic check on bounding box to volume ratio if it's watertight
            if volume and volume > 0:
                bbox_volume = mesh.extents[0] * mesh.extents[1] * mesh.extents[2]
                if volume < (bbox_volume * 0.01):
                    issues.append("Model volume is extremely low compared to its bounding box. Walls may be too thin.")
                    if status == "pass":
                        status = "warning"

            if len(issues) == 0:
                status = "pass"

            version.preview_url = _write_preview(mesh, version.id)

        except Exception as e:
            logger.error(f"Error during analysis: {e}")
            status = "fail"
            issues.append(f"Analysis failed: {str(e)}")

        report.status = status
        report.issues = issues
        report.volume_mm3 = volume
        report.dimensions = dimensions
        
        db.commit()
        logger.info(f"Analysis complete for version {version_id}. Status: {status}")

    except Exception as e:
        logger.error(f"Worker encountered error: {e}")
        db.rollback()
    finally:
        db.close()


_embedding_model = None


@celery_app.task
def compute_embedding(text: str) -> list:
    """Runs in the worker process so the ~400MB sentence-transformers model
    loads here, not in the web process (see app.core.ai.get_embedding)."""
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _embedding_model.encode(text).tolist()


@celery_app.task
def expire_pending_orders():
    """Release stock held by checkouts that were never paid, so it doesn't
    stay reserved forever. Runs on a schedule (see celery_app.conf.beat_schedule)."""
    db = SessionLocal()
    cutoff = datetime.utcnow() - timedelta(minutes=PENDING_ORDER_EXPIRY_MINUTES)
    expired_count = 0
    try:
        orders = (
            db.query(Order)
            .filter(Order.status == "pending_payment", Order.created_at < cutoff)
            .all()
        )
        for order in orders:
            stock.release_for_order(db, order, reason="pending_payment expired")
            order.status = "cancelled"
            db.add(order)
            db.commit()
            expired_count += 1
        logger.info(f"expire_pending_orders: expired {expired_count} order(s)")
    except Exception as e:
        logger.error(f"expire_pending_orders encountered error: {e}")
        db.rollback()
    finally:
        db.close()
