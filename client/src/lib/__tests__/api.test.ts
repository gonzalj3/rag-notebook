import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ServerDocumentOut, ServerProjectOut } from '../apiAdapters'

const makeServerDoc = (overrides?: Partial<ServerDocumentOut>): ServerDocumentOut => ({
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  content: 'Test content for document.',
  source_type: 'note',
  source_url: null,
  source_title: 'Test Doc',
  user_note: null,
  reflection: null,
  is_read: false,
  token_count: 50,
  tags: ['test'],
  created_at: '2026-03-28T10:30:00Z',
  ...overrides,
})

const makeServerProject = (overrides?: Partial<ServerProjectOut>): ServerProjectOut => ({
  id: 'proj-uuid-1',
  name: 'Test Project',
  description: 'A project',
  icon: '📁',
  status: 'collecting',
  notes: '',
  item_count: 0,
  created_at: '2026-03-15T00:00:00Z',
  updated_at: '2026-03-15T00:00:00Z',
  ...overrides,
})

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockJsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

beforeEach(() => {
  mockFetch.mockReset()
})

// Dynamic import so the stubbed fetch is in place before module loads
async function loadApi() {
  // Clear module cache to pick up fresh fetch stub
  vi.resetModules()
  return import('../api')
}

describe('ingestText', () => {
  it('posts to /api/ingest/text with correct body', async () => {
    const serverResponse = {
      document: makeServerDoc({ source_type: 'note' }),
      chunk_count: 2,
      token_count: 50,
    }
    mockFetch.mockReturnValueOnce(mockJsonResponse(serverResponse))

    const { ingestText } = await loadApi()
    const doc = await ingestText('Hello world', ['test'])

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/ingest/text')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.content).toBe('Hello world')
    expect(body.tags).toEqual(['test'])
    expect(doc.type).toBe('note')
  })
})

describe('ingestUrl', () => {
  it('posts to /api/ingest/url and returns mapped document', async () => {
    const serverResponse = {
      document: makeServerDoc({ source_type: 'url', source_url: 'https://example.com' }),
      preview: {
        title: 'Example',
        domain: 'example.com',
        excerpt: 'An excerpt',
        read_time: '5 min',
        chunk_count: 3,
        token_count: 100,
      },
    }
    mockFetch.mockReturnValueOnce(mockJsonResponse(serverResponse))

    const { ingestUrl } = await loadApi()
    const doc = await ingestUrl('https://example.com', ['web'], 'learn about X')

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/ingest/url')
    const body = JSON.parse(opts.body)
    expect(body.url).toBe('https://example.com')
    expect(body.intent).toBe('learn about X')
    expect(body.tags).toEqual(['web'])
    expect(doc.type).toBe('url')
  })
})

describe('ingestImage', () => {
  it('posts FormData with field named "image" and CSV tags', async () => {
    const serverResponse = {
      document: makeServerDoc({ source_type: 'handwritten' }),
      chunk_count: 1,
      token_count: 30,
    }
    mockFetch.mockReturnValueOnce(mockJsonResponse(serverResponse))

    const { ingestImage } = await loadApi()
    const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' })
    const doc = await ingestImage(file, ['notes', 'llm'])

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/ingest/image')
    expect(opts.body).toBeInstanceOf(FormData)
    const formData = opts.body as FormData
    expect(formData.get('image')).toBeInstanceOf(File)
    expect(formData.get('tags')).toBe('notes,llm')
    // FormData should not have Content-Type header (browser sets it with boundary)
    expect(opts.headers?.['Content-Type']).toBeUndefined()
    expect(doc.type).toBe('handwritten')
  })
})

describe('query', () => {
  it('posts to /api/query with filters', async () => {
    const serverResponse = [
      {
        document: makeServerDoc(),
        chunk: { id: 'c1', content: 'matched text', chunk_index: 0, token_count: 10 },
        score: 0.92,
      },
    ]
    mockFetch.mockReturnValueOnce(mockJsonResponse(serverResponse))

    const { query } = await loadApi()
    const results = await query('search term', { types: ['note'], limit: 5 })

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/query')
    const body = JSON.parse(opts.body)
    expect(body.text).toBe('search term')
    expect(body.filters.source_types).toEqual(['note'])
    expect(body.limit).toBe(5)
    expect(results).toHaveLength(1)
    expect(results[0].highlights).toEqual(['matched text'])
  })
})

