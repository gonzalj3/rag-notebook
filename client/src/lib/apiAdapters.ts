import type { Document, QueryResult, Project, SourceType } from './types'

// --- Server response types (match Pydantic schemas exactly) ---

export interface ServerChunkOut {
  id: string
  content: string
  chunk_index: number | null
  token_count: number | null
}

export interface ServerDocumentOut {
  id: string
  content: string
  source_type: string
  source_url: string | null
  source_title: string | null
  user_note: string | null
  reflection: string | null
  is_read: boolean
  token_count: number | null
  tags: string[]
  created_at: string
}

export interface ServerQueryResultOut {
  document: ServerDocumentOut
  chunk: ServerChunkOut
  score: number
}

export interface ServerProjectOut {
  id: string
  name: string
  description: string | null
  icon: string | null
  status: string
  notes: string | null
  item_count: number
  created_at: string
  updated_at: string
}

export interface ServerProjectDetail extends ServerProjectOut {
  documents: ServerDocumentOut[]
}

export interface ServerIngestResponse {
  document: ServerDocumentOut
  chunk_count: number
  token_count: number
}

export interface ServerIngestUrlResponse {
  document: ServerDocumentOut
  preview: {
    title: string | null
    domain: string
    excerpt: string
    read_time: string
    chunk_count: number
    token_count: number
  }
}

// --- Mapping functions ---

const STATUS_TO_PROGRESS: Record<string, number> = {
  collecting: 0,
  drafting: 50,
  building: 80,
  complete: 100,
}

function deriveExcerpt(content: string): string {
  if (content.length <= 200) return content
  return content.slice(0, 197) + '...'
}

function formatDate(isoString: string): string {
  return isoString.slice(0, 10)
}

export function toDocument(server: ServerDocumentOut): Document {
  return {
    id: server.id,
    type: server.source_type as SourceType,
    title: server.source_title ?? '',
    content: server.content,
    excerpt: deriveExcerpt(server.content),
    source: server.source_url ?? undefined,
    tags: server.tags,
    createdAt: formatDate(server.created_at),
  }
}

export function toQueryResult(server: ServerQueryResultOut): QueryResult {
  return {
    document: toDocument(server.document),
    score: server.score,
    highlights: [server.chunk.content],
  }
}

export function toProject(server: ServerProjectOut): Project {
  return {
    id: server.id,
    name: server.name,
    description: server.description ?? '',
    icon: server.icon ?? '\u{1F4C1}',
    tags: [],
    items: [],
    notes: server.notes ?? '',
    progress: STATUS_TO_PROGRESS[server.status] ?? 0,
    createdAt: formatDate(server.created_at),
  }
}

export function toProjectDetail(server: ServerProjectDetail): Project {
  return {
    ...toProject(server),
    items: server.documents.map(toDocument),
  }
}
