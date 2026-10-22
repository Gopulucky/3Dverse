"""Shared test setup.

These tests deliberately need no database, Redis or network: they cover the
logic that guards security and performance (config safety checks, tokens,
upload validation, the rate limiter, the Redis reconnect cooldown and the
marketplace cache). Environment is set before any `app` module is imported
because `app.core.config` validates it at import time.
"""
import os

os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("POSTGRES_SERVER", "localhost:5433")
# Keep tests offline: never let a stray local .env point them at real services.
os.environ.pop("REDIS_URL", None)
