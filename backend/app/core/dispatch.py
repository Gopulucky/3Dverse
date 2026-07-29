"""Fire-and-forget Celery dispatch for the web process.

Two rules the API has to hold to, both learned the hard way:

1. Queueing a task is *never* allowed to fail a request whose database work has
   already been committed. An upload that is safely stored and then 500s because
   Redis blinked leaves the user staring at an error next to a product that
   plainly exists.
2. Tasks are dispatched **by name**, not by importing app.worker.tasks. That
   module pulls in trimesh/numpy/scipy (hundreds of MB of RSS) which the web
   process has no use for and cannot afford on a small dyno.
"""

import asyncio
import concurrent.futures
import logging
import time

from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

# Upper bound on how long a request may spend trying to reach the broker. The
# broker's own connect timeout should trip first; this is the backstop.
DISPATCH_TIMEOUT_SECONDS = 3.0

# When there is no broker at all -- a single-service deployment with no Redis --
# every dispatch would otherwise pay the full connect-and-fail cost. Remember a
# failure briefly and skip straight to the caller's fallback, while still
# re-probing often enough to pick a broker up once one appears.
BROKER_FAILURE_COOLDOWN_SECONDS = 60.0
_broker_failed_at: float | None = None

# Hard ceiling on the liveness probe. Celery's own inspect(timeout=...) only
# bounds how long it waits for a *reply* -- it does not bound establishing the
# broker connection, so with no Redis at all the call blocks well past it.
BROKER_PROBE_TIMEOUT_SECONDS = 2.0

# Never shut down: a probe thread stuck on a dead broker would otherwise be
# waited on at shutdown, which is exactly the block the timeout exists to avoid.
_probe_pool = concurrent.futures.ThreadPoolExecutor(
    max_workers=2, thread_name_prefix="broker-probe"
)


def broker_recently_failed() -> bool:
    return (
        _broker_failed_at is not None
        and time.monotonic() - _broker_failed_at < BROKER_FAILURE_COOLDOWN_SECONDS
    )


def probe_broker() -> bool:
    """Is a Celery worker reachable? Safe to call from a synchronous request
    handler: it can cost at most BROKER_PROBE_TIMEOUT_SECONDS."""
    global _broker_failed_at

    if broker_recently_failed():
        return False

    def _ping() -> bool:
        from app.core.celery_app import celery_app

        return bool(celery_app.control.inspect(timeout=0.5).ping())

    try:
        reachable = _probe_pool.submit(_ping).result(
            timeout=BROKER_PROBE_TIMEOUT_SECONDS
        )
    except Exception as e:
        logger.warning("Celery worker probe failed: %s", e)
        reachable = False

    if not reachable:
        _broker_failed_at = time.monotonic()
    return reachable


def dispatch_task_sync(task_name: str, *args, **kwargs) -> bool:
    """Queue a task by name. Returns True if the broker accepted it."""
    global _broker_failed_at

    if broker_recently_failed():
        return False

    from app.core.celery_app import celery_app

    try:
        # ignore_result: nobody awaits these, and asking Celery for a result
        # handle makes it open a second connection to the result store, which
        # doubles the time a dead broker takes to fail.
        celery_app.send_task(
            task_name, args=list(args), kwargs=kwargs, retry=False, ignore_result=True
        )
        _broker_failed_at = None
        return True
    except Exception as e:  # broker down, auth failure, DNS, ...
        _broker_failed_at = time.monotonic()
        logger.warning("Could not queue %s: %s", task_name, e)
        return False


async def dispatch_task(task_name: str, *args, **kwargs) -> bool:
    """Async wrapper: runs off the event loop and gives up rather than hanging."""
    global _broker_failed_at
    try:
        return await asyncio.wait_for(
            run_in_threadpool(dispatch_task_sync, task_name, *args, **kwargs),
            timeout=DISPATCH_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        # The worker thread may still be stuck on the broker; record the failure
        # here too so the next request doesn't wait on it all over again.
        _broker_failed_at = time.monotonic()
        logger.warning("Timed out queueing %s after %ss", task_name, DISPATCH_TIMEOUT_SECONDS)
        return False
