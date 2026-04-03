import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { PageContainer } from '@/components/ui/PageContainer'
import { ModeHeader } from '@/components/ui/ModeHeader'
import { mockSearchResults } from '@/lib/mockData'
import type { SourceType } from '@/lib/types'
import styles from './SearchView.module.css'

type FilterKey = 'all' | SourceType

interface FilterDef {
  key: FilterKey
  label: string
}

const filters: FilterDef[] = [
  { key: 'all', label: 'all' },
  { key: 'url', label: 'articles' },
  { key: 'note', label: 'notes' },
  { key: 'handwritten', label: 'handwritten' },
  { key: 'conversation', label: 'conversations' },
  { key: 'dialogue', label: 'dialogue' },
  { key: 'takeaway', label: 'takeaways' },
]

const typeClassMap: Record<SourceType, string> = {
  url: styles.typeUrl,
  note: styles.typeNote,
  paste: styles.typePaste,
  handwritten: styles.typeHandwritten,
  conversation: styles.typeConversation,
  dialogue: styles.typeDialogue,
  book_page: styles.typeBookPage,
  takeaway: styles.typeTakeaway,
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightExcerpt(text: string, query: string): string {
  if (!query) return text
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

export function SearchView() {
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const filteredResults = useMemo(() => {
    let items = mockSearchResults

    // Filter by type
    if (activeFilter !== 'all') {
      items = items.filter((r) => r.document.type === activeFilter)
    }

    // Filter by query
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      items = items.filter((r) => {
        const text = [
          r.document.title,
          r.document.excerpt,
          r.document.tags.join(' '),
          r.document.source ?? '',
        ]
          .join(' ')
          .toLowerCase()
        return text.includes(q)
      })

      // Sort: title matches first, then by score
      items = [...items].sort((a, b) => {
        const aTitle = a.document.title.toLowerCase().includes(q) ? 1 : 0
        const bTitle = b.document.title.toLowerCase().includes(q) ? 1 : 0
        return bTitle - aTitle || b.score - a.score
      })
    }

    return items
  }, [query, activeFilter])

  const handleFilterClick = useCallback((key: FilterKey) => {
    setActiveFilter(key)
  }, [])

  return (
    <PageContainer mode="search" maxWidth={640}>
      <ModeHeader category="retrieve" mode="search" />

      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>&#x2315;</span>
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="search your knowledge\u2026"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <span className={styles.searchShortcut}>&#x2318;K</span>
      </div>

      <div className={styles.filters}>
        {filters.map((f) => (
          <span
            key={f.key}
            className={`${styles.filterChip} ${activeFilter === f.key ? styles.filterChipActive : ''}`}
            onClick={() => handleFilterClick(f.key)}
          >
            {f.label}
          </span>
        ))}
        <span className={styles.filterSpacer} />
        {filteredResults.length > 0 && (
          <span className={styles.resultCount}>
            {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className={styles.results}>
        {filteredResults.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>&#x2315;</div>
            <div className={styles.emptyText}>
              {query.trim()
                ? `nothing found for \u201c${query}\u201d`
                : 'no items in this category yet'}
            </div>
          </div>
        ) : (
          filteredResults.map((result) => {
            const doc = result.document
            const typeLabel = doc.type.replace('_', ' ')
            const typeClass = typeClassMap[doc.type] ?? ''
            const excerpt = highlightExcerpt(doc.excerpt, query.trim())

            return (
              <div key={doc.id} className={styles.resultItem}>
                <div className={styles.resultTop}>
                  <span className={`${styles.resultType} ${typeClass}`}>{typeLabel}</span>
                  <span className={styles.resultTitle}>{doc.title}</span>
                  <span className={styles.resultScore}>{result.score}%</span>
                </div>
                <div
                  className={styles.resultExcerpt}
                  dangerouslySetInnerHTML={{ __html: excerpt }}
                />
                <div className={styles.resultMeta}>
                  {doc.source && (
                    <span className={styles.resultMetaItem}>{doc.source}</span>
                  )}
                  <span className={styles.resultMetaItem}>{doc.createdAt}</span>
                  {doc.tags.map((tag) => (
                    <span key={tag} className={styles.resultTag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className={styles.resultActions}>
                  <Link
                    to="/retrieve/chat"
                    className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                  >
                    <span className={styles.actionBtnIcon}>&#x1F4AC;</span> discuss
                  </Link>
                  <Link
                    to="/retrieve/projects"
                    className={styles.actionBtn}
                  >
                    <span className={styles.actionBtnIcon}>&#x1F4C1;</span> add to project
                  </Link>
                  <button className={styles.actionBtn} type="button">
                    <span className={styles.actionBtnIcon}>&#x1F517;</span> copy link
                  </button>
                  <button className={styles.actionBtn} type="button">
                    <span className={styles.actionBtnIcon}>&#x1F4C4;</span> view full
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </PageContainer>
  )
}
