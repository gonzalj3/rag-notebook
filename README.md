# RAG Notebook

A personal RAG-powered knowledge system for capturing, connecting, and retrieving everything I learn as I become an AI Engineer and founder. Articles, handwritten notes, tweets, LLM conversations, book passages, and typed reflections — all ingested, embedded, and queryable from browser and iPhone. All local models, no paid APIs.

## Why This Exists

Two purposes, intertwined:

**A tool I actually use.** Every article I read about context engineering, every blog post from Hamel Husain or Karpathy, every note I take about KV cache optimization or eval frameworks — it all feeds the system. My learning becomes the evolving corpus. The query patterns are genuinely complex: "what did that article say about prefix caching that relates to my notes on multi-fighter inference in TCF?" That's multi-hop retrieval across external articles and my own notes with real semantic complexity.

**A portfolio piece that demonstrates real AI engineering.** This project closes specific gaps: no deployed RAG system, no public vector database experience, no live ML/AI application, no eval pipeline. Building a tool I depend on for my own professional development means I can talk about real usage, real failure modes, and real iterations in an interview — not a tutorial demo.

## First Principles

Every design decision in this project traces back to fundamental truths about how humans interact with information. Not "what do apps look like" — but what do we actually know about human cognition, attention, and learning.

### Limited Working Memory
Humans hold roughly 4-7 items in active working memory. Any interface that asks you to hold context across multiple panels, tabs, or scroll positions is fighting biology. When the system retrieves sources, it surfaces the minimum needed and lets you pull more on demand.

### Attention is Depletable
Attention degrades gradually. Every animation, notification badge, unnecessary color variation, layout shift costs attention even if you don't consciously notice. For a learning tool, this is existential — if the interface drains your cognitive budget, you have less left for actual learning.

### Recognition Over Recall
Humans are dramatically better at recognizing something than pulling it from memory unprompted. Search alone isn't enough — if you can't remember the right keywords, you can't find it. The system must surface things you didn't explicitly ask for. "You read something related to this three weeks ago" is more valuable than waiting for you to search.

### Learning Through Connection, Not Collection
Knowledge isn't a pile of facts — it's a network of relationships. You don't learn something until you connect it to things you already know. The system should be an active thinking partner, not a filing cabinet. "This article's argument about context windows contradicts your note from February" — that's where value lives.

### Desirable Difficulty
Certain kinds of friction — actively retrieving information, reformulating questions, making connections yourself — strengthen learning. A tool that instantly gives the perfect answer may feel productive but teaches nothing. The design adds friction intentionally where it deepens learning, and removes it ruthlessly where it's just tedium.

### Context Switching is Catastrophic
Leaving the tool to find an article, copy a URL, switch back, paste it — that's not a small inconvenience. Research shows 15-25 minutes to fully re-engage with deep work after an interruption. Capture must be so seamless it never breaks flow state.

## Six Ingestion Modes

Each mode corresponds to a distinct cognitive state. The interface responds differently to each — not with different complexity, but with different tempo.

### Browsing — Fast Capture
**Cognitive state:** High stimulation, low depth, rapid context switching. You're scrolling Twitter, reading a feed, grabbing things that catch your eye.
**Tempo:** Ruthlessly fast. Capture and get back to what you were doing.
**Design:** Single unified input that accepts text, URLs, or notes. Optional source URL and personal note fields expand on demand. A tweet capture bundles the text + URL + your reaction in one atomic action. Auto-tags on capture — you never tag manually. The ripple animation on capture is brief, satisfying, then nothing.

### Thinking — Handwritten Notes via Camera + OCR
**Cognitive state:** Slow, deliberate, already synthesizing. The act of handwriting forced you to compress and reformulate — the deep encoding already happened.
**Tempo:** Contemplative. The system receives your note quietly. No pop-ups, no fiddling.
**Design:** Camera-first view. One tap to photograph, a scan animation gives OCR a moment to work, then a review state: your photograph preserved on top (the richer artifact — your handwriting triggers visual memory), extracted text below (editable if OCR erred). One connection surfaced from your corpus. Optional reflection. Two taps on the happy path: photograph → save.

### Curation — URL Scraping
**Cognitive state:** You've judged something valuable but haven't deeply engaged yet. An intermediate state between reactive browsing and deliberate study.
**Tempo:** Moderate. You can afford a few more seconds because you're making a deliberate save decision.
**Design:** Paste a URL → system fetches and builds a rich preview card (title, source, reading time, excerpt, projected chunks). "Why are you saving this?" intent field — optional, but your intent is metadata no embedding model can infer. Read/unread toggle creates a natural reading queue.

### Dialogue — Typed Writing Sessions
**Cognitive state:** The most active form of digital writing. Generative — you're producing new thought, synthesizing, arguing with yourself, connecting dots.
**Tempo:** The writing is the interface. Almost nothing else on screen.
**Design:** Clean writing surface, continuous autosave, no save button. As you write, the system silently queries your corpus and surfaces "resonances" — related items from your learning history — in a peripheral panel below. Not suggestions, not autocomplete — echoes. You decide if they're relevant. Session dividers with timestamps mark where you put this down and picked it back up. Triple-Enter or an "end session" button to close. 15-minute inactivity auto-close as fallback.

