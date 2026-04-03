"""Integration tests for ingest endpoints (require database)."""
import pytest


@pytest.mark.skip(reason="Requires running PostgreSQL + pgvector")
class TestIngestEndpoints:
    """These tests require a running database. Run with:
    docker compose up -d
    cd server && pytest tests/test_ingest.py -v
    """

    async def test_ingest_text(self):
        """POST /ingest/text should create document with chunks."""
        pass

    async def test_ingest_url(self):
        """POST /ingest/url should scrape and store."""
        pass

    async def test_ingest_auto_tags(self):
        """Ingested text about RAG should auto-tag with 'rag'."""
        pass
