# RAG Notebook — Implementation Plan

## Overview

Three deliverables: a web client (Vite + React), a FastAPI server with PostgreSQL + pgvector, and an iOS app (SwiftUI). This plan focuses on the web client first, with server and iOS outlined for future sessions.

---

## Phase 1: Web Client (Current Focus)

### Status: Steps 1-6 Complete ✓

All foundational work is done. The web client is fully scaffolded with all 10 views converted from prototypes to React components, design system extracted, routing wired, state management in place, and mock data powering all interactions. The app runs on localhost with working navigation between all views.

**What's built:**
- Vite + React 19 + TypeScript project scaffold
- Unified design token system (`tokens.css`) with light/dark themes and per-mode color overrides
- TanStack Router with 12 routes (index + 6 capture + 4 retrieve + root layout)
- Zustand stores (theme with localStorage persistence, capture queue, LLM status)
- 8 shared UI components (ThemeToggle, Navigation, PageContainer, ModeHeader, TagRow, CaptureButton, RippleContainer, FetchIndicator)
- 4 custom hooks (useAutoResize, useAutoTags, useAutoSave, useSessionTimer)
- Typed API client with mock data for all endpoints
- All 10 view conversions matching HTML prototypes
- Landing page dashboard with mode cards

**What's next:**
- Step 7: WebLLM integration (on-device LLM for Chat and Compose views)
- Step 8: PWA support (service worker, offline access, add to home screen)
- Connect to real FastAPI server when Phase 2 is built

### Starting Point

Ten HTML prototypes exist in `/prototypes/` (moved from project root). These are single-file static prototypes with all CSS and JS inline. They represent the complete UI design for both ingestion and retrieval:

**Ingestion views:**
- `rag-notes-browsing-capture.html` — unified paste/URL/note capture with auto-tags
- `rag-notes-thinking-capture.html` — camera + OCR for handwritten notes
- `rag-notes-curation-capture.html` — URL scraping with rich preview cards
- `rag-notes-dialogue-capture.html` — writing sessions with resonances and session dividers
- `rag-notes-study-capture.html` — batch book page capture with takeaway prompts
- `rag-notes-conversation-capture.html` — LLM chat import from claude.ai/chatgpt.com share links

**Retrieval views:**
- `rag-notebook-retrieve-search.html` — search with filters, relevance scores, action buttons
- `rag-notebook-retrieve-chat.html` — conversational RAG with source citations
- `rag-notebook-retrieve-projects.html` — project workspaces for aggregating materials
- `rag-notebook-retrieve-compose.html` — research board with exact quotes and writing prompts

### Step 1: Project Scaffold ✓

Set up a Vite + React project with TypeScript, TanStack Router, and CSS Modules.

