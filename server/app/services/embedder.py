import logging

from app.config import settings

logger = logging.getLogger(__name__)

_model = None


def load_model() -> None:
    global _model
    logger.info("Loading embedding model: %s", settings.embedding_model)
    from sentence_transformers import SentenceTransformer

    _model = SentenceTransformer(settings.embedding_model)
    logger.info("Embedding model loaded")


def get_model():
    if _model is None:
        raise RuntimeError("Embedding model not loaded — call load_model() first")
    return _model


def embed(texts: list[str]) -> list[list[float]]:
    model = get_model()
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return embeddings.tolist()
