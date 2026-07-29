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


def get_embedding(text: str) -> list[float] | None:
    """
    Generates a 384-dimensional embedding for the given text using
    all-MiniLM-L6-v2, or None if no worker is available to compute one.

    Runs on the Celery worker when one is reachable, so the model itself
    never loads into the web process -- loading it in-request added several
    seconds of latency and ~400MB RSS to the web dyno, which OOMs on Render's
    starter plan. In development it falls back to computing locally so the
    feature works without a worker; in production it returns None instead,
    because the OOM kills the request mid-flight and the browser reports the
    dropped connection as a CORS failure rather than as a server error.
    Callers must treat None as "no embedding" and degrade to text search.
    """
    if _celery_worker_available():
        # Dispatched by name: importing app.worker.tasks here would drag
        # trimesh/numpy/scipy into the web process, which is exactly the RSS
        # this indirection exists to avoid.
        from app.core.celery_app import celery_app
        try:
            result = celery_app.send_task(
                "app.worker.tasks.compute_embedding", args=[text], retry=False
            )
            return result.get(timeout=10)
        except Exception as e:
            logger.warning("Embedding worker call failed (%s)", e)

    from app.core.config import settings
    if settings.is_production:
        logger.warning("No embedding worker reachable; proceeding without an embedding")
        return None
    return _local_embedding(text)
