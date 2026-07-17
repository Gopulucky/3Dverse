import urllib.parse
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "3DVerse API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "supersecretkey-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    POSTGRES_SERVER: str = "localhost:5433"
    POSTGRES_USER: str = "3dverse_user"
    POSTGRES_PASSWORD: str = "3dverse_password"
    POSTGRES_DB: str = "3dverse"
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        encoded_password = urllib.parse.quote_plus(self.POSTGRES_PASSWORD)
        return f"postgresql+psycopg://{self.POSTGRES_USER}:{encoded_password}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"

settings = Settings()
