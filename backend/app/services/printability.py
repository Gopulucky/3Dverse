"""Printability analysis, callable from either process.

The Celery worker calls this, and so does the API when no worker is reachable
(see app.api.routers.products.upload_model). Keeping the implementation here
rather than in app.worker.tasks means the API can use it without importing the
worker module, which drags in the embedding model and the periodic-task
machinery it has no use for.

trimesh/numpy are imported lazily inside the functions: in the normal
worker-backed deployment the web process never runs this code and should not pay
a few hundred MB of RSS for the import.
"""

import logging
import os
import tempfile

from app.core.database import SessionLocal
from app.core.storage import open_stored_file, store_local_file
from app.models.user import User  # Import so the SQLAlchemy registry is complete
from app.models.product import ProductVersion, PrintabilityReport

logger = logging.getLogger(__name__)

# Basic threshold for overhang detection: face normal Z < -0.707 (45 degrees from vertical down)
OVERHANG_THRESHOLD = -0.707

# Face budget for the public marketplace preview. Enough to read the silhouette
# and surface detail in a viewer, far too coarse to print as a substitute for
# the real file.
PREVIEW_FACE_BUDGET = 4000


def _write_preview(mesh, version_id: int) -> str | None:
    """Publish a decimated GLB stand-in for the marketplace viewer. The source
    file stays behind /api/downloads; only this reduced mesh is public.

    Goes through store_local_file so the preview lands wherever the web process
    can actually serve it from -- writing it straight to the worker's own disk
    produced a preview_url that 404'd for every visitor."""
    try:
        preview = mesh.copy()
        if len(preview.faces) > PREVIEW_FACE_BUDGET:
            preview = preview.simplify_quadric_decimation(face_count=PREVIEW_FACE_BUDGET)

        # Normalise scale/position so the preview cannot be used to recover the
        # original's true dimensions.
        preview.apply_translation(-preview.bounds.mean(axis=0))
        longest = float(max(preview.extents)) or 1.0
        preview.apply_scale(1.0 / longest)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_file = os.path.join(tmp_dir, f"preview_{version_id}.glb")
            preview.export(tmp_file)
            return store_local_file(tmp_file, subfolder="media/previews", extension="glb")
    except Exception as e:
        logger.warning(f"Preview generation failed for version {version_id}: {e}")
        return None


def analyze_version(version_id: int) -> None:
    """Inspect a model file and write its PrintabilityReport."""
    import trimesh

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

        issues = []
        status = "pass"
        volume = None
        dimensions = None

        try:
            # Resolves against whichever backend holds the file (object storage
            # or the local uploads dir), rather than assuming it sits on this
            # process's own disk.
            with open_stored_file(version.file_url) as file_path:
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
            if len(overhangs) > (len(normals) * 0.25):  # more than 25% of faces are overhangs
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

        except FileNotFoundError as e:
            logger.error(f"Model file unreachable for version {version_id}: {e}")
            report.status = "fail"
            report.issues = [
                "The uploaded file could not be read for analysis. Re-upload the model, "
                "or check that the API and worker share the same file storage."
            ]
            db.commit()
            return
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
        logger.error(f"Printability analysis encountered error: {e}")
        db.rollback()
    finally:
        db.close()
