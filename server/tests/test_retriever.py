import uuid

from app.services.retriever import _rrf_fuse

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
