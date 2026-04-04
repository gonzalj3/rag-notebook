import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.schemas import (
    IngestConversationRequest,
    IngestResponse,
    IngestTextRequest,
    IngestUrlRequest,
    IngestUrlResponse,
)
from app.models.tables import Chunk, Document, DocumentTag, Tag
from app.services.chunker import chunk as chunk_text
from app.services.embedder import embed
from app.services.tagger import auto_tag

router = APIRouter()


async def _get_or_create_tags(db: AsyncSession, tag_names: list[str]) -> list[Tag]:
    tags = []
    for name in tag_names:
        result = await db.execute(select(Tag).where(Tag.name == name))
        tag = result.scalar_one_or_none()
        if not tag:
            tag = Tag(name=name)
            db.add(tag)
            await db.flush()
        tags.append(tag)
    return tags


async def _ingest_document(
    db: AsyncSession,
    content: str,
    source_type: str,
    tag_names: list[str],
    source_url: str | None = None,
    source_title: str | None = None,
    user_note: str | None = None,
    reflection: str | None = None,
    image_path: str | None = None,
) -> tuple[Document, int, int]:
    # Auto-tag + merge with user-provided tags
    all_tags = list(set(tag_names + auto_tag(content)))

    # Chunk
    chunks = chunk_text(content, source_type)
    total_tokens = sum(c.token_count for c in chunks)

    # Embed
    chunk_texts = [c.content for c in chunks]
    embeddings = embed(chunk_texts)

    # Create document
    doc = Document(
        content=content,
        source_type=source_type,
        source_url=source_url,
        source_title=source_title,
        user_note=user_note,
        reflection=reflection,
        image_path=image_path,
        token_count=total_tokens,
    )
    db.add(doc)
    await db.flush()

    # Create chunks with embeddings and tsvector
    for chunk_result, embedding in zip(chunks, embeddings):
        chunk_row = Chunk(
            document_id=doc.id,
            content=chunk_result.content,
            chunk_index=chunk_result.index,
            token_count=chunk_result.token_count,
            embedding=embedding,
        )
        db.add(chunk_row)
        await db.flush()
        # Set tsvector via raw SQL (SQLAlchemy doesn't support to_tsvector natively)
        await db.execute(
            text("UPDATE chunks SET tsv = to_tsvector('english', :content) WHERE id = :id"),
            {"content": chunk_result.content, "id": str(chunk_row.id)},
        )

    # Create tags
    tags = await _get_or_create_tags(db, all_tags)
    for tag in tags:
        await db.execute(
            text("INSERT INTO document_tags (document_id, tag_id) VALUES (:doc_id, :tag_id) ON CONFLICT DO NOTHING"),
            {"doc_id": str(doc.id), "tag_id": tag.id},
        )

    await db.commit()
    await db.refresh(doc, attribute_names=["tags"])

    return doc, len(chunks), total_tokens


def _doc_to_response(doc: Document, chunk_count: int, token_count: int) -> IngestResponse:
    return IngestResponse(
        document={
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
        },
        chunk_count=chunk_count,
        token_count=token_count,
    )


@router.post("/text", response_model=IngestResponse)
async def ingest_text(req: IngestTextRequest, db: AsyncSession = Depends(get_db)):
    doc, chunk_count, token_count = await _ingest_document(
        db,
        content=req.content,
        source_type=req.source_type,
        tag_names=req.tags,
        source_url=req.source_url,
        user_note=req.user_note,
        reflection=req.reflection,
    )
    return _doc_to_response(doc, chunk_count, token_count)


@router.post("/url", response_model=IngestUrlResponse)
async def ingest_url(req: IngestUrlRequest, db: AsyncSession = Depends(get_db)):
    from app.services.scraper import scrape_url

    scraped = await scrape_url(req.url)
    doc, chunk_count, token_count = await _ingest_document(
        db,
        content=scraped["text"],
        source_type="url",
        tag_names=req.tags,
        source_url=req.url,
        source_title=scraped["title"],
    )
    read_time = f"{max(1, token_count // 200)} min read"
    return IngestUrlResponse(
        document={
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
        },
        preview={
            "title": scraped["title"],
            "domain": scraped["domain"],
            "excerpt": scraped["text"][:200],
            "read_time": read_time,
            "chunk_count": chunk_count,
            "token_count": token_count,
        },
    )


@router.post("/image", response_model=IngestResponse)
async def ingest_image(
    image: UploadFile = File(...),
    source_type: str = Form("handwritten"),
    source: str | None = Form(None),
    user_note: str | None = Form(None),
    tags: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    from app.services.ocr import extract_text

    image_bytes = await image.read()
    text_content = extract_text(image_bytes)
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    # Save image
    import os
    from app.config import settings
    os.makedirs(settings.upload_dir, exist_ok=True)
    image_filename = f"{uuid.uuid4()}{os.path.splitext(image.filename or '.png')[1]}"
    image_path = os.path.join(settings.upload_dir, image_filename)
    with open(image_path, "wb") as f:
        f.write(image_bytes)

    doc, chunk_count, token_count = await _ingest_document(
        db,
        content=text_content,
        source_type=source_type,
        tag_names=tag_list,
        source_title=source,
        user_note=user_note,
        image_path=image_path,
    )
    return _doc_to_response(doc, chunk_count, token_count)


@router.post("/conversation", response_model=IngestResponse)
async def ingest_conversation(req: IngestConversationRequest, db: AsyncSession = Depends(get_db)):
    from app.services.conversation_parser import parse_conversation

    parsed = await parse_conversation(req.share_url)
    # Format as text with role markers
    content = "\n".join(f"{turn['role'].title()}: {turn['content']}" for turn in parsed["messages"])

    doc, chunk_count, token_count = await _ingest_document(
        db,
        content=content,
        source_type="conversation",
        tag_names=req.tags,
        source_url=req.share_url,
        source_title=parsed.get("title"),
        reflection=req.reflection,
    )
    return _doc_to_response(doc, chunk_count, token_count)
