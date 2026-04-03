import { useState, useRef, useEffect, useCallback } from 'react'
import { mockChatMessages } from '@/lib/mockData'
import type { ChatMessage } from '@/lib/types'
import { useAutoResize } from '@/hooks/useAutoResize'
import styles from './ChatView.module.css'

const MOCK_AI_RESPONSE: ChatMessage = {
  id: 'msg-mock',
  role: 'ai',
  content:
    'This is where the on-device LLM would generate a response grounded in retrieved chunks from your corpus. The server returns the most relevant chunks via hybrid search, and the local model synthesizes an answer with source attribution.',
  sources: [
    {
      document: {
        id: 'doc-mock',
        title: 'Retrieved chunk would appear here',
        type: 'note',
        content: '',
        excerpt: '',
        tags: [],
        createdAt: '2026-04-01',
      },
      score: 92.1,
      highlights: [],
    },
  ],
}

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

function TypingIndicator() {
  return (
    <div className={styles.typing}>
      <div className={styles.typingDots}>
        <div className={styles.typingDot} />
        <div className={styles.typingDot} />
        <div className={styles.typingDot} />
      </div>
      <span className={styles.typingText}>searching your corpus...</span>
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

function AiMessage({ content, sources }: { content: string; sources?: ChatMessage['sources'] }) {
  return (
    <div className={styles.msg}>
      <div className={styles.msgAi}>
        <div className={`${styles.msgLabel} ${styles.msgLabelAi}`}>
          notebook <span className={styles.modelName}>· qwen3.5-2b</span>
        </div>
        <div className={styles.msgTextAi}>{content}</div>
        {sources && sources.length > 0 && <SourceCitations sources={sources} />}
      </div>
    </div>
  )
}

export function ChatView() {
  // Route search params (documentId, projectId) available via useSearch({ from: '/retrieve/chat' })
  const [messages, setMessages] = useState<ChatMessage[]>(mockChatMessages)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const { ref: textareaRef, resize } = useAutoResize()

  const scrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text || isTyping) return

    const humanMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'human',
      content: text,
    }

    setMessages((prev) => [...prev, humanMsg])
    setInput('')
    setIsTyping(true)

    // Reset textarea height after clearing
    requestAnimationFrame(() => {
      resize()
    })

    setTimeout(() => {
      setIsTyping(false)
      const aiMsg: ChatMessage = {
        ...MOCK_AI_RESPONSE,
        id: `msg-${Date.now()}-ai`,
      }
      setMessages((prev) => [...prev, aiMsg])
    }, 1500)
  }, [input, isTyping, resize])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage]
  )

  return (
    <div className={styles.layout} data-mode="chat">
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          retrieve <em className={styles.dot}>·</em> chat
        </h1>
        <div className={styles.headerRight}>
          <span className={styles.corpusBadge}>247 items</span>
          <span className={styles.modelBadge}>qwen3.5-2b · on-device</span>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messages} ref={messagesRef}>
        {messages.map((msg) =>
          msg.role === 'human' ? (
            <HumanMessage key={msg.id} content={msg.content} />
          ) : (
            <AiMessage key={msg.id} content={msg.content} sources={msg.sources} />
          )
        )}
        {isTyping && <TypingIndicator />}
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <div className={styles.inputCard}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder="ask your notebook anything..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              resize()
            }}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <div className={styles.inputBar}>
            <span className={styles.inputHint}>
              <kbd className={styles.kbd}>Enter</kbd> to send ·{' '}
              <kbd className={styles.kbd}>Shift+Enter</kbd> new line
            </span>
            <button className={styles.sendBtn} onClick={sendMessage}>
              send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
