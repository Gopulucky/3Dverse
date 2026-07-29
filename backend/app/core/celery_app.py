from celery import Celery
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")

celery_app = Celery(
    "3dverse_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.worker.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Without an explicit connect timeout, publishing to an unreachable broker
    # blocks on the TCP connect indefinitely. In the web process that hangs the
    # request (and, in an async handler, the whole event loop) until the proxy
    # gives up -- the browser then reports a perfectly good upload as a network
    # failure. Bound it, and don't let the publish retry policy stretch it out.
    broker_transport_options={
        "socket_connect_timeout": 5,
        "socket_keepalive": True,
    },
    redis_socket_connect_timeout=5,
    broker_connection_retry_on_startup=True,
    task_publish_retry_policy={
        "max_retries": 1,
        "interval_start": 0,
        "interval_step": 0.2,
        "interval_max": 0.5,
    },
    beat_schedule={
        "expire-pending-orders": {
            "task": "app.worker.tasks.expire_pending_orders",
            "schedule": 300.0,  # every 5 minutes
        },
    },
)
