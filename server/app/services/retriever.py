import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.embedder import embed


@dataclass
class RetrievalResult:
    document_id: uuid.UUID
    chunk_id: uuid.UUID
    chunk_content: str
    chunk_index: int | None
    chunk_token_count: int | None
    score: float


RRF_K = 60

# Words that signal the user is asking about a document as a whole
# (summary, thesis, overview) rather than specific content within it.
# When detected, we boost chunk_index=0 (the opening/thesis) results.
META_QUERY_SIGNALS = {
    "thesis", "summary", "summarize", "summarise", "overview",
    "gist", "abstract", "premise", "synopsis",
}
META_BOOST_FACTOR = 1.5


def _is_meta_query(query_text: str) -> bool:
    """Detect queries asking for the overall point of a document."""
    tokens = set(query_text.lower().split())
    # Strip punctuation for common suffixes
    tokens = {t.strip(".,?!'\"") for t in tokens}
    if tokens & META_QUERY_SIGNALS:
        return True
    # Also check for "main point", "main argument", "main idea" as multi-word phrases
    lower = query_text.lower()
    if any(phrase in lower for phrase in ("main point", "main argument", "main idea", "main takeaway")):
        return True
    return False


def _apply_meta_boost(results: list["RetrievalResult"]) -> list["RetrievalResult"]:
    """Boost the score of chunk_index=0 results and re-sort.

    When the user asks a meta-question, the opening/thesis of each document
    is more likely to contain the answer than mid-article chunks.
    """
    for r in results:
        if r.chunk_index == 0:
            r.score *= META_BOOST_FACTOR
    results.sort(key=lambda r: r.score, reverse=True)
    return results


async def _vector_search(
    db: AsyncSession,
    query_embedding: list[float],
    limit: int = 20,
    source_types: list[str] | None = None,
    source_url: str | None = None,
    tag_names: list[str] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[tuple[str, str, str, int | None, int | None, float]]:
    """Return (document_id, chunk_id, content, chunk_index, token_count, distance)."""
    conditions = []
    params: dict = {"embedding": str(query_embedding), "limit": limit}

    if source_types:
        conditions.append("d.source_type = ANY(:source_types)")
        params["source_types"] = source_types
    if source_url:
        conditions.append("d.source_url = :source_url")
        params["source_url"] = source_url
    if tag_names:
        conditions.append("EXISTS (SELECT 1 FROM document_tags dt JOIN tags t ON dt.tag_id = t.id WHERE dt.document_id = d.id AND t.name = ANY(:tag_names))")
        params["tag_names"] = tag_names
    if date_from:
        conditions.append("d.created_at >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conditions.append("d.created_at <= :date_to")
        params["date_to"] = date_to

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sql = text(f"""
        SELECT c.document_id, c.id, c.content, c.chunk_index, c.token_count,
               c.embedding <=> CAST(:embedding AS vector) AS distance
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        {where}
        ORDER BY distance ASC
        LIMIT :limit
    """)
    result = await db.execute(sql, params)
    return result.fetchall()


async def _bm25_search(
    db: AsyncSession,
    query_text: str,
    limit: int = 20,
    source_types: list[str] | None = None,
    source_url: str | None = None,
    tag_names: list[str] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[tuple[str, str, str, int | None, int | None, float]]:
    """Return (document_id, chunk_id, content, chunk_index, token_count, rank)."""
    conditions = ["c.tsv @@ plainto_tsquery('english', :query)"]
    params: dict = {"query": query_text, "limit": limit}

    if source_types:
        conditions.append("d.source_type = ANY(:source_types)")
        params["source_types"] = source_types
    if source_url:
        conditions.append("d.source_url = :source_url")
        params["source_url"] = source_url
    if tag_names:
        conditions.append("EXISTS (SELECT 1 FROM document_tags dt JOIN tags t ON dt.tag_id = t.id WHERE dt.document_id = d.id AND t.name = ANY(:tag_names))")
        params["tag_names"] = tag_names
    if date_from:
        conditions.append("d.created_at >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conditions.append("d.created_at <= :date_to")
        params["date_to"] = date_to

    where = f"WHERE {' AND '.join(conditions)}"

    sql = text(f"""
        SELECT c.document_id, c.id, c.content, c.chunk_index, c.token_count,
               ts_rank(c.tsv, plainto_tsquery('english', :query)) AS rank
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        {where}
        ORDER BY rank DESC
        LIMIT :limit
    """)
    result = await db.execute(sql, params)
    return result.fetchall()


def _rrf_fuse(
    vector_results: list[tuple],
    bm25_results: list[tuple],
    k: int = RRF_K,
) -> list[RetrievalResult]:
    """Reciprocal Rank Fusion: score = sum(1 / (k + rank)) for each list."""
    scores: dict[str, float] = {}
    chunk_data: dict[str, tuple] = {}

    for rank, row in enumerate(vector_results):
        chunk_id = str(row[1])
        scores[chunk_id] = scores.get(chunk_id, 0) + 1 / (k + rank + 1)
        chunk_data[chunk_id] = row

    for rank, row in enumerate(bm25_results):
        chunk_id = str(row[1])
        scores[chunk_id] = scores.get(chunk_id, 0) + 1 / (k + rank + 1)
        chunk_data[chunk_id] = row

    sorted_ids = sorted(scores, key=lambda cid: scores[cid], reverse=True)

    results = []
    for chunk_id in sorted_ids:
        row = chunk_data[chunk_id]
        results.append(
            RetrievalResult(
                document_id=uuid.UUID(str(row[0])),
                chunk_id=uuid.UUID(str(row[1])),
                chunk_content=row[2],
                chunk_index=row[3],
                chunk_token_count=row[4],
                score=scores[chunk_id],
            )
        )
    return results


async def hybrid_search(
    db: AsyncSession,
    query_text: str,
    limit: int = 5,
    source_types: list[str] | None = None,
    source_url: str | None = None,
    tag_names: list[str] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[RetrievalResult]:
    query_embedding = embed([query_text])[0]

    filter_kwargs = {
        "source_types": source_types,
        "source_url": source_url,
        "tag_names": tag_names,
        "date_from": date_from,
        "date_to": date_to,
    }

    vector_results = await _vector_search(db, query_embedding, limit=20, **filter_kwargs)
    bm25_results = await _bm25_search(db, query_text, limit=20, **filter_kwargs)

    fused = _rrf_fuse(vector_results, bm25_results)

    # Apply meta-query boost: for "summarize/thesis/overview" questions,
    # prefer the opening chunk of each document
    if _is_meta_query(query_text):
        fused = _apply_meta_boost(fused)

    return fused[:limit]
