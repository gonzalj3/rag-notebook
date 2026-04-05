import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage, QueryResult } from '@/lib/types'
import { query, getDocuments } from '@/lib/api'
import { extractUrlFromQuery, matchKnownSourceUrl } from '@/lib/queryUtils'
import { useWebLLM } from '@/hooks/useWebLLM'
import { useLlmStore } from '@/stores/llm'
import { useAutoResize } from '@/hooks/useAutoResize'
import styles from './ChatView.module.css'

const AVAILABLE_MODELS = [
  { id: 'gemma-4-E2B-it', label: 'Gemma 4 E2B' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Gemma 2 2B' },
  { id: 'Qwen3-1.7B-q4f16_1-MLC', label: 'Qwen3 1.7B' },
  { id: 'Qwen3-4B-q4f16_1-MLC', label: 'Qwen3 4B' },
] as const

/** Parse think blocks and response content separately */
function parseThinkContent(text: string): { thinking: string; response: string } {
  // Extract completed think blocks
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/)
  // Also handle unclosed think block (still streaming)
  const openThinkMatch = !thinkMatch ? text.match(/<think>([\s\S]*)$/) : null

  const thinking = thinkMatch?.[1]?.trim() || openThinkMatch?.[1]?.trim() || ''
  let response = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/g, '')
    .trimStart()

  return { thinking, response }
}

function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!content) return null

  return (
    <div className={styles.thinkBlock}>
      <button className={styles.thinkToggle} onClick={() => setExpanded(!expanded)}>
        {expanded ? '▾ hide reasoning' : '▸ show reasoning'}
      </button>
      {expanded && <div className={styles.thinkContent}>{content}</div>}
    </div>
  )
}

function SourceBadge({ type }: { type: string }) {
  return <span className={styles.sourceType}>{type}</span>
}

