import logging
import os

logger = logging.getLogger(__name__)

# Loading all-MiniLM-L6-v2 in-process costs ~400MB RSS and downloads the model
# on first use. That is survivable on a laptop and fatal on a small dyno, where
# it OOM-kills the request mid-flight and the browser reports the dropped
# connection as "Failed to fetch".
#
# This used to be gated on `not settings.is_production`, i.e. it was armed by
# *failing* to set ENVIRONMENT -- so the one deployment most likely to be
# misconfigured was also the one that loaded the model. Opt-in instead: the
# fallback now stays off unless someone deliberately turns it on.
ENABLE_LOCAL_EMBEDDINGS = os.getenv("ENABLE_LOCAL_EMBEDDINGS", "").strip().lower() in (
    "1",
    "true",
    "yes",
)

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
    isn't picked up until the web process restarts.

    The probe is hard-bounded (see dispatch.probe_broker). It sits on the
    product-creation path, and with no broker deployed an unbounded probe holds
    the request open long enough for the proxy to drop it -- which the browser
    reports as a bare "Failed to fetch"."""
    global _worker_available
    if _worker_available is None:
        from app.core.dispatch import probe_broker

        _worker_available = probe_broker()
    return _worker_available


def get_embedding(text: str) -> list[float] | None:
    """
    Generates a 384-dimensional embedding for the given text using
    all-MiniLM-L6-v2, or None if no worker is available to compute one.

    Runs on the Celery worker when one is reachable, so the model itself never
    loads into the web process -- loading it in-request adds several seconds of
    latency and ~400MB RSS to the web dyno, which OOMs on a small plan and kills
    the request mid-flight.

    With no worker it returns None, unless ENABLE_LOCAL_EMBEDDINGS is explicitly
    set. Callers must treat None as "no embedding" and degrade to text search.
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

    if not ENABLE_LOCAL_EMBEDDINGS:
        logger.warning("No embedding worker reachable; proceeding without an embedding")
        return None
    return _local_embedding(text)
