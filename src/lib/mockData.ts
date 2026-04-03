import type { Document, Project, QueryResult, ChatMessage } from './types'

export const mockDocuments: Document[] = [
  {
    id: 'doc-1',
    title: 'RAG Architecture Patterns for Production Systems',
    type: 'url',
    content: 'Comprehensive guide to RAG architecture patterns including naive RAG, advanced RAG with reranking, and modular RAG systems.',
    excerpt: 'The key insight is that naive RAG fails in production because it treats all chunks equally. Advanced RAG introduces a reranking step...',
    source: 'https://example.com/rag-patterns',
    tags: ['rag', 'infra'],
    createdAt: '2026-03-28',
  },
  {
    id: 'doc-2',
    title: 'Why embeddings are not enough for semantic search',
    type: 'note',
    content: 'Notes on the limitations of pure embedding-based search and why hybrid approaches work better.',
    excerpt: 'Pure vector similarity misses lexical matches. BM25 + embeddings in a hybrid approach covers both semantic and keyword...',
    tags: ['rag', 'learning'],
    createdAt: '2026-03-27',
  },
  {
    id: 'doc-3',
    title: 'Handwritten notes on transformer attention',
    type: 'handwritten',
    content: 'OCR text from handwritten notes about multi-head attention mechanisms.',
    excerpt: 'Q, K, V projections allow the model to attend to different representation subspaces at different positions...',
    tags: ['llm', 'learning'],
    createdAt: '2026-03-25',
  },
  {
    id: 'doc-4',
    title: 'Claude conversation: debugging pgvector indexing',
    type: 'conversation',
    content: 'Conversation about HNSW vs IVFFlat indexing strategies for pgvector.',
    excerpt: 'For your corpus size (under 100k documents), HNSW with ef_construction=128 and m=16 will give you the best recall...',
    source: 'claude.ai',
    tags: ['rag', 'infra'],
    createdAt: '2026-03-24',
  },
  {
    id: 'doc-5',
    title: 'Dialogue: connecting RAG to personal knowledge management',
    type: 'dialogue',
    content: 'Reflective writing session about how RAG systems can serve as an extension of working memory.',
    excerpt: 'The real value isn\'t in storing everything, it\'s in surfacing the right connection at the right moment...',
    tags: ['rag', 'learning'],
    createdAt: '2026-03-23',
  },
  {
    id: 'doc-6',
    title: 'Building AI-Powered Applications — Chapter 3',
    type: 'book_page',
    content: 'Study notes from chapter on evaluation pipelines for LLM applications.',
    excerpt: 'Evaluation is the most neglected part of LLM application development. Without systematic evals, you are flying blind...',
    tags: ['evals', 'learning'],
    createdAt: '2026-03-22',
  },
  {
    id: 'doc-7',
    title: 'Takeaway: the right chunk size depends on the query type',
    type: 'takeaway',
    content: 'Key insight that chunk size should vary based on expected query patterns.',
    excerpt: 'Factual queries need small chunks (256 tokens). Conceptual queries need larger context (1024+ tokens). The solution is...',
    tags: ['rag'],
    createdAt: '2026-03-21',
  },
  {
    id: 'doc-8',
    title: 'BGE-M3: the embedding model that does it all',
    type: 'url',
    content: 'Article about BGE-M3 supporting dense, sparse, and multi-vector retrieval in a single model.',
    excerpt: 'BGE-M3 combines dense embeddings, lexical weights, and ColBERT-style multi-vector retrieval. This means a single model...',
    source: 'https://example.com/bge-m3',
    tags: ['rag', 'llm'],
    createdAt: '2026-03-20',
  },
  {
    id: 'doc-9',
    title: 'MCP and tool-use patterns for agentic systems',
    type: 'paste',
    content: 'Collected notes on Model Context Protocol and how it enables standardized tool use.',
    excerpt: 'MCP provides a standard protocol for LLMs to interact with external tools. The key insight is that tool descriptions...',
    tags: ['agents', 'llm'],
    createdAt: '2026-03-19',
  },
  {
    id: 'doc-10',
    title: 'ChatGPT conversation: FastAPI project structure',
    type: 'conversation',
    content: 'Discussion about organizing a FastAPI project with routers, services, and repositories.',
    excerpt: 'Separate your routes (thin controllers) from your services (business logic) from your repositories (data access)...',
    source: 'chatgpt.com',
    tags: ['infra'],
    createdAt: '2026-03-18',
  },
]

