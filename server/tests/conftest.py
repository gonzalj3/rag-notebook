import asyncio
from unittest.mock import patch

import pytest


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_embed():
    """Mock the embedding function to return deterministic vectors."""
    def fake_embed(texts: list[str]) -> list[list[float]]:
        return [[0.1] * 1024 for _ in texts]

    with patch("app.services.embedder.embed", side_effect=fake_embed) as mock:
        yield mock


@pytest.fixture
def mock_load_model():
    """Mock model loading to avoid downloading BGE-M3 in tests."""
    with patch("app.services.embedder.load_model"):
        yield
