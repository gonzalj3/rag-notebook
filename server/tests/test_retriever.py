import uuid

from app.services.retriever import _rrf_fuse, _is_meta_query, _apply_meta_boost

d1, d2, d3 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
c1, c2, c3 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()


def test_rrf_fuse_basic():
    """RRF should combine rankings from both result lists."""
    vector = [
        (str(d1), str(c1), "text1", 0, 10, 0.1),
        (str(d2), str(c2), "text2", 0, 10, 0.2),
    ]
    bm25 = [
        (str(d2), str(c2), "text2", 0, 10, 5.0),
        (str(d3), str(c3), "text3", 0, 10, 3.0),
    ]
    results = _rrf_fuse(vector, bm25, k=60)

    assert len(results) == 3
    # chunk2 appears in both lists, should have highest score
    assert results[0].chunk_content == "text2"


def test_rrf_fuse_single_list():
    """Items only in one list should still appear."""
    vector = [(str(d1), str(c1), "text1", 0, 10, 0.1)]
    bm25 = []
    results = _rrf_fuse(vector, bm25, k=60)

    assert len(results) == 1
    assert results[0].chunk_content == "text1"


def test_rrf_fuse_empty():
    results = _rrf_fuse([], [], k=60)
    assert results == []


# --- Fix D: Meta-query detection and first-chunk boost ---

def test_is_meta_query_thesis():
    """Queries asking for the thesis should be detected as meta."""
    assert _is_meta_query("what is the main thesis") is True
    assert _is_meta_query("what's the thesis of this article") is True


def test_is_meta_query_summary():
    """Queries asking for summary should be detected as meta."""
    assert _is_meta_query("summarize this article") is True
    assert _is_meta_query("give me a summary") is True
    assert _is_meta_query("what is the overview") is True


def test_is_meta_query_negative():
    """Content questions should not be detected as meta."""
    assert _is_meta_query("what did the author say about chunking") is False
    assert _is_meta_query("how does BGE-M3 work") is False
    assert _is_meta_query("tell me about vulnerabilities") is False


def test_apply_meta_boost_boosts_chunk_zero():
    """Meta-query boost should increase score of chunk_index=0 results."""
    from app.services.retriever import RetrievalResult
    results = [
        RetrievalResult(
            document_id=d1, chunk_id=c1, chunk_content="mid-article",
            chunk_index=3, chunk_token_count=100, score=0.02,
        ),
        RetrievalResult(
            document_id=d2, chunk_id=c2, chunk_content="opening",
            chunk_index=0, chunk_token_count=100, score=0.018,
        ),
    ]
    boosted = _apply_meta_boost(results)
    # After boost, chunk 0 should outrank the mid-article chunk
    assert boosted[0].chunk_index == 0
    assert boosted[0].chunk_content == "opening"


def test_apply_meta_boost_preserves_order_when_no_chunk_zero():
    """Boost shouldn't reorder when no chunk_index=0 is present."""
    from app.services.retriever import RetrievalResult
    results = [
        RetrievalResult(
            document_id=d1, chunk_id=c1, chunk_content="a",
            chunk_index=2, chunk_token_count=100, score=0.02,
        ),
        RetrievalResult(
            document_id=d2, chunk_id=c2, chunk_content="b",
            chunk_index=3, chunk_token_count=100, score=0.01,
        ),
    ]
    boosted = _apply_meta_boost(results)
    assert boosted[0].chunk_content == "a"
    assert boosted[1].chunk_content == "b"
