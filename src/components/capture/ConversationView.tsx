import { useState, useCallback, useRef, useEffect } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { ModeHeader } from '@/components/ui/ModeHeader'
import { TagRow } from '@/components/ui/TagRow'
import { CaptureButton } from '@/components/ui/CaptureButton'
import { FetchIndicator } from '@/components/ui/FetchIndicator'
import { fetchConversation } from '@/lib/api'
import { useAutoTags } from '@/hooks/useAutoTags'
import { useCaptureStore } from '@/stores/capture'
import styles from './ConversationView.module.css'

type FetchStage = 'idle' | 'fetching' | 'parsing' | 'analyzing'

const FETCH_STAGE_TEXT: Record<FetchStage, string> = {
  idle: '',
  fetching: 'fetching conversation\u2026',
  parsing: 'parsing messages\u2026',
  analyzing: 'analyzing highlights\u2026',
}

interface ConversationMessage {
  role: 'human' | 'ai'
  content: string
}

interface ConversationData {
  platform: string
  title: string
  messageCount: number
  messages: ConversationMessage[]
}

interface SavedConversation {
  id: string
  platform: 'claude' | 'chatgpt'
  title: string
  meta: string
  reflection?: string
}

function detectPlatform(url: string): 'claude' | 'chatgpt' | null {
  if (url.includes('claude')) return 'claude'
  if (url.includes('chatgpt') || url.includes('chat.openai.com')) return 'chatgpt'
  return null
}

