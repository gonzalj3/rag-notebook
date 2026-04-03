import { useState, useCallback, useRef, useEffect } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { ModeHeader } from '@/components/ui/ModeHeader'
import { useAutoTags } from '@/hooks/useAutoTags'
import { useCaptureStore } from '@/stores/capture'
import styles from './BrowsingView.module.css'

interface RecentItem {
  id: string
  type: string
  title: string
  meta: string
  parts?: { label: string; value: string }[]
  status: 'processing' | 'embedded'
}

export function BrowsingView() {
  const [content, setContent] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [note, setNote] = useState('')
  const [showSource, setShowSource] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [tags, setTags] = useState<{ name: string; auto: boolean; dismissed: boolean }[]>([])
  const [btnState, setBtnState] = useState<'idle' | 'capturing' | 'captured'>('idle')
  const [recentItems, setRecentItems] = useState<RecentItem[]>([
    { id: '1', type: 'bundle', title: '"80% of RAG failures trace back to ingestion, not the LLM"', meta: 'tagged: rag, evals', parts: [{ label: 'content', value: '91 chars' }, { label: 'source', value: 'blog.premai.io' }, { label: 'note', value: 'attached' }], status: 'embedded' },
    { id: '2', type: 'url', title: 'Hybrid Search for RAG: BM25, SPLADE, and Vector Search', meta: 'blog.premai.io · 12 chunks · tagged: rag', status: 'embedded' },
    { id: '3', type: 'paste', title: '"The abuse of generic metrics is endemic…" — Hamel Husain', meta: '137 chars · tagged: evals', status: 'processing' },
    { id: '4', type: 'note', title: 'recursive 512-token splitting beats semantic chunking — counterintuitive', meta: '94 chars · tagged: rag', status: 'embedded' },
  ])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const { classify } = useAutoTags()
  const addCapture = useCaptureStore((s) => s.addCapture)

  const isUrl = /^https?:\/\/\S+$/.test(content.trim()) && !content.includes('\n')
  const charCount = content.length + note.length

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const autoResize = useCallback((el: HTMLTextAreaElement, max: number) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, max) + 'px'
  }, [])

  const capture = useCallback(() => {
    if (!content.trim() || btnState !== 'idle') return

    setBtnState('capturing')
    const allText = [content, note].filter(Boolean).join(' ')
    const autoTags = classify(allText)

    setTimeout(() => {
      setTags(autoTags.length ? autoTags.map((t) => ({ name: t, auto: true, dismissed: false })) : [{ name: 'untagged', auto: true, dismissed: false }])
    }, 300)

    setTimeout(() => {
      setBtnState('captured')

      const hasSource = sourceUrl.length > 0
      const hasNote = note.length > 0
      let type = 'paste'
      if (isUrl && !hasSource && !hasNote) type = 'url'
      else if (!isUrl && !hasSource && !hasNote && content.length < 200) type = 'note'
      if (hasSource || hasNote) type = 'bundle'

      const title = content.length > 72 ? content.substring(0, 72) + '…' : content
      const meta = isUrl ? 'scraping…' : `${content.length} chars`
      const activeTags = tags.filter((t) => t.auto && !t.dismissed).map((t) => t.name)
      const tagStr = activeTags.length ? ` · tagged: ${activeTags.join(', ')}` : ''

      const newItem: RecentItem = {
        id: `r-${Date.now()}`,
        type,
        title,
        meta: meta + tagStr,
        parts: type === 'bundle' ? [
          { label: 'content', value: `${content.length} chars` },
          ...(hasSource ? [{ label: 'source', value: (() => { try { return new URL(sourceUrl).hostname } catch { return sourceUrl } })() }] : []),
          ...(hasNote ? [{ label: 'note', value: `${note.length} chars` }] : []),
        ] : undefined,
        status: 'processing',
      }

      setRecentItems((prev) => [newItem, ...prev])
      addCapture({ title, mode: 'browsing', status: 'processing' })

      setTimeout(() => {
        setRecentItems((prev) => prev.map((item) => item.id === newItem.id ? { ...item, status: 'embedded' } : item))
      }, 2500)

      setTimeout(() => {
        setContent('')
        setSourceUrl('')
        setNote('')
        setShowSource(false)
        setShowNote(false)
        setTags([])
        setBtnState('idle')
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
        }
      }, 1200)
    }, 600)
  }, [content, sourceUrl, note, isUrl, btnState, classify, tags, addCapture])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        capture()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [capture])

  return (
    <PageContainer mode="browsing" maxWidth={560}>
      <ModeHeader category="capture" mode="browse" />

      <div className={styles.captureCard}>
        <textarea
          ref={textareaRef}
          className={styles.primaryInput}
          placeholder="paste a tweet, drop a link, type a thought…"
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            autoResize(e.target, 240)
          }}
          rows={1}
        />

        <div className={`${styles.attachBar} ${showSource || showNote ? styles.hasContent : ''}`}>
          <button
            className={`${styles.attachBtn} ${showSource ? styles.active : ''}`}
            onClick={() => setShowSource(!showSource)}
          >
            <span className={styles.icon}>🔗</span> source
          </button>
          <button
            className={`${styles.attachBtn} ${showNote ? styles.active : ''}`}
            onClick={() => setShowNote(!showNote)}
          >
            <span className={styles.icon}>✎</span> note
          </button>
          <span className={styles.attachSpacer} />
          {charCount > 0 && <span className={styles.charCount}>{charCount} chars</span>}
        </div>

        <div className={`${styles.secondaryField} ${showSource ? styles.open : ''}`}>
          <div className={styles.fieldLabel}>source url</div>
          <input
            type="url"
            className={styles.secondaryInput}
            placeholder="https://twitter.com/…"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className={`${styles.secondaryField} ${showNote ? styles.open : ''}`}>
          <div className={styles.fieldLabel}>your note</div>
          <textarea
            ref={noteRef}
            className={`${styles.secondaryInput} ${styles.secondaryTextarea}`}
            placeholder="why this matters, what it connects to…"
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              autoResize(e.target, 80)
            }}
            rows={1}
          />
        </div>
      </div>

      <div className={styles.captureHint}>
        <span className={styles.hintText}>
          <kbd className={styles.kbd}>⌘</kbd><kbd className={styles.kbd}>Enter</kbd> to capture
        </span>
        {isUrl && <span className={styles.urlHint}>url detected — will scrape</span>}
      </div>

      <div className={styles.tagRow}>
        <span className={styles.tagLabel}>tags</span>
        {tags.length === 0 ? (
          <span className={styles.tagPlaceholder}>auto-generated on capture</span>
        ) : (
          <>
            {tags.map((tag, i) => (
              <span
                key={tag.name}
                className={`${styles.tag} ${tag.auto && !tag.dismissed ? styles.auto : ''} ${tag.dismissed ? styles.dismissed : ''}`}
                style={{ animationDelay: `${i * 100}ms` }}
                onClick={() => setTags((prev) => prev.map((t) => t.name === tag.name ? { ...t, dismissed: !t.dismissed, auto: t.dismissed } : t))}
              >
                {tag.name}
              </span>
            ))}
            <span
              className={styles.tagAdd}
              style={{ animationDelay: `${tags.length * 100}ms` }}
              onClick={() => {
                const name = prompt('Tag name:')
                if (name?.trim()) {
                  setTags((prev) => [...prev, { name: name.trim().toLowerCase(), auto: true, dismissed: false }])
                }
              }}
            >
              + add
            </span>
          </>
        )}
      </div>

      <button
        className={`${styles.captureBtn} ${styles[btnState]}`}
        onClick={capture}
        disabled={btnState !== 'idle'}
      >
        {btnState === 'idle' && 'Capture'}
        {btnState === 'capturing' && 'Capturing…'}
        {btnState === 'captured' && 'Captured'}
      </button>

      <div className={styles.recent}>
        <div className={styles.recentHeader}>Recently captured</div>
        {recentItems.map((item) => (
          <div key={item.id} className={styles.recentItem}>
            <span className={`${styles.recentType} ${styles[item.type]}`}>{item.type}</span>
            <div className={styles.recentContent}>
              <div className={styles.recentTitle}>{item.title}</div>
              <div className={styles.recentMeta}>{item.meta}</div>
              {item.parts && (
                <div className={styles.recentParts}>
                  {item.parts.map((p) => (
                    <span key={p.label} className={styles.recentPart}>{p.label}: {p.value}</span>
                  ))}
                </div>
              )}
            </div>
            <span className={`${styles.recentStatus} ${item.status === 'processing' ? styles.processing : ''}`}>
              {item.status === 'processing' ? 'processing…' : 'embedded'}
            </span>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
