import type { Document, QueryResult, Project, QueryFilters, ChatMessage } from './types'
import {
  mockDocuments,
  mockSearchResults,
  mockProjects,
  mockChatMessages,
  mockQuotes,
  mockWritingPrompts,
} from './mockData'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Ingest
export async function ingestText(_content: string, tags: string[]): Promise<Document> {
  await delay(800)
  return { ...mockDocuments[1], id: `doc-${Date.now()}`, content: _content, tags, createdAt: new Date().toISOString().slice(0, 10) }
}

export async function ingestUrl(url: string, tags: string[], intent?: string): Promise<Document> {
  await delay(1200)
  return { ...mockDocuments[0], id: `doc-${Date.now()}`, source: url, tags, createdAt: new Date().toISOString().slice(0, 10), metadata: intent ? { intent } : undefined }
}

export async function ingestImage(_file: File, tags: string[]): Promise<Document> {
  await delay(1500)
  return { ...mockDocuments[2], id: `doc-${Date.now()}`, tags, createdAt: new Date().toISOString().slice(0, 10) }
}

export async function ingestConversation(url: string, tags: string[], highlights?: number[]): Promise<Document> {
  await delay(1000)
  return { ...mockDocuments[3], id: `doc-${Date.now()}`, source: url, tags, createdAt: new Date().toISOString().slice(0, 10), metadata: highlights ? { highlights } : undefined }
}

// Query
export async function query(_text: string, filters?: QueryFilters): Promise<QueryResult[]> {
  await delay(400)
  let results = mockSearchResults
  if (filters?.types?.length) {
    results = results.filter((r) => filters.types!.includes(r.document.type))
  }
  if (filters?.limit) {
    results = results.slice(0, filters.limit)
  }
  return results
}

export async function getDocument(id: string): Promise<Document | undefined> {
  await delay(200)
  return mockDocuments.find((d) => d.id === id)
}

// Projects
export async function getProjects(): Promise<Project[]> {
  await delay(300)
  return mockProjects
}

export async function getProject(id: string): Promise<Project | undefined> {
  await delay(200)
  return mockProjects.find((p) => p.id === id)
}

export async function createProject(name: string, description: string): Promise<Project> {
  await delay(500)
  return {
    id: `proj-${Date.now()}`,
    name,
    description,
    icon: '📁',
    tags: [],
    items: [],
    notes: '',
    progress: 0,
    createdAt: new Date().toISOString().slice(0, 10),
  }
}

export async function addToProject(_projectId: string, _documentId: string): Promise<void> {
  await delay(300)
}

export async function getProjectSuggestions(_documentId: string): Promise<Document[]> {
  await delay(600)
  return mockDocuments.slice(3, 6)
}

// Chat
export async function chat(_message: string, _history: ChatMessage[]): Promise<ChatMessage> {
  await delay(1500)
  return mockChatMessages[1]
}

// Compose
export async function getQuotes(_topic: string) {
  await delay(800)
  return mockQuotes
}

export async function getWritingPrompts(_topic: string) {
  await delay(600)
  return mockWritingPrompts
}

// Fetch URL preview
export async function fetchUrlPreview(_url: string) {
  await delay(1200)
  return {
    title: 'Understanding RAG Architecture Patterns',
    domain: 'example.com',
    readTime: '8 min read',
    excerpt: 'A comprehensive guide to building production-ready RAG systems with modern embedding models and retrieval strategies.',
    chunks: 12,
    tokens: 3400,
  }
}

// Fetch conversation
export async function fetchConversation(_url: string) {
  await delay(1500)
  return {
    platform: _url.includes('claude') ? 'claude' : 'chatgpt',
    title: 'Debugging pgvector indexing strategies',
    messageCount: 4,
    messages: [
      { role: 'human' as const, content: 'I\'m building a RAG system with pgvector. Should I use IVFFlat or HNSW indexing?' },
      { role: 'ai' as const, content: 'For your use case, HNSW is likely the better choice. HNSW provides better recall at query time and doesn\'t require the training step that IVFFlat needs.' },
      { role: 'human' as const, content: 'What parameters should I use for HNSW?' },
      { role: 'ai' as const, content: 'For your corpus size, I\'d recommend ef_construction: 128, m: 16, and ef_search: 64. These give you ~99% recall.' },
    ],
  }
}

// Resonance (dialogue mode)
export async function getResonances(_text: string): Promise<QueryResult[]> {
  await delay(800)
  return mockSearchResults.slice(4, 6)
}