describe('getDocument', () => {
  it('fetches /api/documents/{id}', async () => {
    const serverDoc = makeServerDoc()
    mockFetch.mockReturnValueOnce(mockJsonResponse(serverDoc))

    const { getDocument } = await loadApi()
    const doc = await getDocument('a1b2c3d4-e5f6-7890-abcd-ef1234567890')

    expect(mockFetch.mock.calls[0][0]).toBe('/api/documents/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    expect(doc?.title).toBe('Test Doc')
  })
})

describe('getProjects', () => {
  it('fetches /api/projects and maps array', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse([makeServerProject()]))

    const { getProjects } = await loadApi()
    const projects = await getProjects()

    expect(mockFetch.mock.calls[0][0]).toBe('/api/projects')
    expect(projects).toHaveLength(1)
    expect(projects[0].name).toBe('Test Project')
    expect(projects[0].progress).toBe(0)
  })
})

describe('createProject', () => {
  it('posts to /api/projects', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse(makeServerProject({ name: 'New Proj' })))

    const { createProject } = await loadApi()
    await createProject('New Proj', 'Description')

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/projects')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.name).toBe('New Proj')
    expect(body.description).toBe('Description')
  })
})

describe('addToProject', () => {
  it('posts to /api/projects/{id}/items', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({}))

    const { addToProject } = await loadApi()
    await addToProject('proj-uuid-1', 'doc-uuid-1')

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/projects/proj-uuid-1/items')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.document_id).toBe('doc-uuid-1')
  })
})

describe('getProjectSuggestions', () => {
  it('fetches /api/projects/{id}/suggestions', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse([makeServerDoc()]))

    const { getProjectSuggestions } = await loadApi()
    const docs = await getProjectSuggestions('proj-uuid-1')

    expect(mockFetch.mock.calls[0][0]).toBe('/api/projects/proj-uuid-1/suggestions')
    expect(docs).toHaveLength(1)
  })
})

describe('ingestText with options', () => {
  it('passes source_type and other options in body', async () => {
    const serverResponse = {
      document: makeServerDoc({ source_type: 'dialogue' }),
      chunk_count: 1,
      token_count: 50,
    }
    mockFetch.mockReturnValueOnce(mockJsonResponse(serverResponse))

    const { ingestText } = await loadApi()
    await ingestText('My dialogue text', ['learning'], { source_type: 'dialogue' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.source_type).toBe('dialogue')
  })

  it('passes source_url when provided', async () => {
    const serverResponse = {
      document: makeServerDoc({ source_type: 'paste', source_url: 'https://blog.example.com/post' }),
      chunk_count: 1,
      token_count: 50,
    }
    mockFetch.mockReturnValueOnce(mockJsonResponse(serverResponse))

    const { ingestText } = await loadApi()
    await ingestText('Quote from article', ['rag'], {
      source_type: 'paste',
      source_url: 'https://blog.example.com/post',
      user_note: 'Great insight about chunking',
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.source_url).toBe('https://blog.example.com/post')
    expect(body.user_note).toBe('Great insight about chunking')
  })
})

describe('updateProject', () => {
  it('patches /api/projects/{id}', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse(makeServerProject({ notes: 'updated' })))

    const { updateProject } = await loadApi()
    await updateProject('proj-uuid-1', { notes: 'updated' })

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/projects/proj-uuid-1')
    expect(opts.method).toBe('PATCH')
    const body = JSON.parse(opts.body)
    expect(body.notes).toBe('updated')
  })
})

describe('removeFromProject', () => {
  it('deletes /api/projects/{projectId}/items/{docId}', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ status: 'ok' }))

    const { removeFromProject } = await loadApi()
    await removeFromProject('proj-uuid-1', 'doc-uuid-1')

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/projects/proj-uuid-1/items/doc-uuid-1')
    expect(opts.method).toBe('DELETE')
  })
})

describe('fetchConversation', () => {
  it('posts to /api/ingest/conversation/preview and maps roles', async () => {
    const serverResponse = {
      platform: 'claude',
      title: 'Test chat',
      message_count: 2,
      messages: [
        { role: 'human', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ],
    }
    mockFetch.mockReturnValueOnce(mockJsonResponse(serverResponse))

    const { fetchConversation } = await loadApi()
    const result = await fetchConversation('https://claude.ai/share/abc')

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/ingest/conversation/preview')
    expect(opts.method).toBe('POST')
    expect(result.platform).toBe('claude')
    expect(result.messages[1].role).toBe('ai')
  })
})

describe('fetchJson error handling', () => {
  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ detail: 'Not found' }, 404))

    const { getDocument } = await loadApi()
    await expect(getDocument('nonexistent')).rejects.toThrow('API 404')
  })
})

describe('chat', () => {
  it('still returns mock data', async () => {
    const { chat } = await loadApi()
    const msg = await chat('hello', [])

    // Should NOT have called fetch — chat is still mocked
    expect(mockFetch).not.toHaveBeenCalled()
    expect(msg.role).toBe('ai')
  })
})
