export type SourceType =
  | 'url'
  | 'note'
  | 'paste'
  | 'handwritten'
  | 'conversation'
  | 'dialogue'
  | 'book_page'
  | 'takeaway'

export interface Document {
  id: string
  title: string
  type: SourceType
  content: string
  excerpt: string
  source?: string
  tags: string[]
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface QueryResult {
  document: Document
  score: number
  highlights: string[]
}

export interface Project {
  id: string
  name: string
  description: string
  icon: string
  tags: string[]
  items: Document[]
  notes: string
  progress: number
  createdAt: string
}

export interface QueryFilters {
  types?: SourceType[]
  tags?: string[]
  limit?: number
}

export interface ConversationMessage {
  role: 'human' | 'ai'
  content: string
}

export interface ChatMessage {
  id: string
  role: 'human' | 'ai'
  content: string
  sources?: QueryResult[]
}