```
rag-notebook/
├── src/
│   ├── main.tsx                # entry point, router mount
│   ├── App.tsx                 # root layout, theme provider
│   ├── routes/
│   │   ├── __root.tsx          # TanStack root route (layout, nav, theme toggle)
│   │   ├── index.tsx           # landing / dashboard
│   │   ├── capture/
│   │   │   ├── browsing.tsx
│   │   │   ├── thinking.tsx
│   │   │   ├── curation.tsx
│   │   │   ├── dialogue.tsx
│   │   │   ├── study.tsx
│   │   │   └── conversation.tsx
│   │   └── retrieve/
│   │       ├── search.tsx
│   │       ├── chat.tsx
│   │       ├── projects.tsx
│   │       └── compose.tsx
│   ├── components/
│   │   ├── ui/                 # shared primitives (buttons, inputs, cards)
│   │   ├── capture/            # ingestion-specific components
│   │   ├── retrieve/           # retrieval-specific components
│   │   ├── ThemeToggle.tsx
│   │   └── Navigation.tsx
│   ├── lib/
│   │   ├── api.ts              # server API client (typed fetch wrappers for /ingest, /query, etc.)
│   │   ├── llm.ts              # WebLLM integration
│   │   └── types.ts            # shared TypeScript types
│   ├── hooks/
│   │   ├── useAutoSave.ts
│   │   ├── useAutoTags.ts
│   │   └── useWebLLM.ts
│   ├── stores/
│   │   ├── theme.ts            # Zustand store: light/dark theme
│   │   ├── capture.ts          # Zustand store: recent captures, processing queue
│   │   └── llm.ts              # Zustand store: model loading status, active model
│   ├── styles/
│   │   ├── tokens.css          # CSS custom properties (design tokens extracted from prototypes)
│   │   ├── global.css          # base styles, font-face, transitions
│   │   └── modules/            # per-component CSS Modules
│   └── assets/
├── prototypes/                 # move HTML files here for reference
├── public/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

**Key decisions:**
- **Vite** as build tool. No server rendering needed, app is client-side with a separate FastAPI backend
- **TanStack Router** for type-safe routing. Cross-view actions (Search → Chat with document context) get typed route params and search params out of the box
- **CSS Modules + CSS custom properties** for styling. The prototypes already define the design system in vanilla CSS with per-mode color palettes. Preserving this directly avoids a Tailwind translation layer
- **Zustand** for cross-view state (theme, model status, capture queue, active project). ~1KB, no provider nesting
- **Plain fetch** with a typed wrapper for API calls. No HTTP library dependency for 5-6 FastAPI endpoints
- Fonts: IBM Plex Mono (UI), Newsreader (headers), Lora (body text in dialogue/study modes) — self-hosted via Fontsource packages
- Theme: light default, dark toggle. Respect system preference, persist to localStorage
- No component library. The prototypes have a specific aesthetic — warm off-whites, muted borders, serif accents — that won't come from a library

### Step 2: Design System Extraction ✓

Extract the shared design tokens and patterns from the HTML prototypes into a unified system:

**Color tokens (from prototypes):**
```
Light:
  --bg: #f8f7f4 to #f4f1eb (warm off-whites, varies by mode)
  --surface: #ffffff
  --border: #dddad3
  --text-primary: #2c2a26
  --text-secondary: #5c5850
  --text-muted: #9b9588
  --accent: #7c5cbf (purple — system actions)
  --success: #3a9a6e
  --connection: #b08840 (amber — resonances, connections)
  --resonance: #6a8a5a (green — dialogue resonances)
  --project: #2e7d5b (green — projects)
  --compose: #8b4513 (warm brown — compose)

Dark:
  --bg: #0e0f11
  --surface: #16171b
  --accent: #a78bfa
  (and corresponding shifts for all semantic colors)