### Study — Book Pages and Physical Articles
**Cognitive state:** Engaged with physical material, probably underlining and annotating. You're consuming someone else's thought.
**Tempo:** Slower than thinking mode. You're studying.
**Design:** Source attribution first — select or create a book/paper source before photographing. Batch capture — photograph page after page, review later. The centerpiece: a "what's your takeaway?" field. The generation effect — producing your own version of the idea — is where learning happens. Connections surface only after you've written your takeaway, not before. The system stores both the source text and your interpretation as distinct artifacts.

### Conversation — LLM Chat Imports (On Hold)
**Cognitive state:** You're preserving a collaborative thinking artifact — your questions and an AI's responses forming a line of reasoning together.
**Tempo:** Moderate. Review and annotate.
**Design:** Paste a claude.ai/share or chatgpt.com/share URL → system fetches and renders the conversation as a scrollable transcript. Platform auto-detected (Claude purple, ChatGPT blue). Click any message to highlight it — highlighted exchanges get higher embedding weight. "What did this conversation clarify?" reflection field. Chunked by exchange pairs (human Q + AI response as natural semantic units).
**Status:** On hold. Share pages are behind Cloudflare Turnstile challenges that block automated fetching. Nice-to-have feature — the core RAG showcase works without it. Implementation work is on the `feature/conversation-import` branch.

## Four Retrieval Modes

Retrieval isn't one thing — it's four distinct cognitive activities that share the same corpus and flow into each other.

### Search — Finding
You know something exists. You need to locate it fast. Type keywords, get ranked results with relevance scores, highlighted matches, source type badges, and dates. Filter by content type. Every result has action buttons: "discuss" opens it in Chat, "add to project" sends it to Projects, "copy link" for sharing. Speed and precision — friction here is pure waste.

### Chat — Dialoguing
You want to develop an understanding, not find a fact. Conversational interface where every response is grounded in your corpus via on-device LLM. Every AI response shows source citations — which articles, notes, handwritten insights it drew from. The system helps you discover connections rather than handing you conclusions.

### Projects — Aggregating
You're assembling materials around a theme — a blog post, a project, a presentation. Items from across your corpus pulled into focused collections. Each project has a progress status (collecting → drafting → building), notes space, and suggested items from your corpus you haven't added yet. Flows into Chat ("discuss this project") or Compose ("start composing").

### Compose — Research Board
Not a ghostwriter. A research board that pulls exact quotes from your corpus organized around a topic. Every quote shows the exact text in quotation marks with source attribution and date. Below the quotes: LLM-generated writing prompts — questions designed to help you start writing, not to write for you. You can remove questions or generate fresh ones. The actual writing happens in Dialogue mode or outside the app.

## Architecture

```
CLIENT (browser + iPhone)              SERVER (local first, deploy later)
┌────────────────────────┐             ┌──────────────────────────┐
│  Web: Vite + React     │             │  FastAPI                 │
│  iOS: SwiftUI          │             │                          │
│                        │  REST API   │  /ingest  — chunk, embed │
│  On-device LLM         │◄──────────►│  /query   — hybrid search│
│  (testing Qwen3.5-2B   │             │  /scrape  — fetch URLs   │
│   and Gemma 4 E2B)     │             │  /ocr     — Tesseract    │
│                        │             │                          │
│  Browser: WebLLM       │             │  PostgreSQL + pgvector   │
│  iPhone: llama.cpp     │             │  BGE-M3 embeddings (CPU) │
└────────────────────────┘             │  BM25 via tsvector       │
                                       └──────────────────────────┘
```

**Server does:** embedding, storage, retrieval, scraping, OCR. No LLM.
**Client does:** all generation using retrieved chunks as context. Free compute.

## Tech Stack

- **Server:** FastAPI, PostgreSQL + pgvector, BGE-M3 (sentence-transformers, CPU), Tesseract OCR
- **Browser LLM:** WebLLM (WebGPU) — testing Qwen3.5-2B Q4 and Gemma 4 E2B
- **iPhone LLM:** llama.cpp Swift bindings or LiteRT — same two models
- **Embedding:** BGE-M3 (MIT license, self-hosted, CPU, hybrid dense+sparse)
- **Retrieval:** pgvector cosine similarity + PostgreSQL tsvector BM25 + RRF fusion

## Constraints

- All models local. No paid API calls. Ever.
- Server: CPU only, no GPU. Runs locally on laptop first, deploy to hosting later.
- On-device context limit: keep under 8K tokens (3-5 chunks + system prompt + history).
- Single user. No multi-tenancy.
- OCR starts with Tesseract. Test vision models for handwriting later (also local).

## Model Testing

Both Qwen3.5-2B and Gemma 4 E2B are tested across:
- Browser inference speed (WebLLM)
- iPhone inference speed (llama.cpp / LiteRT)
- RAG generation quality (faithfulness to retrieved chunks)
- Tool calling reliability
- Memory footprint

Architecture is model-agnostic (OpenAI-compatible API everywhere). Swapping models is a config change. The eval pipeline produces the numbers to decide.
