import { useState, useCallback, useRef, useEffect } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { ModeHeader } from '@/components/ui/ModeHeader'
import { useRipple } from '@/components/ui/RippleContainer'
import { useAutoTags } from '@/hooks/useAutoTags'
import { useCaptureStore } from '@/stores/capture'
import { ingestText, ingestUrl } from '@/lib/api'
import styles from './BrowsingView.module.css'

interface RecentItem {
  id: string
  type: string
  title: string
  meta: string
  parts?: { label: string; value: string }[]
  status: 'processing' | 'embedded' | 'error'
}

export function BrowsingView() {
  const [content, setContent] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [note, setNote] = useState('')
  const [showSource, setShowSource] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [tags, setTags] = useState<{ name: string; auto: boolean; dismissed: boolean }[]>([])
  const [btnState, setBtnState] = useState<'idle' | 'capturing' | 'captured'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const sourceRef = useRef<HTMLInputElement>(null)
  const captureBtnRef = useRef<HTMLButtonElement>(null)
  const { classify } = useAutoTags()
  const addCapture = useCaptureStore((s) => s.addCapture)
  const { spawn, RippleOverlay } = useRipple()

  const isUrl = /^https?:\/\/\S+$/.test(content.trim()) && !content.includes('\n')
  const charCount = content.length + note.length

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Auto-focus into revealed secondary fields
  useEffect(() => {
    if (showSource) setTimeout(() => sourceRef.current?.focus(), 150)
  }, [showSource])
  useEffect(() => {
    if (showNote) setTimeout(() => noteRef.current?.focus(), 150)
  }, [showNote])

  const autoResize = useCallback((el: HTMLTextAreaElement, max: number) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, max) + 'px'
  }, [])

  const capture = useCallback(async () => {
    if (!content.trim() || btnState !== 'idle') return

    setBtnState('capturing')
    setError(null)

    // Spawn ripple from capture button center
    if (captureBtnRef.current) {
      const rect = captureBtnRef.current.getBoundingClientRect()
      spawn(rect.left + rect.width / 2, rect.top + rect.height / 2)
    }

    // Classify tags from content
    const allText = [content, note].filter(Boolean).join(' ')
    const autoTags = classify(allText)
    const tagList = autoTags.length ? autoTags : ['untagged']
    setTags(tagList.map((t) => ({ name: t, auto: true, dismissed: false })))
    const activeTags = tagList

    // Determine type for the recent item
    const hasSource = sourceUrl.length > 0
    const hasNote = note.length > 0

    const title = content.length > 72 ? content.substring(0, 72) + '…' : content
    const tempId = `r-${Date.now()}`

    // Add processing item to recent list immediately
    const newItem: RecentItem = {
      id: tempId,
      type: isUrl ? 'url' : (hasSource || hasNote) ? 'bundle' : content.length < 200 ? 'note' : 'paste',
      title,
      meta: isUrl ? 'scraping…' : `${content.length} chars`,
      parts: (hasSource || hasNote) ? [
        { label: 'content', value: `${content.length} chars` },
        ...(hasSource ? [{ label: 'source', value: (() => { try { return new URL(sourceUrl).hostname } catch { return sourceUrl } })() }] : []),
        ...(hasNote ? [{ label: 'note', value: `${note.length} chars` }] : []),
      ] : undefined,
      status: 'processing',
    }
    setRecentItems((prev) => [newItem, ...prev])
    addCapture({ title, mode: 'browsing', status: 'processing' })

    try {
      const doc = isUrl
        ? await ingestUrl(content.trim(), activeTags, note || undefined)
        : await ingestText(content, activeTags, {
            source_type: content.length < 200 && !hasSource && !hasNote ? 'note' : 'paste',
            source_url: hasSource ? sourceUrl : undefined,
            user_note: hasNote ? note : undefined,
          })

      // Update recent item with real data from server
      const tagStr = doc.tags.length ? ` · tagged: ${doc.tags.join(', ')}` : ''
      setRecentItems((prev) => prev.map((item) =>
        item.id === tempId
          ? { ...item, id: doc.id, title: doc.title || title, meta: (isUrl ? doc.source ?? '' : `${content.length} chars`) + tagStr, status: 'embedded' }
          : item,
      ))
      setBtnState('captured')

      // Reset form after brief confirmation
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Capture failed'
      setError(message)
      setRecentItems((prev) => prev.map((item) =>
        item.id === tempId ? { ...item, status: 'error', meta: message } : item,
      ))
      setBtnState('idle')
    }
  }, [content, sourceUrl, note, isUrl, btnState, classify, addCapture])

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
            ref={sourceRef}
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

      {error && (
        <div className={styles.error} onClick={() => setError(null)}>
          {error}
        </div>
      )}

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
        ref={captureBtnRef}
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
            <span className={`${styles.recentStatus} ${item.status === 'processing' ? styles.processing : ''} ${item.status === 'error' ? styles.errorStatus : ''}`}>
              {item.status === 'processing' ? 'processing…' : item.status === 'error' ? 'failed' : 'embedded'}
            </span>
          </div>
        ))}
      </div>
      <RippleOverlay />
    </PageContainer>
  )
}
