import { useState, useCallback, useRef, useEffect } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { ModeHeader } from '@/components/ui/ModeHeader'
import { TagRow } from '@/components/ui/TagRow'
import { CaptureButton } from '@/components/ui/CaptureButton'
import { FetchIndicator } from '@/components/ui/FetchIndicator'
import { fetchUrlPreview } from '@/lib/api'
import { useAutoTags } from '@/hooks/useAutoTags'
import { useCaptureStore } from '@/stores/capture'
import styles from './CurationView.module.css'

interface UrlPreview {
  title: string
  domain: string
  readTime: string
  excerpt: string
  chunks: number
  tokens: number
}

interface QueueItem {
  id: string
  title: string
  domain: string
  readTime: string
  tags: string[]
  intent?: string
  isRead: boolean
}

type FetchStage = 'idle' | 'fetching' | 'extracting' | 'estimating'

const FETCH_STAGE_TEXT: Record<FetchStage, string> = {
  idle: '',
  fetching: 'fetching page...',
  extracting: 'extracting content...',
  estimating: 'estimating read time...',
}

const INITIAL_QUEUE: QueueItem[] = [
  {
    id: 'q1',
    title: 'How should I approach evaluating my RAG system?',
    domain: 'hamel.dev',
    readTime: '5 min',
    tags: ['evals', 'rag'],
    intent: 'for understanding retrieval vs generation eval separation',
    isRead: false,
  },
  {
    id: 'q2',
    title: 'Hybrid Search for RAG: BM25, SPLADE, and Vector Search Combined',
    domain: 'blog.premai.io',
    readTime: '12 min',
    tags: ['rag', 'infra'],
    intent: 'reference for implementing hybrid retrieval in the notebook',
    isRead: true,
  },
  {
    id: 'q3',
    title: 'Best Chunking Strategies for RAG in 2026',
    domain: 'firecrawl.dev',
    readTime: '9 min',
    tags: ['rag'],
    intent: 'need the benchmark numbers for my blog post on chunking',
    isRead: false,
  },
  {
    id: 'q4',
    title: 'Chunking Strategies to Improve LLM RAG Pipeline Performance',
    domain: 'weaviate.io',
    readTime: '10 min',
    tags: ['rag', 'infra'],
    isRead: false,
  },
]

