import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage, QueryResult } from '@/lib/types'
import { query } from '@/lib/api'
import { useWebLLM } from '@/hooks/useWebLLM'
import { useAutoResize } from '@/hooks/useAutoResize'
import styles from './ChatView.module.css'

function SourceBadge({ type }: { type: string }) {
  return <span className={styles.sourceType}>{type}</span>
}

function SourceCitations({ sources }: { sources: NonNullable<ChatMessage['sources']> }) {
  return (
    <div className={styles.sources}>
      <div className={styles.sourcesLabel}>
        grounded in {sources.length} source{sources.length !== 1 ? 's' : ''} from your corpus
      </div>
      {sources.map((source, i) => (
        <div key={source.document.id} className={styles.sourceItem}>
          <span className={styles.sourceNum}>{i + 1}</span>
          <div className={styles.sourceDetail}>
            <div className={styles.sourceTitle}>{source.document.title}</div>
            <div className={styles.sourceMeta}>
              <SourceBadge type={source.document.type} />
              {source.document.source ? ` · ${source.document.source}` : ''}
              {' · '}
              {source.document.createdAt}
            </div>
            <div className={styles.sourceActions}>
              <button className={styles.sourceAction}>view</button>
              <button className={styles.sourceAction}>+ project</button>
            </div>
          </div>
        </div>
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
  return (
    <div className={styles.msg}>
      <div className={styles.msgAi}>
        <div className={`${styles.msgLabel} ${styles.msgLabelAi}`}>
          notebook <span className={styles.modelName}>· {modelName}</span>
        </div>
        <div className={styles.msgTextAi}>{content}</div>
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

  return (
    <div className={styles.loadBanner}>
      <div className={styles.loadText}>Load the on-device model to start chatting with your corpus.</div>
      <button className={styles.loadBtn} onClick={onLoad}>load model</button>
    </div>
  )
}

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<'idle' | 'retrieving' | 'generating'>('idle')
  const messagesRef = useRef<HTMLDivElement>(null)
  const { ref: textareaRef, resize } = useAutoResize()
  const { loadModel, generate, isReady, isLoading, loadProgress, loadStatus, error, modelName, webgpuSupported } = useWebLLM()

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

    // Phase 1: Retrieve relevant chunks from server
    setPhase('retrieving')
    let results: QueryResult[] = []
    try {
      results = await query(text, { limit: 5 })
    } catch {
      // If retrieval fails, generate without context
    }

    // Phase 2: Generate response from retrieved chunks
    setPhase('generating')

    const chunks = results.map((r) => r.highlights[0] || r.document.excerpt)
    const sources = results.map((r) => r)

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
      for await (const token of generate(text, chunks, history)) {
        fullContent += token
        setMessages((prev) =>
          prev.map((m) => m.id === aiMsgId ? { ...m, content: fullContent } : m)
        )
      }
    } catch (err) {
      fullContent = fullContent || `Error generating response: ${err instanceof Error ? err.message : 'unknown error'}`
      setMessages((prev) =>
        prev.map((m) => m.id === aiMsgId ? { ...m, content: fullContent } : m)
      )
    }

    setPhase('idle')
  }, [input, phase, isReady, messages, generate, resize])

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
        {phase === 'retrieving' && <TypingIndicator text="searching your corpus..." />}
        {phase === 'generating' && <TypingIndicator text="generating response..." />}
      </div>

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
