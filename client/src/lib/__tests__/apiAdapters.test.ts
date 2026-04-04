import { describe, it, expect } from 'vitest'
import {
  toDocument,
  toQueryResult,
  toProject,
  toProjectDetail,
  type ServerDocumentOut,
  type ServerQueryResultOut,
  type ServerProjectOut,
  type ServerProjectDetail,
} from '../apiAdapters'

const makeServerDoc = (overrides?: Partial<ServerDocumentOut>): ServerDocumentOut => ({
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  content: 'Full document content that is longer than two hundred characters when we need to test excerpt derivation. '.repeat(3),
  source_type: 'url',
  source_url: 'https://example.com/article',
  source_title: 'Test Article Title',
  user_note: null,
  reflection: null,
  is_read: false,
  token_count: 150,
  tags: ['rag', 'test'],
  created_at: '2026-03-28T10:30:00Z',
  ...overrides,
})

describe('toDocument', () => {
  it('maps server fields to client shape', () => {
    const server = makeServerDoc()
    const doc = toDocument(server)

    expect(doc.id).toBe(server.id)
    expect(doc.type).toBe('url')
    expect(doc.title).toBe('Test Article Title')
    expect(doc.content).toBe(server.content)
    expect(doc.source).toBe('https://example.com/article')
    expect(doc.tags).toEqual(['rag', 'test'])
    expect(doc.createdAt).toBe('2026-03-28')
  })

  it('derives excerpt from content (max 200 chars)', () => {
    const server = makeServerDoc()
    const doc = toDocument(server)

    expect(doc.excerpt.length).toBeLessThanOrEqual(200)
    expect(server.content.startsWith(doc.excerpt.replace('...', ''))).toBe(true)
  })

  it('handles null title and source_url', () => {
    const server = makeServerDoc({ source_title: null, source_url: null })
    const doc = toDocument(server)

    expect(doc.title).toBe('')
    expect(doc.source).toBeUndefined()
  })

  it('handles short content without truncation', () => {
    const server = makeServerDoc({ content: 'Short text.' })
    const doc = toDocument(server)

    expect(doc.excerpt).toBe('Short text.')
  })
})

describe('toQueryResult', () => {
  it('maps chunk content to highlights', () => {
    const server: ServerQueryResultOut = {
      document: makeServerDoc(),
      chunk: {
        id: 'chunk-uuid-1',
        content: 'This is the matching chunk text.',
        chunk_index: 0,
        token_count: 20,
      },
      score: 0.87,
    }
    const result = toQueryResult(server)

    expect(result.highlights).toEqual(['This is the matching chunk text.'])
    expect(result.score).toBe(0.87)
    expect(result.document.type).toBe('url')
  })
})

describe('toProject', () => {
  it('maps status to progress number', () => {
    const server: ServerProjectOut = {
      id: 'proj-uuid-1',
      name: 'Test Project',
      description: 'A test project',
      icon: '📁',
      status: 'collecting',
      notes: 'Some notes',
      item_count: 3,
      created_at: '2026-03-15T00:00:00Z',
      updated_at: '2026-03-20T00:00:00Z',
    }
    const project = toProject(server)

    expect(project.id).toBe('proj-uuid-1')
    expect(project.name).toBe('Test Project')
    expect(project.description).toBe('A test project')
    expect(project.icon).toBe('📁')
    expect(project.progress).toBe(0)
    expect(project.items).toEqual([])
    expect(project.notes).toBe('Some notes')
    expect(project.createdAt).toBe('2026-03-15')
  })

  it('maps drafting status to 50', () => {
    const server: ServerProjectOut = {
      id: 'proj-uuid-1',
      name: 'Test',
      description: null,
      icon: null,
      status: 'drafting',
      notes: null,
      item_count: 0,
      created_at: '2026-03-15T00:00:00Z',
      updated_at: '2026-03-15T00:00:00Z',
    }
    expect(toProject(server).progress).toBe(50)
  })

  it('maps building status to 80', () => {
    const server: ServerProjectOut = {
      id: 'proj-uuid-1',
      name: 'Test',
      description: null,
      icon: null,
      status: 'building',
      notes: null,
      item_count: 0,
      created_at: '2026-03-15T00:00:00Z',
      updated_at: '2026-03-15T00:00:00Z',
    }
    expect(toProject(server).progress).toBe(80)
  })

  it('handles null description, icon, notes', () => {
    const server: ServerProjectOut = {
      id: 'proj-uuid-1',
      name: 'Test',
      description: null,
      icon: null,
      status: 'collecting',
      notes: null,
      item_count: 0,
      created_at: '2026-03-15T00:00:00Z',
      updated_at: '2026-03-15T00:00:00Z',
    }
    const project = toProject(server)
    expect(project.description).toBe('')
    expect(project.icon).toBe('📁')
    expect(project.notes).toBe('')
  })
})

describe('toProjectDetail', () => {
  it('includes mapped documents as items', () => {
    const server: ServerProjectDetail = {
      id: 'proj-uuid-1',
      name: 'Test Project',
      description: 'A test project',
      icon: '📁',
      status: 'collecting',
      notes: 'Notes here',
      item_count: 1,
      created_at: '2026-03-15T00:00:00Z',
      updated_at: '2026-03-20T00:00:00Z',
      documents: [makeServerDoc()],
    }
    const project = toProjectDetail(server)

    expect(project.items).toHaveLength(1)
    expect(project.items[0].type).toBe('url')
    expect(project.items[0].title).toBe('Test Article Title')
  })
})