export function ConversationView() {
  const [url, setUrl] = useState('')
  const [fetchStage, setFetchStage] = useState<FetchStage>('idle')
  const [conversation, setConversation] = useState<ConversationData | null>(null)
  const [highlightedIndices, setHighlightedIndices] = useState<Set<number>>(new Set())
  const [reflection, setReflection] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [savedConversations] = useState<SavedConversation[]>([
    {
      id: '1',
      platform: 'claude',
      title: 'RAG notebook architecture and portfolio gaps discussion',
      meta: '14 exchanges \u00b7 3 highlighted \u00b7 tagged: rag, career \u00b7 2 hours ago',
      reflection: 'The key insight was that building a tool I actually use daily tells a better portfolio story than any demo',
    },
    {
      id: '2',
      platform: 'chatgpt',
      title: 'Comparing embedding models for personal knowledge bases',
      meta: '8 exchanges \u00b7 2 highlighted \u00b7 tagged: rag, infra \u00b7 1 day ago',
      reflection: 'BGE-M3 is the practical default for self-hosted, but Voyage AI leads benchmarks',
    },
    {
      id: '3',
      platform: 'claude',
      title: 'First principles of UI design for learning tools',
      meta: '11 exchanges \u00b7 5 highlighted \u00b7 tagged: learning \u00b7 3 days ago',
    },
  ])

  const urlInputRef = useRef<HTMLInputElement>(null)
  const reflectionRef = useRef<HTMLTextAreaElement>(null)
  const { classify } = useAutoTags()
  const addCapture = useCaptureStore((s) => s.addCapture)

  const platform = detectPlatform(url)

  useEffect(() => {
    urlInputRef.current?.focus()
  }, [])

  const handleFetch = useCallback(async (inputUrl: string) => {
    const trimmed = inputUrl.trim()
    if (!trimmed || fetchStage !== 'idle') return

    setFetchStage('fetching')

    const timer1 = setTimeout(() => setFetchStage('parsing'), 500)
    const timer2 = setTimeout(() => setFetchStage('analyzing'), 1000)

    try {
      const data = await fetchConversation(trimmed)
      setConversation(data)
      setHighlightedIndices(new Set())

      const allText = data.messages.map((m) => m.content).join(' ')
      const autoTags = classify(allText)
      setTags(autoTags.length ? autoTags : [])
    } finally {
      clearTimeout(timer1)
      clearTimeout(timer2)
      setFetchStage('idle')
    }
  }, [fetchStage, classify])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleFetch(url)
    }
  }, [url, handleFetch])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim()
    if (/^https?:\/\//.test(pasted)) {
      setTimeout(() => handleFetch(pasted), 100)
    }
  }, [handleFetch])

  const toggleHighlight = useCallback((index: number) => {
    setHighlightedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const handleCapture = useCallback(async () => {
    if (!conversation) return

    addCapture({
      title: conversation.title,
      mode: 'conversation',
      status: 'processing',
    })

    await new Promise((r) => setTimeout(r, 800))

    setConversation(null)
    setUrl('')
    setReflection('')
    setTags([])
    setHighlightedIndices(new Set())
    urlInputRef.current?.focus()
  }, [conversation, addCapture])

  const handleDismissTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleAddTag = useCallback((tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev : [...prev, tag])
  }, [])

  const autoResize = useCallback((el: HTMLTextAreaElement, max: number) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, max) + 'px'
  }, [])

  const highlightCount = highlightedIndices.size
  const platformLabel = conversation?.platform === 'chatgpt' ? 'chatgpt' : 'claude'

  return (
    <PageContainer mode="conversation" maxWidth={620}>
      <ModeHeader category="capture" mode="conversation" />

      {/* URL Input */}
      <div className={`${styles.urlSection} ${platform === 'chatgpt' ? styles.platformChatgpt : ''}`}>
        <div className={styles.urlInputWrap}>
          <span className={styles.urlIcon}>&#x1F4AC;</span>
          <input
            ref={urlInputRef}
            type="url"
            className={styles.urlInput}
            placeholder="paste a shared conversation link\u2026"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            spellCheck={false}
          />
        </div>
        <div className={styles.urlHint}>
          <kbd className={styles.kbd}>Enter</kbd> to fetch conversation
        </div>
        <div className={styles.supportedBadges}>
          <span className={styles.badge}>claude.ai/share/&hellip;</span>
          <span className={styles.badge}>chatgpt.com/share/&hellip;</span>
        </div>
      </div>

      {/* Fetch Indicator */}
      <FetchIndicator active={fetchStage !== 'idle'} text={FETCH_STAGE_TEXT[fetchStage]} />

      {/* Conversation Preview */}
      {conversation && (
        <>
          <div className={styles.convoCard}>
            <div className={styles.convoHeader}>
              <span className={`${styles.platformBadge} ${styles[platformLabel]}`}>
                {platformLabel}
              </span>
              <span className={styles.convoTitle}>{conversation.title}</span>
            </div>

            <div className={styles.convoMeta}>
              <span className={styles.convoStat}>
                <strong>{conversation.messages.length}</strong> messages
              </span>
              <span className={`${styles.convoStat} ${highlightCount > 0 ? styles.highlightStat : ''}`}>
                <strong>{highlightCount}</strong> highlighted
              </span>
            </div>

            <div className={styles.messages}>
              {conversation.messages.map((msg, i) => {
                const isHighlighted = highlightedIndices.has(i)
                return (
                  <div
                    key={i}
                    className={`${styles.msg} ${isHighlighted ? styles.highlighted : ''}`}
                    onClick={() => toggleHighlight(i)}
                  >
                    <span className={styles.msgStar}>&#x2605;</span>
                    <div className={`${styles.msgRole} ${msg.role === 'human' ? styles.roleHuman : styles.roleAi}`}>
                      {msg.role === 'human' ? 'HUMAN' : platformLabel.toUpperCase()}
                    </div>
                    <div className={styles.msgText}>{msg.content}</div>
                  </div>
                )
              })}
            </div>

            <div className={styles.highlightHint}>
              click any message to highlight key moments for your corpus
            </div>
          </div>

          {/* Reflection */}
          <div className={styles.reflectionSection}>
            <div className={styles.reflectionLabel}>What did this conversation clarify?</div>
            <div className={styles.reflectionPrompt}>
              Your questions reveal what you were trying to understand. What clicked?
            </div>
            <textarea
              ref={reflectionRef}
              className={styles.reflectionInput}
              placeholder="the key thing I got from this conversation is\u2026"
              value={reflection}
              onChange={(e) => {
                setReflection(e.target.value)
                autoResize(e.target, 140)
              }}
              rows={2}
            />
          </div>

          {/* Tags */}
          <div className={styles.tagSection}>
            <TagRow
              tags={tags}
              onDismiss={handleDismissTag}
              onAdd={handleAddTag}
            />
          </div>

          {/* Capture */}
          <div className={styles.captureSection}>
            <CaptureButton
              label="Save to corpus"
              capturedLabel={`saved \u00b7 ${highlightCount} highlighted`}
              onCapture={handleCapture}
            />
          </div>
        </>
      )}

      {/* Saved Conversations */}
      <div className={styles.recent}>
        <div className={styles.recentHeader}>Saved conversations</div>
        {savedConversations.map((item) => (
          <div key={item.id} className={styles.recentItem}>
            <span className={`${styles.recentPlatform} ${styles[item.platform]}`}>
              {item.platform}
            </span>
            <div className={styles.recentContent}>
              <div className={styles.recentTitle}>{item.title}</div>
              <div className={styles.recentMeta}>{item.meta}</div>
              {item.reflection && (
                <div className={styles.recentReflection}>{item.reflection}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