function SourceItem({ source, index }: { source: QueryResult; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const excerpt = source.highlights[0] || source.document.excerpt

  return (
    <div className={styles.sourceItem}>
      <span className={styles.sourceNum}>{index + 1}</span>
      <div className={styles.sourceDetail}>
        <div className={styles.sourceTitle}>
          {source.document.title || excerpt.slice(0, 60)}
        </div>
        <div className={styles.sourceMeta}>
          <SourceBadge type={source.document.type} />
          {source.document.source ? ` · ${source.document.source}` : ''}
          {' · '}
          {source.document.createdAt}
          {excerpt && (
            <span className={styles.sourceExcerpt}> — {excerpt.slice(0, 100)}{excerpt.length > 100 ? '…' : ''}</span>
          )}
        </div>
        <div className={styles.sourceActions}>
          <button className={styles.sourceAction} onClick={() => setExpanded(!expanded)}>
            {expanded ? 'collapse' : 'view'}
          </button>
          <button className={styles.sourceAction}>+ project</button>
        </div>
        {expanded && (
          <div className={styles.sourceFullContent}>{source.document.content}</div>
        )}
      </div>
    </div>
  )
}

function SourceCitations({ sources }: { sources: NonNullable<ChatMessage['sources']> }) {
  return (
    <div className={styles.sources}>
      <div className={styles.sourcesLabel}>
        grounded in {sources.length} source{sources.length !== 1 ? 's' : ''} from your corpus
      </div>
      {sources.map((source, i) => (
        <SourceItem key={source.document.id} source={source} index={i} />
      ))}
    </div>
  )
}

function TypingIndicator({ text }: { text: string }) {
  return (
    <div className={styles.typing}>
      <div className={styles.typingDots}>
        <div className={styles.typingDot} />
        <div className={styles.typingDot} />
        <div className={styles.typingDot} />
      </div>
      <span className={styles.typingText}>{text}</span>
    </div>
  )
}

function HumanMessage({ content }: { content: string }) {
  return (
    <div className={styles.msg}>
      <div className={styles.msgHuman}>
        <div className={`${styles.msgLabel} ${styles.msgLabelHuman}`}>you</div>
        <div className={styles.msgTextHuman}>{content}</div>
      </div>
    </div>
  )
}

function AiMessage({ content, sources, modelName }: { content: string; sources?: ChatMessage['sources']; modelName: string }) {
  const { thinking, response } = parseThinkContent(content)

  return (
    <div className={styles.msg}>
      <div className={styles.msgAi}>
        <div className={`${styles.msgLabel} ${styles.msgLabelAi}`}>
          notebook <span className={styles.modelName}>· {modelName}</span>
        </div>
        <ThinkingBlock content={thinking} />
        <div className={styles.msgTextAi}>{response}</div>
        {sources && sources.length > 0 && <SourceCitations sources={sources} />}
      </div>
    </div>
  )
}

function ModelLoadBanner({ onLoad, isLoading, loadProgress, loadStatus, error, webgpuSupported }: {
  onLoad: () => void
  isLoading: boolean
  loadProgress: number
  loadStatus: string
  error: string | null
  webgpuSupported: boolean
}) {
  const { modelName, setModelName } = useLlmStore()

  if (!webgpuSupported) {
    return (
      <div className={styles.loadBanner}>
        <div className={styles.loadText}>WebGPU is not supported in this browser. Chat requires a WebGPU-capable browser (Chrome 113+, Edge 113+).</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={styles.loadBanner}>
        <div className={styles.loadProgress}>
          <div className={styles.loadBar} style={{ width: `${loadProgress * 100}%` }} />
        </div>
        <div className={styles.loadText}>{loadStatus || 'Loading model...'}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.loadBanner}>
        <div className={styles.loadText} style={{ color: '#c44a4a' }}>{error}</div>
        <button className={styles.loadBtn} onClick={onLoad}>retry</button>
      </div>
    )
  }

  const isGemma4 = modelName === 'gemma-4-E2B-it'
  const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  return (
    <div className={styles.loadBanner}>
      <div className={styles.loadText}>Select a model and load it to start chatting with your corpus.</div>
      <div className={styles.modelPicker}>
        {AVAILABLE_MODELS.map((m) => (
          <button
            key={m.id}
            className={`${styles.modelOption} ${modelName === m.id ? styles.modelOptionActive : ''}`}
            onClick={() => setModelName(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {isGemma4 && isSafari && (
        <div className={styles.memoryWarning}>
          Gemma 4 needs ~2GB RAM. Safari may reload the tab if memory is tight — close other tabs if possible.
        </div>
      )}
      <button className={styles.loadBtn} onClick={onLoad}>load {AVAILABLE_MODELS.find((m) => m.id === modelName)?.label ?? 'model'}</button>
    </div>
  )
}

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<'idle' | 'retrieving' | 'generating' | 'rewriting'>('idle')
  const [corpusSummary, setCorpusSummary] = useState<string>('')
  // Tier 1: Query Rewriting — LLM rewrites follow-ups into standalone search queries before retrieval
  const [queryRewriting, setQueryRewriting] = useState(true)
  // Tier 2: Sticky Sources — previously-cited sources stay available across turns
  const [stickySources, setStickySources] = useState(true)
  // Tier 3: URL-Aware Retrieval — detect URLs/domains in queries, filter to that document only
  const [urlAware, setUrlAware] = useState(true)
  const [lastRewrittenQuery, setLastRewrittenQuery] = useState<string>('')
  const recentSourcesRef = useRef<QueryResult[]>([])
  const messagesRef = useRef<HTMLDivElement>(null)
  const { ref: textareaRef, resize } = useAutoResize()
  const { loadModel, generate, generateComplete, isReady, isLoading, loadProgress, loadStatus, error, modelName, webgpuSupported } = useWebLLM()

  // Fetch corpus summary on mount — gives the LLM awareness of what's in the collection
  useEffect(() => {
    getDocuments(undefined, 100).then((docs) => {
      const byType: Record<string, string[]> = {}
      for (const doc of docs) {
        const type = doc.type
        if (!byType[type]) byType[type] = []
        const label = doc.title || doc.excerpt.slice(0, 60)
        if (label) byType[type].push(label)
      }

      const lines: string[] = [`The user's corpus contains ${docs.length} documents:`]
      for (const [type, titles] of Object.entries(byType)) {
        lines.push(`\n${type} (${titles.length}):`)
        for (const t of titles.slice(0, 10)) {
          lines.push(`  - ${t}`)
        }
        if (titles.length > 10) lines.push(`  ... and ${titles.length - 10} more`)
      }
      setCorpusSummary(lines.join('\n'))
    }).catch(() => {})
  }, [])

  const scrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, phase, scrollToBottom])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || phase !== 'idle' || !isReady) return

    const humanMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'human',
      content: text,
    }

    setMessages((prev) => [...prev, humanMsg])
    setInput('')
    requestAnimationFrame(() => resize())

    // Tier 1: Query Rewriting — rewrite follow-ups into standalone search queries
    let searchQuery = text
    if (queryRewriting && messages.length >= 2) {
      setPhase('rewriting')
      try {
        const recentHistory = messages.slice(-4).map((m) => {
          const role = m.role === 'human' ? 'User' : 'Assistant'
          const content = m.content.replace(/<think>[\s\S]*?<\/think>/g, '').slice(0, 250)
          return `${role}: ${content}`
        }).join('\n')

        const rewritten = await generateComplete(
          'You reformulate follow-up questions into standalone search queries. Output ONLY the search query on a single line, no explanation or preamble.',
          `Given this conversation and a follow-up question, write a standalone search query that captures what the user is looking for. Include specific names, topics, and keywords from the conversation context.\n\nConversation:\n${recentHistory}\n\nFollow-up: ${text}\n\nStandalone search query:`,
        )
        // Take first non-empty line, strip quotes/markdown, fall back to original
        const firstLine = rewritten.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? ''
        const cleaned = firstLine.replace(/^["'`]|["'`]$/g, '').replace(/^(Standalone query:|Query:)\s*/i, '').trim()
        searchQuery = cleaned || text
        setLastRewrittenQuery(searchQuery)
        console.log('[query rewrite]', { original: text, rewritten: searchQuery })
      } catch (err) {
        console.warn('[query rewrite] failed, using original:', err)
        setLastRewrittenQuery('')
      }
    } else {
      setLastRewrittenQuery('')
    }

    // Tier 3: URL-Aware Retrieval — if the query references a known document
    // by URL or domain, filter retrieval to just that document
    let filterSourceUrl: string | undefined
    if (urlAware) {
      // Check both the original user message AND the rewritten query
      const candidate = extractUrlFromQuery(text) || extractUrlFromQuery(searchQuery)
      if (candidate) {
        // Match against URLs from sticky sources (recently seen) first, then corpus at large
        const knownUrls = [
          ...recentSourcesRef.current.map((r) => r.document.source).filter((u): u is string => !!u),
        ]
        const matched = matchKnownSourceUrl(candidate, knownUrls)
        if (matched) {
          filterSourceUrl = matched
          console.log('[url-aware] matched', { candidate, matched })
        }
      }
    }

    // Phase: Retrieve relevant chunks from server using (possibly rewritten) query
    setPhase('retrieving')
    let results: QueryResult[] = []
    try {
      results = await query(searchQuery, { limit: 5, sourceUrl: filterSourceUrl })
    } catch {
      // If retrieval fails, generate without context
    }

    // Deduplicate fresh results by document ID
    const seen = new Set<string>()
    let uniqueResults = results.filter((r) => {
      if (seen.has(r.document.id)) return false
      seen.add(r.document.id)
      return true
    })

    // Tier 2: Sticky Sources — merge previous turn's sources, dedupe by doc ID
    if (stickySources && recentSourcesRef.current.length > 0) {
      for (const prev of recentSourcesRef.current) {
        if (!seen.has(prev.document.id)) {
          seen.add(prev.document.id)
          uniqueResults.push(prev)
        }
      }
      // Cap at 5 total to keep LLM context manageable
      uniqueResults = uniqueResults.slice(0, 5)
    }

    // Update sticky refs for next turn
    recentSourcesRef.current = uniqueResults.slice(0, 5)

    // Phase: Generate response from retrieved chunks
    setPhase('generating')

    const chunks = uniqueResults.map((r) => r.highlights[0] || r.document.excerpt)
    const sources = uniqueResults

    // Build conversation history for context
    const history = messages
      .slice(-4)
      .map((m) => ({
        role: (m.role === 'human' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }))

    const aiMsgId = `msg-${Date.now()}-ai`
    let fullContent = ''

    // Add empty AI message that will fill with streaming tokens
    setMessages((prev) => [...prev, {
      id: aiMsgId,
      role: 'ai' as const,
      content: '',
      sources,
    }])

    try {
      for await (const token of generate(text, chunks, history, corpusSummary)) {
        fullContent += token
        setMessages((prev) =>
          prev.map((m) => m.id === aiMsgId ? { ...m, content: fullContent } : m)
        )
      }
    } catch (err) {
      const errorContent = fullContent || `Error generating response: ${err instanceof Error ? err.message : 'unknown error'}`
      setMessages((prev) =>
        prev.map((m) => m.id === aiMsgId ? { ...m, content: errorContent } : m)
      )
    }

    setPhase('idle')
  }, [input, phase, isReady, messages, generate, generateComplete, resize, corpusSummary, queryRewriting, stickySources, urlAware])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage]
  )

  const displayModelName = modelName.replace(/-MLC$/, '').replace(/-q\w+$/, '')

  return (
    <div className={styles.layout} data-mode="chat">
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          retrieve <em className={styles.dot}>·</em> chat
        </h1>
        <div className={styles.headerRight}>
          <span className={styles.modelBadge}>
            {isReady ? `${displayModelName} · on-device` : 'model not loaded'}
          </span>
        </div>
      </div>

      {/* Model load banner (shown when model isn't ready) */}
      {!isReady && (
        <ModelLoadBanner
          onLoad={loadModel}
          isLoading={isLoading}
          loadProgress={loadProgress}
          loadStatus={loadStatus}
          error={error}
          webgpuSupported={webgpuSupported}
        />
      )}

      {/* Messages */}
      <div className={styles.messages} ref={messagesRef}>
        {messages.length === 0 && isReady && (
          <div className={styles.emptyChat}>
            ask your notebook anything — responses are grounded in your corpus
          </div>
        )}
        {messages.map((msg) =>
          msg.role === 'human' ? (
            <HumanMessage key={msg.id} content={msg.content} />
          ) : (
            <AiMessage key={msg.id} content={msg.content} sources={msg.sources} modelName={displayModelName} />
          )
        )}
        {phase === 'rewriting' && <TypingIndicator text="rewriting query for context..." />}
        {phase === 'retrieving' && (
          <TypingIndicator
            text={lastRewrittenQuery ? `searching: "${lastRewrittenQuery.slice(0, 80)}${lastRewrittenQuery.length > 80 ? '…' : ''}"` : 'searching your corpus...'}
          />
        )}
        {phase === 'generating' && <TypingIndicator text="generating response..." />}
      </div>

      {/* Retrieval settings (Tier 1 + Tier 2 toggles) */}
      {isReady && (
        <div className={styles.retrievalSettings}>
          <label className={styles.settingToggle}>
            <input
              type="checkbox"
              checked={queryRewriting}
              onChange={(e) => setQueryRewriting(e.target.checked)}
            />
            <span className={styles.settingLabel}>
              <strong>Tier 1: Query Rewriting</strong>
              <span className={styles.settingDesc}>LLM rewrites follow-ups with conversation context before retrieval</span>
            </span>
          </label>
          <label className={styles.settingToggle}>
            <input
              type="checkbox"
              checked={stickySources}
              onChange={(e) => setStickySources(e.target.checked)}
            />
            <span className={styles.settingLabel}>
              <strong>Tier 2: Sticky Sources</strong>
              <span className={styles.settingDesc}>Previously-cited sources stay available across turns</span>
            </span>
          </label>
          <label className={styles.settingToggle}>
            <input
              type="checkbox"
              checked={urlAware}
              onChange={(e) => setUrlAware(e.target.checked)}
            />
            <span className={styles.settingLabel}>
              <strong>Tier 3: URL-Aware Retrieval</strong>
              <span className={styles.settingDesc}>When query mentions a URL/domain, filter to that document</span>
            </span>
          </label>
        </div>
      )}

      {/* Input */}
      <div className={styles.inputArea}>
        <div className={styles.inputCard}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder={isReady ? 'ask your notebook anything...' : 'load the model first...'}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              resize()
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={!isReady}
          />
          <div className={styles.inputBar}>
            <span className={styles.inputHint}>
              <kbd className={styles.kbd}>Enter</kbd> to send ·{' '}
              <kbd className={styles.kbd}>Shift+Enter</kbd> new line
            </span>
            <button className={styles.sendBtn} onClick={sendMessage} disabled={!isReady || phase !== 'idle'}>
              send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
