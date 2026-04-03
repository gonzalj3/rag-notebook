from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/rag_notebook"
    database_url_sync: str = "postgresql://postgres:postgres@localhost:5432/rag_notebook"
    embedding_model: str = "BAAI/bge-m3"
    embedding_dimension: int = 1024
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174"]
    upload_dir: str = "uploads"

    model_config = {"env_prefix": "RAG_"}


settings = Settings()
