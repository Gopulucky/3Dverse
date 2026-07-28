import json
import urllib.parse
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

DEV_SECRET_KEY = "supersecretkey-change-in-production"


class Settings(BaseSettings):
    PROJECT_NAME: str = "3DVerse API"
    VERSION: str = "0.2.0"
    API_V1_STR: str = "/api"
    # "development" | "production". Anything other than development is treated
    # as production for the safety checks below.
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = DEV_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days

    # CORS. Plain string field (not List[str]) so it can be set from a
    # Render/Vercel env var box as either a comma-separated list or a JSON
    # array -- pydantic-settings would otherwise require strict JSON for a
    # List[str] env var, which is easy to get wrong when pasting by hand.
    BACKEND_CORS_ORIGINS_RAW: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000,https://3dverse-tan.vercel.app",
        validation_alias="BACKEND_CORS_ORIGINS",
    )

    # Database
    POSTGRES_SERVER: str = "localhost:5433"
    POSTGRES_USER: str = "3dverse_user"
    POSTGRES_PASSWORD: str = "3dverse_password"
    POSTGRES_DB: str = "3dverse"

    # Redis. REDIS_URL, if set, wins over the individual host/port/password
    # fields -- hosted Redis (Render, Upstash, etc.) hands out a single
    # connection string rather than discrete host/port/password values.
    REDIS_URL_OVERRIDE: str | None = Field(default=None, validation_alias="REDIS_URL")
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def BACKEND_CORS_ORIGINS(self) -> List[str]:
        raw = self.BACKEND_CORS_ORIGINS_RAW.strip()
        if raw.startswith("["):
            return [str(origin) for origin in json.loads(raw)]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() != "development"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        encoded_password = urllib.parse.quote_plus(self.POSTGRES_PASSWORD)
        return f"postgresql+psycopg://{self.POSTGRES_USER}:{encoded_password}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"

    @property
    def REDIS_URL(self) -> str:
        if self.REDIS_URL_OVERRIDE:
            return self.REDIS_URL_OVERRIDE
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

settings = Settings()

# Refuse to boot a production deployment on the shared development secret --
# every token the platform has ever issued would be forgeable by anyone who has
# read this repository.
if settings.is_production and settings.SECRET_KEY == DEV_SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY is still the development default. Set a strong SECRET_KEY "
        "environment variable before running with ENVIRONMENT != development."
    )

# POSTGRES_SERVER must be "host:port". A malformed value (missing/empty port,
# stray whitespace) otherwise surfaces as an opaque
# `ValueError: invalid literal for int() with base 10: ''` deep inside
# SQLAlchemy's URL parser, which is hard to trace back to the env var.
_server_host, _, _server_port = settings.POSTGRES_SERVER.strip().partition(":")
if not _server_host or not _server_port.isdigit():
    raise RuntimeError(
        f"POSTGRES_SERVER is set to {settings.POSTGRES_SERVER!r}, which is not "
        "a valid 'host:port' value (e.g. db.<project-ref>.supabase.co:5432). "
        "Check for a missing port, trailing colon, or stray whitespace."
    )
