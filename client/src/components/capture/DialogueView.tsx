import { useState, useCallback, useRef, useEffect } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { TagRow } from '@/components/ui/TagRow'
import { useAutoTags } from '@/hooks/useAutoTags'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useAutoResize } from '@/hooks/useAutoResize'
import { getResonances, ingestText } from '@/lib/api'
import styles from './DialogueView.module.css'

/* ============================================
   Types
   ============================================ */

interface PastSession {
  id: string
  text: string
  date: string
  duration: string
  wordCount: number
}

interface ResonanceItem {
  id: string
  type: string
  source?: string
  age: string
  text: string
  tags: string
}



/* ============================================
   Helpers
   ============================================ */

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length
}


/* ============================================
   Component
   ============================================ */

export function DialogueView() {
  // Editor state
  const [text, setText] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [resonances, setResonances] = useState<ResonanceItem[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [closing, setClosing] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  // Past sessions
  const [inlineSessions, setInlineSessions] = useState<{ text: string; label: string }[]>([
    { text: '', label: 'new session' },
  ])
  const [previousSessions, setPreviousSessions] = useState<PastSession[]>([])

  // Refs for thresholds and timers
  const wordThreshold = useRef(20)
  const lastResonanceText = useRef('')
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const tagTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const resonanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hintShown = useRef(false)
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const editorRef = useRef<HTMLTextAreaElement | null>(null)
  const sessionStartRef = useRef(Date.now())

  // Hooks
  const { status: saveStatus, save } = useAutoSave(800)
  const elapsed = useSessionTimer()
  const { classify } = useAutoTags()
  const { ref: autoResizeRef, resize } = useAutoResize()

  // Combine refs
  const setEditorRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      editorRef.current = node
      autoResizeRef(node)
    },
    [autoResizeRef],
  )

  const words = countWords(text)

  // Save status text
  const saveText = saveStatus === 'saving' ? 'saving\u2026' : saveStatus === 'saved' ? 'saved' : ''

  // Close session
  const closeSession = useCallback(() => {
    if (!text.trim() || closing) return

    setClosing(true)

    // Save the session to the server
    ingestText(text.trim(), tags, { source_type: 'dialogue' }).catch(() => {})

    const sessionWords = countWords(text)
    const elapsedMs = Date.now() - sessionStartRef.current
    const elapsedMin = Math.max(1, Math.floor(elapsedMs / 60000))
    const now = new Date()
    const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' })
    const label = `${dateStr} \u00b7 ${elapsedMin} min session \u00b7 ${sessionWords} words`

    setTimeout(() => {
      // Move to inline sessions
      setInlineSessions((prev) => {
        // Replace the last "today" divider with closed session + new divider
        const withoutLast = prev.slice(0, -1)
        return [
          ...withoutLast,
          { text: prev[prev.length - 1].text, label: prev[prev.length - 1].label },
          { text: text.trim(), label },
          { text: '', label: 'new session' },
        ]
      })

      // Add to previous sessions list
      setPreviousSessions((prev) => [
        {
          id: `ps-${Date.now()}`,
          text: text.trim(),
          date: 'just now',
          duration: `${elapsedMin} min session`,
          wordCount: sessionWords,
        },
        ...prev,
      ])

      // Reset editor
      setText('')
      setTags([])
      setResonances([])
      setClosing(false)
      wordThreshold.current = 20
      lastResonanceText.current = ''
      hintShown.current = false
      sessionStartRef.current = Date.now()

      // Focus editor
      setTimeout(() => {
        editorRef.current?.focus()
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }, 500)
  }, [text, closing])

  // Handle text input
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value
      setText(newText)
      resize()

      const wordCount = countWords(newText)

      // Writing indicator
      setIsTyping(true)
      clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => setIsTyping(false), 1000)

      // Autosave
      if (newText.trim()) save()

      // Auto-tags after 10 words with 2s pause
      if (wordCount >= 10) {
        clearTimeout(tagTimer.current)
        tagTimer.current = setTimeout(() => {
          const newTags = classify(newText)
          if (newTags.length) setTags(newTags)
        }, 2000)
      }

      // Resonance after threshold words with 1.5s pause — query real corpus
      if (wordCount >= wordThreshold.current) {
        clearTimeout(resonanceTimer.current)
        resonanceTimer.current = setTimeout(() => {
          const current = newText.trim()
          if (current !== lastResonanceText.current && current.length > 50) {
            lastResonanceText.current = current

            getResonances(current).then((results) => {
              if (results.length > 0) {
                const newResonances: ResonanceItem[] = results.map((r, i) => ({
                  id: `res-${Date.now()}-${i}`,
                  type: r.document.type,
                  source: r.document.source,
                  age: r.document.createdAt,
                  text: r.highlights[0] || r.document.excerpt,
                  tags: r.document.tags.join(', '),
                }))

                setResonances((prev) => {
                  const existingTexts = new Set(prev.map((r) => r.text))
                  const toAdd = newResonances.filter((r) => !existingTexts.has(r.text))
                  return toAdd.length > 0 ? [...prev, ...toAdd] : prev
                })
              }
            }).catch(() => {})

            wordThreshold.current = wordCount + 30
          }
        }, 1500)
      }

      // Show Cmd+. hint once after 10 words
      if (wordCount >= 10 && !hintShown.current) {
        hintShown.current = true
        setShowHint(true)
        clearTimeout(hintTimer.current)
        hintTimer.current = setTimeout(() => setShowHint(false), 4000)
      }
    },
    [save, classify, resize],
  )

  // Dismiss resonance
  const dismissResonance = useCallback((id: string) => {
    setResonances((prev) => prev.filter((r) => r.id !== id))
  }, [])

  // Tag handlers
  const handleDismissTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleAddTag = useCallback((tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
  }, [])

  // Keyboard shortcut: Cmd+.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault()
        closeSession()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [closeSession])

  // Focus on mount
  useEffect(() => {
    editorRef.current?.focus()
  }, [])

  // Clean up timers
  useEffect(() => {
    return () => {
      clearTimeout(typingTimer.current)
      clearTimeout(tagTimer.current)
      clearTimeout(resonanceTimer.current)
      clearTimeout(hintTimer.current)
    }
  }, [])

  const showCloseBtn = words >= 3
  const showMeta = tags.length > 0
  const showResonance = resonances.length > 0

  // Derive title from first sentence for previous sessions list
  const getTitle = (fullText: string) => {
    const first = fullText.split(/[.!?]/)[0]
    return first.length > 72 ? first.substring(0, 72) + '\u2026' : first
  }

  return (
    <PageContainer mode="notes" maxWidth={680}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            capture <span className={styles.titleAccent}>&middot;</span> notes
          </h1>
          <div className={styles.saveStatus} data-status={saveStatus}>
            <span className={styles.saveDot} />
            <span>{saveText}</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          {words > 0 && <span className={styles.wordCount}>{words} words</span>}
          <span className={styles.sessionTime}>{elapsed}</span>
        </div>
      </div>

      {/* Past sessions (inline, read-only) */}
      <div className={styles.pastSessions}>
        {inlineSessions.map((session, i) => (
          <div key={i}>
            {session.text && (
              <div className={styles.pastSessionText}>{session.text}</div>
            )}
            <div className={styles.sessionDivider}>
              <span className={styles.sessionDividerLabel}>{session.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Writing surface */}
      <div className={styles.writingSurface}>
        <textarea
          ref={setEditorRef}
          className={styles.editor}
          placeholder="start writing... let your thoughts flow"
          value={text}
          onChange={handleInput}
        />
        <div className={styles.writingIndicator} data-active={isTyping} />
      </div>

      {/* Close session button */}
      <button
        className={styles.closeSession}
        data-visible={showCloseBtn}
        data-closing={closing}
        onClick={closeSession}
      >
        {closing ? 'closing\u2026' : 'close session'}
      </button>

      {/* Resonance panel */}
      <div className={styles.resonancePanel} data-visible={showResonance}>
        <div className={styles.resonanceHeader}>
          <span className={styles.resonanceIcon}>{'\u25CC'}</span>
          <span className={styles.resonanceTitle}>Resonances from your corpus</span>
          <span className={styles.resonanceSubtitle}>surfaced while you write</span>
        </div>
        {resonances.map((item) => (
          <div key={item.id} className={styles.resonanceItem}>
            <div className={styles.resonanceItemTop}>
              <div className={styles.resonanceItemType}>
                <span className={styles.typeBadge}>{item.type}</span>
                {item.age}
                {item.source && ` \u00b7 ${item.source}`}
              </div>
              <button
                className={styles.resonanceDismiss}
                onClick={() => dismissResonance(item.id)}
              >
                dismiss
              </button>
            </div>
            <div className={styles.resonanceItemText}>{item.text}</div>
            <div className={styles.resonanceItemSource}>tagged: {item.tags}</div>
          </div>
        ))}
      </div>

      {/* Auto-tags */}
      <div className={styles.noteMeta} data-visible={showMeta}>
        <span className={styles.tagLabel}>tags</span>
        <TagRow tags={tags} onDismiss={handleDismissTag} onAdd={handleAddTag} />
      </div>

      {/* Previous writing sessions */}
      <div className={styles.previousNotes}>
        <div className={styles.previousHeader}>Recent writing sessions</div>
        {previousSessions.map((session) => (
          <div
            key={session.id}
            className={styles.previousItem}
            onClick={() =>
              setExpandedSession(expandedSession === session.id ? null : session.id)
            }
          >
            <div className={styles.previousItemTitle}>{getTitle(session.text)}</div>
            <div className={styles.previousItemMeta}>
              <span>
                {session.wordCount} words &middot; {session.duration}
              </span>
              <span>{session.date}</span>
            </div>
            {expandedSession === session.id ? (
              <div className={styles.previousItemExpanded}>{session.text}</div>
            ) : (
              <div className={styles.previousItemExcerpt}>{session.text}</div>
            )}
          </div>
        ))}
      </div>

      {/* Keyboard hint */}
      <div className={styles.closeHint} data-visible={showHint}>
        <kbd className={styles.kbd}>{'\u2318'}</kbd>
        <kbd className={styles.kbd}>.</kbd> to close session
      </div>
    </PageContainer>
  )
}