export function CurationView() {
  const [url, setUrl] = useState('')
  const [fetchStage, setFetchStage] = useState<FetchStage>('idle')
  const [preview, setPreview] = useState<UrlPreview | null>(null)
  const [intent, setIntent] = useState('')
  const [isRead, setIsRead] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [queue, setQueue] = useState<QueueItem[]>(INITIAL_QUEUE)

  const inputRef = useRef<HTMLInputElement>(null)
  const intentRef = useRef<HTMLTextAreaElement>(null)
  const { classify } = useAutoTags()
  const addCapture = useCaptureStore((s) => s.addCapture)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const runFetchSequence = useCallback(async (inputUrl: string) => {
    if (!inputUrl || !/^https?:\/\//.test(inputUrl)) return

    setPreview(null)
    setTags([])
    setIntent('')
    setIsRead(false)

    // Stage 1: fetching
    setFetchStage('fetching')
    await new Promise((r) => setTimeout(r, 800))

    // Stage 2: extracting
    setFetchStage('extracting')
    await new Promise((r) => setTimeout(r, 800))

    // Stage 3: estimating
    setFetchStage('estimating')

    const data = await fetchUrlPreview(inputUrl)

    setFetchStage('idle')
    setPreview(data)

    // Auto-tag from title + excerpt
    const allText = `${data.title} ${data.excerpt}`
    const autoTags = classify(allText)
    setTags(autoTags.length ? autoTags : ['learning'])
  }, [classify])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      runFetchSequence(url.trim())
    }
  }, [url, runFetchSequence])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim()
    if (/^https?:\/\/\S+$/.test(pasted)) {
      // Let the paste complete, then fetch
      setTimeout(() => runFetchSequence(pasted), 100)
    }
  }, [runFetchSequence])

  const handleCapture = useCallback(async () => {
    if (!preview) return

    addCapture({ title: preview.title, mode: 'curation', status: 'processing' })

    const newItem: QueueItem = {
      id: `q-${Date.now()}`,
      title: preview.title,
      domain: preview.domain,
      readTime: preview.readTime.replace(' read', ''),
      tags: [...tags],
      intent: intent.trim() || undefined,
      isRead,
    }

    setQueue((prev) => [newItem, ...prev])

    // Reset form
    setUrl('')
    setPreview(null)
    setIntent('')
    setIsRead(false)
    setTags([])
    inputRef.current?.focus()
  }, [preview, intent, isRead, tags, addCapture])

  const handleDismissTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleAddTag = useCallback((tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev : [...prev, tag])
  }, [])

  const autoResizeIntent = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 80) + 'px'
  }, [])

  // Cmd+Enter shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (preview) handleCapture()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [preview, handleCapture])

  const unreadCount = queue.filter((q) => !q.isRead).length

  return (
    <PageContainer mode="curation" maxWidth={560}>
      <ModeHeader category="capture" mode="curate" />

      {/* URL Input */}
      <div className={styles.urlInputWrap}>
        <span className={styles.urlIcon}>&#x1f517;</span>
        <input
          ref={inputRef}
          type="url"
          className={styles.urlInput}
          placeholder="paste an article URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          spellCheck={false}
          disabled={fetchStage !== 'idle'}
        />
      </div>
      <div className={styles.urlHint}>
        <kbd>Enter</kbd> to fetch &amp; preview
      </div>

      {/* Fetch indicator */}
      {fetchStage !== 'idle' && (
        <div className={styles.fetchWrap}>
          <FetchIndicator active text={FETCH_STAGE_TEXT[fetchStage]} />
        </div>
      )}

      {/* Preview Card */}
      {preview && (
        <div className={styles.previewCard}>
          <div className={styles.previewSource}>
            <div className={styles.sourceFavicon}>&#x25CF;</div>
            <span className={styles.sourceDomain}>{preview.domain}</span>
            <div className={styles.sourceMeta}>
              <span className={styles.metaPill}>{preview.readTime}</span>
            </div>
          </div>

          <div className={styles.previewBody}>
            <div className={styles.previewTitle}>{preview.title}</div>
            <div className={styles.previewExcerpt}>{preview.excerpt}</div>
          </div>

          <div className={styles.previewStats}>
            <span className={styles.stat}>
              est. <strong className={styles.statValue}>{preview.chunks}</strong> chunks
            </span>
            <span className={styles.stat}>
              ~<strong className={styles.statValue}>{preview.tokens.toLocaleString()}</strong> tokens
            </span>
          </div>

          {/* Intent */}
          <div className={styles.intentSection}>
            <div className={styles.intentLabel}>intent</div>
            <textarea
              ref={intentRef}
              className={styles.intentInput}
              placeholder="what drew you to this? what will you use it for?"
              value={intent}
              onChange={(e) => {
                setIntent(e.target.value)
                autoResizeIntent(e.target)
              }}
              rows={1}
            />
          </div>

          {/* Read/Unread toggle */}
          <div className={styles.readToggle}>
            <button
              className={`${styles.readSwitch} ${isRead ? styles.on : ''}`}
              onClick={() => setIsRead(!isRead)}
              type="button"
              aria-label="Toggle read status"
            >
              <div className={styles.readSwitchKnob} />
            </button>
            <span className={styles.readToggleLabel}>
              {isRead ? 'read' : 'unread'}
            </span>
          </div>

          {/* Tags */}
          <div className={styles.tagsWrap}>
            <div className={styles.tagsLabel}>tags</div>
            <TagRow
              tags={tags}
              onDismiss={handleDismissTag}
              onAdd={handleAddTag}
            />
          </div>
        </div>
      )}

      {/* Capture button */}
      {preview && (
        <div className={styles.captureWrap}>
          <CaptureButton
            label="Add to collection"
            capturedLabel="added to collection"
            onCapture={handleCapture}
          />
        </div>
      )}

      {/* Reading Queue */}
      <div className={styles.queue}>
        <div className={styles.queueHeader}>
          <span className={styles.queueTitle}>reading queue</span>
          <span className={styles.queueCount}>
            {unreadCount} unread &middot; {queue.length} total
          </span>
        </div>

        {queue.map((item) => (
          <div key={item.id} className={styles.queueItem}>
            <div className={styles.queueItemTop}>
              <span className={styles.queueItemDomain}>{item.domain}</span>
              <span className={styles.queueItemTitle}>{item.title}</span>
              <span
                className={`${styles.queueItemStatus} ${
                  item.isRead ? styles.statusRead : styles.statusUnread
                }`}
              >
                {item.isRead ? 'read' : 'unread'}
              </span>
            </div>
            <div className={styles.queueItemMeta}>
              <span>{item.readTime}</span>
              {item.tags.length > 0 && (
                <span>tagged: {item.tags.join(', ')}</span>
              )}
            </div>
            {item.intent && (
              <div className={styles.queueItemIntent}>{item.intent}</div>
            )}
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
