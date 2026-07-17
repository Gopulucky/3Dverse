from celery import Celery
import os

# Use a local SQLite file instead of Redis, so it works natively on Windows without Docker!
SQLITE_BROKER_URL = "sqla+sqlite:///celery_broker.sqlite"

celery_app = Celery(
    "3dverse_worker",
    broker=SQLITE_BROKER_URL,
    backend="db+sqlite:///celery_results.sqlite",
    include=["app.worker.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
