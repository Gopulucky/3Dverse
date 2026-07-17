import os
import trimesh
import json
import logging
import numpy as np
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.user import User  # Must import so SQLAlchemy registry knows about it
from app.models.product import ProductVersion, PrintabilityReport

logger = logging.getLogger(__name__)

# Basic threshold for overhang detection: face normal Z < -0.707 (45 degrees from vertical down)
OVERHANG_THRESHOLD = -0.707

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
