import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import get_db
from app.models.schemas import ChunkOut, DocumentDetail, DocumentOut, QueryRequest, QueryResultOut
from app.models.tables import Document
from app.services.retriever import hybrid_search

router = APIRouter()


def _doc_out(doc: Document) -> dict:
    return {
        "id": doc.id,
        "content": doc.content,
        "source_type": doc.source_type,
        "source_url": doc.source_url,
        "source_title": doc.source_title,
        "user_note": doc.user_note,
        "reflection": doc.reflection,
        "is_read": doc.is_read,
        "token_count": doc.token_count,
        "tags": [t.name for t in doc.tags],
        "created_at": doc.created_at,
    }


@router.post("/query", response_model=list[QueryResultOut])
async def query_documents(req: QueryRequest, db: AsyncSession = Depends(get_db)):
    filters = req.filters
    results = await hybrid_search(
        db,
        query_text=req.text,
        limit=req.limit,
        source_types=filters.source_types if filters else None,
        tag_names=filters.tags if filters else None,
        date_from=str(filters.date_from) if filters and filters.date_from else None,
        date_to=str(filters.date_to) if filters and filters.date_to else None,
    )

    out = []
    for r in results:
        doc_result = await db.execute(
            select(Document).options(selectinload(Document.tags)).where(Document.id == r.document_id)
        )
        doc = doc_result.scalar_one_or_none()
        if not doc:
            continue
        out.append(
            QueryResultOut(
                document=_doc_out(doc),
                chunk=ChunkOut(
                    id=r.chunk_id,
                    content=r.chunk_content,
                    chunk_index=r.chunk_index,
                    token_count=r.chunk_token_count,
                ),
                score=r.score,
            )
        )
    return out


@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(
    source_type: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Document).options(selectinload(Document.tags)).order_by(Document.created_at.desc()).limit(limit)
    if source_type:
        stmt = stmt.where(Document.source_type == source_type)
    result = await db.execute(stmt)
    docs = result.scalars().all()
    return [_doc_out(doc) for doc in docs]


@router.get("/documents/{document_id}", response_model=DocumentDetail)
async def get_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.tags), selectinload(Document.chunks))
        .where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentDetail(
        **_doc_out(doc),
        chunks=[
            ChunkOut(id=c.id, content=c.content, chunk_index=c.chunk_index, token_count=c.token_count)
            for c in sorted(doc.chunks, key=lambda c: c.chunk_index or 0)
        ],
    )
