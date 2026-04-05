import type { Document, QueryResult, Project, QueryFilters } from './types'
import {
  toDocument,
  toQueryResult,
  toProject,
  toProjectDetail,
  type ServerIngestResponse,
  type ServerIngestUrlResponse,
  type ServerQueryResultOut,
  type ServerDocumentOut,
  type ServerProjectOut,
  type ServerProjectDetail,
} from './apiAdapters'

// --- Typed fetch helper ---

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

// --- Ingest ---

export async function ingestText(
  content: string,
  tags: string[],
  options?: { source_type?: string; source_url?: string; user_note?: string; reflection?: string },
): Promise<Document> {
  const data = await fetchJson<ServerIngestResponse>('/api/ingest/text', {
    method: 'POST',
    body: JSON.stringify({ content, tags, ...options }),
  })
  return toDocument(data.document)
}

export async function ingestUrl(url: string, tags: string[], intent?: string): Promise<Document> {
  const data = await fetchJson<ServerIngestUrlResponse>('/api/ingest/url', {
    method: 'POST',
    body: JSON.stringify({ url, intent, tags }),
  })
  return toDocument(data.document)
}

export async function ingestImage(file: File, tags: string[]): Promise<Document> {
  const formData = new FormData()
  formData.append('image', file)
  formData.append('tags', tags.join(','))

  const res = await fetch('/api/ingest/image', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  const data: ServerIngestResponse = await res.json()
  return toDocument(data.document)
}

export async function ingestConversation(url: string, tags: string[], highlights?: number[]): Promise<Document> {
  const data = await fetchJson<ServerIngestResponse>('/api/ingest/conversation', {
    method: 'POST',
    body: JSON.stringify({ share_url: url, highlights, tags }),
  })
  return toDocument(data.document)
}

// --- Query ---

export async function query(text: string, filters?: QueryFilters): Promise<QueryResult[]> {
  const body: Record<string, unknown> = { text }
  if (filters) {
    const serverFilters: Record<string, unknown> = {}
    if (filters.types?.length) serverFilters.source_types = filters.types
    if (filters.tags?.length) serverFilters.tags = filters.tags
    if (filters.sourceUrl) serverFilters.source_url = filters.sourceUrl
    if (Object.keys(serverFilters).length) body.filters = serverFilters
  }
  if (filters?.limit) body.limit = filters.limit

  const data = await fetchJson<ServerQueryResultOut[]>('/api/query', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return data.map(toQueryResult)
}

export async function getDocuments(sourceType?: string, limit = 50): Promise<Document[]> {
  const params = new URLSearchParams()
  if (sourceType) params.set('source_type', sourceType)
  if (limit !== 50) params.set('limit', String(limit))
  const qs = params.toString()
  const data = await fetchJson<ServerDocumentOut[]>(`/api/documents${qs ? `?${qs}` : ''}`)
  return data.map(toDocument)
}

export async function getDocument(id: string): Promise<Document | undefined> {
  const data = await fetchJson<ServerDocumentOut>(`/api/documents/${id}`)
  return toDocument(data)
}

// --- Projects ---

export async function getProjects(): Promise<Project[]> {
  const data = await fetchJson<ServerProjectOut[]>('/api/projects')
  return data.map(toProject)
}

export async function getProject(id: string): Promise<Project | undefined> {
  const data = await fetchJson<ServerProjectDetail>(`/api/projects/${id}`)
  return toProjectDetail(data)
}

export async function createProject(name: string, description: string): Promise<Project> {
  const data = await fetchJson<ServerProjectOut>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  })
  return toProject(data)
}

export async function addToProject(projectId: string, documentId: string): Promise<void> {
  await fetchJson('/api/projects/' + projectId + '/items', {
    method: 'POST',
    body: JSON.stringify({ document_id: documentId }),
  })
}

export async function updateProject(
  id: string,
  updates: { name?: string; description?: string; notes?: string; status?: string },
): Promise<Project> {
  const data = await fetchJson<ServerProjectOut>(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
  return toProject(data)
}

export async function removeFromProject(projectId: string, documentId: string): Promise<void> {
  await fetchJson(`/api/projects/${projectId}/items/${documentId}`, {
    method: 'DELETE',
  })
}

export async function getProjectSuggestions(projectId: string): Promise<Document[]> {
  const data = await fetchJson<ServerDocumentOut[]>(`/api/projects/${projectId}/suggestions`)
  return data.map(toDocument)
}

// --- URL preview (uses ingest/url response) ---

export async function fetchUrlPreview(url: string) {
  const data = await fetchJson<ServerIngestUrlResponse>('/api/ingest/url', {
    method: 'POST',
    body: JSON.stringify({ url, tags: [] }),
  })
  return {
    title: data.preview.title ?? '',
    domain: data.preview.domain,
    readTime: data.preview.read_time,
    excerpt: data.preview.excerpt,
    chunks: data.preview.chunk_count,
    tokens: data.preview.token_count,
  }
}

// --- Conversation preview ---

interface ConversationPreviewResponse {
  platform: string
  title: string | null
  message_count: number
  messages: { role: string; content: string }[]
}

export async function fetchConversation(url: string) {
  const data = await fetchJson<ConversationPreviewResponse>('/api/ingest/conversation/preview', {
    method: 'POST',
    body: JSON.stringify({ share_url: url }),
  })
  return {
    platform: data.platform,
    title: data.title ?? 'Untitled conversation',
    messageCount: data.message_count,
    messages: data.messages.map((m) => ({
      role: (m.role === 'assistant' ? 'ai' : m.role) as 'human' | 'ai',
      content: m.content,
    })),
  }
}

// --- Resonance (reuses query endpoint) ---

export async function getResonances(text: string): Promise<QueryResult[]> {
  return query(text, { limit: 3 })
}
