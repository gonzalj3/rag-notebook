import { useState, useEffect, useCallback, useRef } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { ModeHeader } from '@/components/ui/ModeHeader'
import { getDocuments } from '@/lib/api'
import type { Document } from '@/lib/types'
import styles from './ReadingQueueView.module.css'

export function ReadingQueueView() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)

  useEffect(() => {
    setLoading(true)
    getDocuments('url', 100)
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all'
    ? docs
    : docs.filter((d) => filter === 'read' ? d.metadata?.is_read : !d.metadata?.is_read)

  const handleToggleRead = useCallback((id: string) => {
    setDocs((prev) => prev.map((d) =>
      d.id === id ? { ...d, metadata: { ...d.metadata, is_read: !d.metadata?.is_read } } : d
    ))
    // TODO: persist to server when a PATCH /documents/:id endpoint exists
  }, [])

  const unreadCount = docs.filter((d) => !d.metadata?.is_read).length

  // Full-screen reader view
  if (selectedDoc) {
    return <ReaderView doc={selectedDoc} onBack={() => setSelectedDoc(null)} />
  }

  return (
    <PageContainer mode="search" maxWidth={640}>
      <ModeHeader category="retrieve" mode="reading queue" />

      <div className={styles.filters}>
        {(['all', 'unread', 'read'] as const).map((f) => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
            {f === 'unread' && unreadCount > 0 && (
              <span className={styles.badge}>{unreadCount}</span>
            )}
          </button>
        ))}
        <span className={styles.totalCount}>{docs.length} articles</span>
      </div>

      {loading ? (
        <div className={styles.empty}>loading...</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          {docs.length === 0
            ? 'no articles yet — curate some URLs to build your reading queue'
            : `no ${filter} articles`}
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((doc) => (
            <QueueItem key={doc.id} doc={doc} onSelect={() => setSelectedDoc(doc)} onToggleRead={handleToggleRead} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}

function QueueItem({ doc, onSelect, onToggleRead }: { doc: Document; onSelect: () => void; onToggleRead: (id: string) => void }) {
  const [swiped, setSwiped] = useState(false)
  const touchStartX = useRef(0)
  const touchCurrentX = useRef(0)
  const itemRef = useRef<HTMLDivElement>(null)

  const domain = doc.source
    ? (() => { try { return new URL(doc.source).hostname } catch { return doc.source } })()
    : ''

  const isRead = !!doc.metadata?.is_read

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchCurrentX.current = e.touches[0].clientX
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX
    const diff = touchStartX.current - touchCurrentX.current
    if (itemRef.current && diff > 10) {
      const offset = Math.min(diff, 100)
      itemRef.current.style.transform = `translateX(-${offset}px)`
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchCurrentX.current
    if (diff > 60) {
      setSwiped(true)
      if (itemRef.current) itemRef.current.style.transform = 'translateX(-100px)'
    } else {
      setSwiped(false)
      if (itemRef.current) itemRef.current.style.transform = ''
    }
  }, [])

  const handleToggle = useCallback(() => {
    onToggleRead(doc.id)
    setSwiped(false)
    if (itemRef.current) itemRef.current.style.transform = ''
  }, [doc.id, onToggleRead])

  // Close swipe on click elsewhere
  const handleClick = useCallback(() => {
    if (swiped) {
      setSwiped(false)
      if (itemRef.current) itemRef.current.style.transform = ''
    } else {
      onSelect()
    }
  }, [swiped, onSelect])

  return (
    <div className={styles.itemWrapper}>
      {/* Action revealed behind the swipe */}
      <div className={`${styles.swipeAction} ${isRead ? styles.swipeUnread : styles.swipeRead}`} onClick={handleToggle}>
        {isRead ? 'mark unread' : 'mark read'}
      </div>

      <div
        ref={itemRef}
        className={styles.item}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.itemTop}>
          <span className={styles.itemDomain}>{domain}</span>
          <span className={`${styles.itemTitle} ${isRead ? styles.itemRead : ''}`}>{doc.title || doc.excerpt}</span>
          <button
            className={`${styles.hoverToggle} ${isRead ? styles.hoverToggleRead : ''}`}
            onClick={(e) => { e.stopPropagation(); handleToggle() }}
          >
            {isRead ? 'unread' : 'read'}
          </button>
        </div>
        <div className={styles.itemMeta}>
          <span>{doc.createdAt}</span>
          {isRead && <span className={styles.readBadge}>read</span>}
          {doc.tags.length > 0 && (
            <span className={styles.itemTags}>tagged: {doc.tags.join(', ')}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ReaderView({ doc, onBack }: { doc: Document; onBack: () => void }) {
  const domain = doc.source
    ? (() => { try { return new URL(doc.source).hostname } catch { return doc.source } })()
    : ''

  return (
    <PageContainer mode="search" maxWidth={720}>
      <button className={styles.backBtn} onClick={onBack}>
        &larr; reading queue
      </button>

      <article className={styles.reader}>
        <header className={styles.readerHeader}>
          <h1 className={styles.readerTitle}>{doc.title}</h1>
          <div className={styles.readerMeta}>
            {domain && <span className={styles.readerDomain}>{domain}</span>}
            <span>{doc.createdAt}</span>
            {doc.tags.length > 0 && <span>tagged: {doc.tags.join(', ')}</span>}
          </div>
          {doc.source && (
            <a
              href={doc.source}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.readerLink}
            >
              view original &rarr;
            </a>
          )}
        </header>

        <div className={styles.readerContent}>
          {doc.content}
        </div>
      </article>
    </PageContainer>
  )
}
