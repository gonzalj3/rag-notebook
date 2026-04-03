"""Integration tests for query endpoints (require database)."""
import pytest


@pytest.mark.skip(reason="Requires running PostgreSQL + pgvector")
class TestQueryEndpoints:
    """These tests require a running database with seeded data. Run with:
    docker compose up -d
    cd server && pytest tests/test_query.py -v
    """

    async def test_query_returns_results(self):
        """POST /query should return ranked results."""
        pass

    async def test_get_document(self):
        """GET /documents/{id} should return document with chunks."""
        pass
