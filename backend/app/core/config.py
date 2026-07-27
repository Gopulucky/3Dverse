import urllib.parse
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

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
    
    # Database
    POSTGRES_SERVER: str = "localhost:5433"
    POSTGRES_USER: str = "3dverse_user"
    POSTGRES_PASSWORD: str = "3dverse_password"
    POSTGRES_DB: str = "3dverse"
    
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str | None = None
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() != "development"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        encoded_password = urllib.parse.quote_plus(self.POSTGRES_PASSWORD)
        return f"postgresql+psycopg://{self.POSTGRES_USER}:{encoded_password}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"
        
    @property
    def REDIS_URL(self) -> str:
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
