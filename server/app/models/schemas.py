import uuid
from datetime import datetime

from pydantic import BaseModel


# --- Tags ---

class TagOut(BaseModel):
    id: int
    name: str


# --- Documents ---

class IngestTextRequest(BaseModel):
    content: str
    source_type: str = "note"
    tags: list[str] = []
    source_url: str | None = None
    user_note: str | None = None
    reflection: str | None = None


class IngestUrlRequest(BaseModel):
    url: str
    intent: str | None = None
    tags: list[str] = []


class IngestConversationRequest(BaseModel):
    share_url: str
    highlights: list[int] | None = None
    reflection: str | None = None
    tags: list[str] = []


class ChunkOut(BaseModel):
    id: uuid.UUID
    content: str
    chunk_index: int | None
    token_count: int | None


class DocumentOut(BaseModel):
    id: uuid.UUID
    content: str
    source_type: str
    source_url: str | None
    source_title: str | None
    user_note: str | None
    reflection: str | None
    is_read: bool
    token_count: int | None
    tags: list[str]
    created_at: datetime


class DocumentDetail(DocumentOut):
    chunks: list[ChunkOut]


class IngestResponse(BaseModel):
    document: DocumentOut
    chunk_count: int
    token_count: int


class UrlPreview(BaseModel):
    title: str | None
    domain: str
    excerpt: str
    read_time: str
    chunk_count: int
    token_count: int


class IngestUrlResponse(BaseModel):
    document: DocumentOut
    preview: UrlPreview


# --- Query ---

class QueryFilters(BaseModel):
    source_types: list[str] | None = None
    source_url: str | None = None
    tags: list[str] | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None


class QueryRequest(BaseModel):
    text: str
    filters: QueryFilters | None = None
    limit: int = 5


class QueryResultOut(BaseModel):
    document: DocumentOut
    chunk: ChunkOut
    score: float


# --- Projects ---

class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    status: str | None = None
    notes: str | None = None


class ProjectOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    icon: str | None
    status: str
    notes: str | None
    item_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProjectDetail(ProjectOut):
    documents: list[DocumentOut]


class AddItemRequest(BaseModel):
    document_id: uuid.UUID


# --- Conversation ---

class ConversationTurn(BaseModel):
    role: str
    content: str


class ConversationPreview(BaseModel):
    platform: str
    title: str | None
    message_count: int
    messages: list[ConversationTurn]