```

**Shared patterns across all prototypes:**
- Container max-width: 560-700px centered
- Border radius: 10px (standard), 14px (large cards)
- Shadow scale: sm (subtle), md (hover), lg (elevated)
- Font weights: 300 (default body), 400 (emphasis), 500 (headings)
- Theme toggle: fixed top-right, 40px circle, moon/sun icons
- Transitions: 350ms ease on theme changes, 200ms on interactions
- Auto-tag chips: pill-shaped, accent-colored, appear with stagger animation

### Step 3: Convert Ingestion Views ✓

All six ingestion views converted from HTML prototypes to React components with CSS Modules.

**3a. Browsing Capture** (`rag-notes-browsing-capture.html`)
- Unified input (textarea) with URL auto-detection
- Expandable source URL and note fields (toggle buttons)
- Auto-tag generation on capture (client-side keyword classifier as placeholder, server API call in production)
- Recently captured list with processing status indicators
- Ripple animation on capture confirmation

**3b. Curation Capture** (`rag-notes-curation-capture.html`)
- URL input with auto-fetch on paste/Enter
- Three-stage fetch indicator (fetching → extracting → estimating chunks)
- Rich preview card: title, domain, reading time, excerpt, chunk/token counts
- "Why are you saving this?" intent field
- Read/unread toggle
- Reading queue at bottom

**3c. Dialogue Capture** (`rag-notes-dialogue-capture.html`)
- Contenteditable writing surface (not textarea — needs rich cursor behavior)
- Continuous autosave with status indicator (saving… → saved)
- Word count and session timer in header
- Resonance panel below writing: surfaces related corpus items as you type (simulated initially, server API in production)
- Session dividers with date/duration/word count
- Session close: triple-Enter, "end session" button below editor, Cmd+., 15-min inactivity auto-close
- Previous sessions visible above current editor

**3d. Thinking Capture** (`rag-notes-thinking-capture.html`)
- Camera/file input (full-bleed viewfinder aesthetic)
- Three states: camera → scanning (animated scan line) → review
- Review state: photograph on top, OCR text below (editable), one connection from corpus, optional reflection, auto-tags
- Two-tap happy path: photograph → save

**3e. Study Capture** (`rag-notes-study-capture.html`)
- Source selector (existing sources as chips, or create new)
- Batch camera capture with thumbnail strip
- Page navigation (prev/next) in review
- OCR extraction per page
- "Your takeaway" field (amber card — the desirable difficulty)
- Connections surface only after takeaway is written
- Save confirmation shows "3 pages + takeaway"

**3f. Conversation Capture** (`rag-notes-conversation-capture.html`) — **ON HOLD**
- URL input supporting claude.ai/share/ and chatgpt.com/share/ formats
- Platform auto-detection with styled badges
- Scrollable conversation transcript with human/AI message styling
- Click-to-highlight on messages (gold highlight, counter in metadata)
- "What did this conversation clarify?" reflection field
- Saved conversations list with platform, title, exchange count, highlights
- **Status:** Parked on `feature/conversation-import` branch. Cloudflare Turnstile blocks headless browser fetching of share pages. Nice-to-have feature, not core to the RAG showcase. Will revisit when WebLLM fallback (Phase B) is ready or if share page access improves.

### Step 4: Convert Retrieval Views ✓

**4a. Search** (`rag-notebook-retrieve-search.html`)
- Search input with instant results
- Content type filter chips (all, articles, notes, handwritten, conversations, dialogue, takeaways)
- Result cards: relevance percentage, highlighted matches, source type badge, date, tags
- Action buttons on hover: discuss (→ Chat), add to project (→ Projects), copy link, view full
- Result count and search stats

**4b. Chat** (`rag-notebook-retrieve-chat.html`)
- Chat input fixed at bottom
- Message thread with human/AI messages
- AI messages include collapsible source citations panel (source type badge, title, date, "view" and "+ project" actions)
- Model badge (e.g. "qwen3.5-2b · on-device")
- Session-aware (new conversation vs. continue)

**4c. Projects** (`rag-notebook-retrieve-projects.html`)
- Two states: project list and project detail
- Project cards: icon, name, description, item counts, tags, progress bar (collecting → drafting → building)
- Detail view: items organized by type, project notes textarea, "suggested from corpus" section
- Actions: "discuss this project" (→ Chat), "start composing" (→ Compose)
- New project creation

**4d. Compose** (`rag-notebook-retrieve-compose.html`)
- Topic input
- "Pull quotes from corpus" button
- Quote cards: exact text in quotation marks, source type badge, source name, date, dismiss button
- Writing prompts section: LLM-generated questions with context, dismiss individual, "new questions" button

### Step 5: Navigation and Layout ✓

Navigation bar with capture/retrieve groups, cross-view links with typed search params, and a landing page dashboard with mode cards.

- Top-level nav: **Capture** and **Retrieve** (the two fundamental activities)
- Capture sub-nav: icons/labels for the six modes (browsing, thinking, curation, dialogue, study, conversation)
- Retrieve sub-nav: icons/labels for the four modes (search, chat, projects, compose)
- Cross-view actions: "discuss" in Search opens Chat, "add to project" opens Projects, etc. TanStack Router's typed search params carry context between views

### Step 6: API Client Layer ✓

Typed fetch wrappers with mock data for all endpoints. Ready to swap in real FastAPI calls when the server exists.

```typescript
// lib/api.ts
interface ApiClient {
  // Ingestion
  ingestText(content: string, sourceType: string, metadata?: IngestMetadata): Promise<Document>
  ingestUrl(url: string, intent?: string): Promise<Document>
  ingestImage(image: File, sourceType: 'handwritten' | 'book_page', source?: string): Promise<Document>
  ingestConversation(shareUrl: string, highlights?: number[]): Promise<Document>

  // Retrieval
  query(text: string, filters?: QueryFilters): Promise<QueryResult[]>
  getDocument(id: string): Promise<Document>