export const mockSearchResults: QueryResult[] = mockDocuments.map((doc, i) => ({
  document: doc,
  score: Math.round((95 - i * 4) * 10) / 10,
  highlights: [doc.excerpt],
}))

export const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'RAG Notebook',
    description: 'Building a personal RAG-powered knowledge system',
    icon: '📓',
    tags: ['rag', 'infra'],
    items: mockDocuments.slice(0, 4),
    notes: 'Core project. Focus on getting the embedding pipeline right before building the UI.',
    progress: 35,
    createdAt: '2026-03-15',
  },
  {
    id: 'proj-2',
    name: 'LLM Evaluation Framework',
    description: 'Systematic approach to evaluating LLM outputs',
    icon: '📊',
    tags: ['evals', 'llm'],
    items: mockDocuments.slice(5, 7),
    notes: '',
    progress: 15,
    createdAt: '2026-03-20',
  },
  {
    id: 'proj-3',
    name: 'AI Engineering Curriculum',
    description: 'Structured learning path from ML basics to production AI systems',
    icon: '🎓',
    tags: ['learning', 'career'],
    items: mockDocuments.slice(2, 6),
    notes: 'Review weekly, adjust based on what is clicking.',
    progress: 50,
    createdAt: '2026-03-10',
  },
]

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'human',
    content: 'What do my notes say about chunk size for RAG?',
  },
  {
    id: 'msg-2',
    role: 'ai',
    content: 'Based on your corpus, you\'ve captured several insights about chunk size. The key takeaway is that chunk size should vary based on query type: factual queries work best with smaller chunks (around 256 tokens), while conceptual queries benefit from larger context windows (1024+ tokens). Your notes on the BGE-M3 model also suggest that using a multi-vector approach can help bridge this gap.',
    sources: [
      {
        document: mockDocuments[6],
        score: 94.2,
        highlights: ['Factual queries need small chunks (256 tokens). Conceptual queries need larger context (1024+ tokens).'],
      },
      {
        document: mockDocuments[7],
        score: 87.5,
        highlights: ['BGE-M3 combines dense embeddings, lexical weights, and ColBERT-style multi-vector retrieval.'],
      },
    ],
  },
]

export const mockConversationTranscript = [
  { role: 'human' as const, content: 'I\'m building a RAG system with pgvector. Should I use IVFFlat or HNSW indexing?' },
  { role: 'ai' as const, content: 'For your use case, HNSW is likely the better choice. Here\'s why:\n\nHNSW provides better recall at query time and doesn\'t require the training step that IVFFlat needs. The tradeoff is that HNSW indexes are larger and take longer to build, but for a personal knowledge base under 100k documents, this is negligible.' },
  { role: 'human' as const, content: 'What parameters should I use for HNSW?' },
  { role: 'ai' as const, content: 'For your corpus size, I\'d recommend:\n\n- ef_construction: 128 (controls index quality, higher = better recall but slower build)\n- m: 16 (connections per layer, 16 is a good default)\n- ef_search: 64 (at query time, higher = better recall)\n\nThese give you ~99% recall with reasonable build times.' },
]

export const mockQuotes = [
  {
    id: 'q-1',
    text: 'The real value isn\'t in storing everything, it\'s in surfacing the right connection at the right moment.',
    sourceType: 'dialogue' as const,
    sourceName: 'Dialogue session',
    date: 'Mar 23',
  },
  {
    id: 'q-2',
    text: 'Evaluation is the most neglected part of LLM application development. Without systematic evals, you are flying blind.',
    sourceType: 'book_page' as const,
    sourceName: 'Building AI-Powered Applications',
    date: 'Mar 22',
  },
  {
    id: 'q-3',
    text: 'Pure vector similarity misses lexical matches. BM25 + embeddings in a hybrid approach covers both semantic and keyword matching.',
    sourceType: 'note' as const,
    sourceName: 'Embeddings limitations',
    date: 'Mar 27',
  },
]

export const mockWritingPrompts = [
  {
    id: 'wp-1',
    question: 'How does the concept of "desirable difficulty" apply to how you\'re designing capture friction in your RAG system?',
    context: 'From your dialogue on RAG and personal knowledge management',
  },
  {
    id: 'wp-2',
    question: 'What\'s the relationship between chunk size and the kind of questions you expect to ask your corpus?',
    context: 'Based on your takeaway about query-dependent chunk sizes',
  },
]
