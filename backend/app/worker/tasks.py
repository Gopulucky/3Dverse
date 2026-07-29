import logging
from datetime import datetime, timedelta
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.user import User  # Must import so SQLAlchemy registry knows about it
from app.models.order import Order
from app.services import stock
from app.services.printability import analyze_version

logger = logging.getLogger(__name__)

# Abandoned checkouts hold stock hostage forever otherwise -- release it back
# to the shelf once it's clear the buyer isn't coming back to pay.
PENDING_ORDER_EXPIRY_MINUTES = 30


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
