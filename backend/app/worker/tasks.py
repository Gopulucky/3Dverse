import logging
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.user import User  # Must import so SQLAlchemy registry knows about it
from app.services import payments
from app.services.printability import analyze_version

logger = logging.getLogger(__name__)


@celery_app.task
def analyze_model(version_id: int):
    """Thin wrapper -- the analysis itself lives in app.services.printability so
    the API can run it directly when no worker is deployed."""
    analyze_version(version_id)


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
    stay reserved forever. Same rules as the on-demand expiry the API runs
    (nothing is released while Razorpay shows money moving). Production runs
    no worker, so this is optional: the API expires holds itself."""
    db = SessionLocal()
    try:
        expired_count = payments.expire_stale_holds(db)
        logger.info(f"expire_pending_orders: expired {expired_count} order(s)")
    except Exception as e:
        logger.error(f"expire_pending_orders encountered error: {e}")
        db.rollback()
    finally:
        db.close()
