import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Impactus"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    DATABASE_URL: str = f"sqlite:///{Path(__file__).parent.parent / 'impactus.db'}"

    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "openai")
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "")

    RESEARCH_PROVIDER: str = os.getenv("RESEARCH_PROVIDER", "demo")
    SEARCH_API_KEY: str = os.getenv("SEARCH_API_KEY", "")
    SEARCH_BASE_URL: str = os.getenv("SEARCH_BASE_URL", "")

    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Directory with the built frontend (vite dist). When set and present,
    # the API also serves the web app (single-service deployment).
    STATIC_DIR: str = os.getenv("STATIC_DIR", "")

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
