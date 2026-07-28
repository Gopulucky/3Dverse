import logging

logger = logging.getLogger(__name__)

# Local fallback model, only loaded if no Celery worker is reachable (e.g. a
# dev environment with no worker process running).
_model = None
_worker_available = None


def _local_embedding(text: str) -> list[float]:
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model.encode(text).tolist()


def _celery_worker_available() -> bool:
    """Checked once per process and cached -- this is a liveness probe, not a
    per-request health check, so it's fine if a worker that starts later
    isn't picked up until the web process restarts."""
    global _worker_available
    if _worker_available is None:
        from app.core.celery_app import celery_app
        try:
            pong = celery_app.control.inspect(timeout=0.5).ping()
            _worker_available = bool(pong)
        except Exception:
            _worker_available = False
    return _worker_available


def get_embedding(text: str) -> list[float]:
    """
    Generates a 384-dimensional embedding for the given text using
    all-MiniLM-L6-v2.

    Runs on the Celery worker when one is reachable, so the model itself
    never loads into the web process -- loading it in-request added several
    seconds of latency and ~400MB RSS to the web dyno, which OOMs on Render's
    starter plan. Falls back to computing it locally if no worker is
    reachable, so this still works without one (e.g. local dev).
    """
    if _celery_worker_available():
        from app.worker.tasks import compute_embedding
        try:
            return compute_embedding.delay(text).get(timeout=10)
        except Exception as e:
            logger.warning("Embedding worker call failed (%s); computing in-process", e)
    return _local_embedding(text)