  // Projects
  createProject(name: string, description: string): Promise<Project>
  addToProject(projectId: string, documentId: string): Promise<void>
  getProjectSuggestions(projectId: string): Promise<QueryResult[]>
}
```

### Step 7: WebLLM Integration

Integrate WebLLM for on-device generation in the Chat retrieval view and the writing prompts in Compose.

```typescript
// hooks/useWebLLM.ts
// Load Qwen3.5-2B Q4 or Gemma 4 E2B via WebLLM
// Provide: generate(prompt, chunks) → stream of tokens
// Chat view: user query + retrieved chunks → grounded response
// Compose view: topic + quotes → writing prompt questions
```

**Key considerations:**
- Model download on first use (~1.5-2GB). Show progress, cache in IndexedDB
- WebGPU required — detect and show fallback message for unsupported browsers
- Keep context under 8K tokens: system prompt (~200) + chunks (3-5 × ~600) + history (~1000) + generation
- Test both Qwen3.5-2B and Gemma 4 E2B. Make model selectable in settings

### Step 8: PWA Support

- `vite-plugin-pwa` for service worker generation and offline access
- Web app manifest for "add to home screen"
- Cache strategy: network-first for API calls, cache-first for static assets

---

## Phase 2: Server (Future Session)

Outlined here for context. Not to be implemented yet.

### FastAPI Application

```
server/
├── app/
│   ├── main.py                 # FastAPI app, CORS, routes
│   ├── routes/
│   │   ├── ingest.py           # POST /ingest
│   │   ├── query.py            # POST /query
│   │   ├── scrape.py           # POST /scrape
│   │   └── ocr.py              # POST /ocr
│   ├── services/
│   │   ├── chunker.py          # chunking engine routed by source_type
│   │   ├── embedder.py         # BGE-M3 embedding (sentence-transformers)
│   │   ├── retriever.py        # hybrid search: pgvector + BM25 + RRF
│   │   ├── scraper.py          # httpx + trafilatura
│   │   └── ocr.py              # Tesseract wrapper
│   ├── models/
│   │   └── schemas.py          # Pydantic models
│   └── db/
│       ├── database.py         # async SQLAlchemy + pgvector
│       └── migrations/         # Alembic
├── requirements.txt
└── Dockerfile
```

### Database Schema

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  source_type VARCHAR(20) NOT NULL,
  source_url TEXT,
  source_title TEXT,
  user_note TEXT,
  image_path TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  content TEXT NOT NULL,
  chunk_index INT,
  token_count INT,
  embedding VECTOR(1024),
  tsv TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tags (id SERIAL PRIMARY KEY, name VARCHAR(50) UNIQUE);
CREATE TABLE document_tags (document_id UUID REFERENCES documents(id), tag_id INT REFERENCES tags(id));

CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON chunks USING gin (tsv);
```

### Chunking Strategy

| source_type | Strategy |
|-------------|----------|
| url (scraped article) | Recursive 512-token split, 10% overlap |
| paste (tweet, snippet) | Single chunk |
| note (quick thought) | Single chunk |
| handwritten (OCR'd note) | Single chunk |
| book_page (study mode) | Page-level chunk |
| conversation (LLM chat) | Exchange-pair chunks (human Q + AI response) |
| dialogue (writing session) | Paragraph-level split |
| takeaway (user reflection) | Single chunk, tagged as interpretation |

### Hybrid Retrieval

```
User query → pgvector cosine (top 20) + BM25 tsvector (top 20) → RRF fusion → top 5 chunks → return to client
```

### Server Build Order
1. FastAPI project with /ingest and /query endpoints
2. PostgreSQL + pgvector schema
3. BGE-M3 embedding on ingest (CPU)
4. BM25 tsvector generation on ingest
5. Hybrid retrieval: vector + BM25 + RRF
6. URL scraping pipeline (httpx + trafilatura)
7. Chunking engine with routing by source_type
8. Auto-tagging (keyword dictionary)
9. OCR pipeline (Tesseract)
10. ~~Conversation parser (fetch share link HTML → parse turns)~~ — ON HOLD (see `feature/conversation-import` branch)
11. Batch image ingestion for study mode

---

## Phase 3: iOS App (Future Session)

Outlined here for context. Not to be implemented yet.

- SwiftUI app
- llama.cpp Swift bindings for on-device generation (test both Qwen3.5-2B and Gemma 4 E2B)
- Camera integration for thinking/study modes
- Share sheet extension for capturing from any app
- Same API client as web (OpenAPI spec generated from FastAPI)

---

## Phase 4: Eval Pipeline (Future Session)

1. Generate synthetic eval dataset (questions per document)
2. Measure Recall@k, Precision@k, MRR on retrieval
3. Measure faithfulness + relevancy on generation (RAGAS)
4. Thumbs up/down feedback loop in query UI
5. Model comparison: same eval set on Qwen3.5-2B vs Gemma 4 E2B

---

## Phase 5: Resonance Engine (Future Session)

1. As user writes in dialogue mode, periodically query corpus for related chunks
2. Surface 1-2 resonances below writing area
3. Track what's been surfaced recently (spaced retrieval)

---

## Constraints

- All models local. No paid API calls. Ever.
- Server: CPU only, no GPU. Runs locally on laptop first, deploy to hosting later.
- On-device context limit: keep under 8K tokens.
- Single user. No multi-tenancy.
