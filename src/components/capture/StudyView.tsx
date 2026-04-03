import { useState, useCallback, useRef, useEffect } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { ModeHeader } from '@/components/ui/ModeHeader'
import { TagRow } from '@/components/ui/TagRow'
import { CaptureButton } from '@/components/ui/CaptureButton'
import { useAutoTags } from '@/hooks/useAutoTags'
import { mockDocuments } from '@/lib/mockData'
import { useCaptureStore } from '@/stores/capture'
import styles from './StudyView.module.css'

interface PageData {
  imageData: string
  ocrText: string
}

const SAMPLE_OCR = [
  'The most common mistake in building RAG systems is treating chunking as a solved problem. In practice, the choice of chunk size, overlap, and splitting strategy has more impact on end-to-end answer quality than the choice of embedding model or LLM. Teams that skip rigorous evaluation of their chunking pipeline pay for it later in retrieval failures they can\'t diagnose.',
  'Evaluation should not be an afterthought. The teams that ship reliable AI products build their evaluation infrastructure first, before they build the generation layer. This inverts the typical development workflow but produces dramatically better outcomes. You define what \'good\' looks like, measure your current gap, and engineer toward closing it.',
  'Hybrid retrieval combines sparse (keyword) and dense (vector) search to compensate for each method\'s blind spots. BM25 excels at exact term matching — product codes, error messages, specific names — while dense retrieval captures semantic meaning across paraphrases and synonyms. Production systems increasingly default to running both in parallel with a fusion step.',
]

const DEFAULT_SOURCES = [
  'Building AI Apps',
  'Designing Data-Intensive Applications',
]

export function StudyView() {
  // Source state
  const [sourceName, setSourceName] = useState('')
  const [activeSourceChip, setActiveSourceChip] = useState<string | null>(null)
  const [showNewSource, setShowNewSource] = useState(false)

  // Capture state
  const [pages, setPages] = useState<PageData[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [phase, setPhase] = useState<'capture' | 'review'>('capture')

  // Review state
  const [takeaway, setTakeaway] = useState('')
  const [showConnections, setShowConnections] = useState(false)
  const [tags, setTags] = useState<string[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const takeawayRef = useRef<HTMLTextAreaElement>(null)
  const ocrRef = useRef<HTMLTextAreaElement>(null)
  const connectionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thumbStripRef = useRef<HTMLDivElement>(null)

  const { classify } = useAutoTags()
  const addCapture = useCaptureStore((s) => s.addCapture)

  // Pick a connection suggestion from mock data
  const connectionDoc = mockDocuments.find((d) => d.type === 'dialogue') ?? mockDocuments[4]

  // ---- Source selection ----
  const selectChip = useCallback((name: string) => {
    setActiveSourceChip(name)
    setSourceName(name)
    setShowNewSource(false)
  }, [])

  const handleNewSourceClick = useCallback(() => {
    setShowNewSource(true)
    setActiveSourceChip(null)
    setSourceName('')
  }, [])

  // ---- File handling ----
  const addFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    imageFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const imageData = e.target?.result as string
        setPages((prev) => {
          const newPages = [...prev, { imageData, ocrText: '' }]
          // Scroll thumbnail strip to end after render
          requestAnimationFrame(() => {
            if (thumbStripRef.current) {
              thumbStripRef.current.scrollLeft = thumbStripRef.current.scrollWidth
            }
          })
          return newPages
        })
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files)
      e.target.value = ''
    }
  }, [addFiles])

  const removePage = useCallback((index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // ---- Drag and drop ----
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  // ---- Review phase ----
  const startReview = useCallback(() => {
    if (pages.length === 0) return
    // Assign simulated OCR
    setPages((prev) =>
      prev.map((p, i) => ({
        ...p,
        ocrText: p.ocrText || SAMPLE_OCR[i % SAMPLE_OCR.length],
      })),
    )
    setCurrentPage(0)
    setPhase('review')
  }, [pages.length])

  const navPage = useCallback((dir: number) => {
    setCurrentPage((prev) => {
      const next = prev + dir
      if (next < 0 || next >= pages.length) return prev
      return next
    })
  }, [pages.length])

  // Auto-resize textarea helper
  const autoResize = useCallback((el: HTMLTextAreaElement, max: number) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, max) + 'px'
  }, [])

  // OCR text for current page
  const handleOcrChange = useCallback((text: string) => {
    setPages((prev) =>
      prev.map((p, i) => (i === currentPage ? { ...p, ocrText: text } : p)),
    )
  }, [currentPage])

  // Takeaway input triggers connections after 8+ words
  const handleTakeawayChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setTakeaway(value)
    autoResize(e.target, 160)

    const wordCount = value.trim().split(/\s+/).filter((w) => w.length > 0).length
    if (wordCount >= 8) {
      if (connectionTimeout.current) clearTimeout(connectionTimeout.current)
      connectionTimeout.current = setTimeout(() => setShowConnections(true), 1000)
    } else {
      setShowConnections(false)
      if (connectionTimeout.current) clearTimeout(connectionTimeout.current)
    }
  }, [autoResize])

  // Auto-tag when entering review based on OCR text
  useEffect(() => {
    if (phase === 'review' && pages.length > 0) {
      const allText = pages.map((p) => p.ocrText).join(' ')
      const autoTags = classify(allText)
      setTags(autoTags)
    }
  }, [phase, pages, classify])

  // Build capture button label
  const captureLabel = (() => {
    const parts: string[] = []
    if (pages.length > 0) {
      parts.push(`${pages.length} page${pages.length > 1 ? 's' : ''}`)
    }
    if (takeaway.trim().length > 0) {
      parts.push('takeaway')
    }
    return parts.length > 0 ? `Capture ${parts.join(' + ')}` : 'Capture'
  })()

  // Handle capture
  const handleCapture = useCallback(async () => {
    const title = sourceName || 'Study capture'
    addCapture({ title, mode: 'study', status: 'processing' })

    // Simulate async save
    await new Promise((resolve) => setTimeout(resolve, 600))

    // Reset
    setTimeout(() => {
      setPages([])
      setCurrentPage(0)
      setTakeaway('')
      setShowConnections(false)
      setTags([])
      setSourceName('')
      setActiveSourceChip(null)
      setPhase('capture')
    }, 800)
  }, [sourceName, addCapture])

  const backToCapture = useCallback(() => {
    setPhase('capture')
  }, [])

  // ---- Render: Capture phase ----
  if (phase === 'capture') {
    return (
      <PageContainer mode="study" maxWidth={560}>
        <ModeHeader category="capture" mode="study" />

        {/* Source selector */}
        <div className={styles.sourceSection}>
          <div className={styles.sourceLabel}>source</div>
          <div className={styles.sourceChips}>
            {DEFAULT_SOURCES.map((name) => (
              <button
                key={name}
                className={`${styles.sourceChip} ${activeSourceChip === name ? styles.sourceChipActive : ''}`}
                onClick={() => selectChip(name)}
              >
                {name}
              </button>
            ))}
            <button
              className={`${styles.sourceChip} ${showNewSource ? styles.sourceChipActive : ''}`}
              onClick={handleNewSourceClick}
            >
              + new source
            </button>
          </div>
          {showNewSource && (
            <input
              type="text"
              className={styles.sourceInput}
              placeholder="book title, article, paper..."
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              autoFocus
            />
          )}
        </div>

        {/* Viewfinder / file drop */}
        <div
          className={`${styles.viewfinder} ${dragOver ? styles.viewfinderDragOver : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={styles.viewfinderInner}>
            <div className={`${styles.corner} ${styles.cornerTl}`} />
            <div className={`${styles.corner} ${styles.cornerTr}`} />
            <div className={`${styles.corner} ${styles.cornerBl}`} />
            <div className={`${styles.corner} ${styles.cornerBr}`} />
            <div className={styles.viewfinderIcon}>📖</div>
            <div className={styles.viewfinderText}>photograph a page</div>
            <div className={styles.viewfinderHint}>capture multiple pages in sequence</div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className={styles.fileInput}
          accept="image/*"
          multiple
          onChange={handleFileChange}
        />

        {/* Thumbnail strip */}
        {pages.length > 0 && (
          <>
            <div ref={thumbStripRef} className={styles.thumbStrip}>
              {pages.map((page, i) => (
                <div
                  key={i}
                  className={styles.thumb}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <img className={styles.thumbImg} src={page.imageData} alt={`Page ${i + 1}`} />
                  <span className={styles.thumbNumber}>{i + 1}</span>
                  <button
                    className={styles.thumbRemove}
                    onClick={(e) => {
                      e.stopPropagation()
                      removePage(i)
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.captureCount}>
              {pages.length === 1 ? '1 page captured' : `${pages.length} pages captured`}
            </div>
          </>
        )}

        {/* Review button */}
        {pages.length > 0 && (
          <button className={styles.reviewBtn} onClick={startReview}>
            Review &amp; annotate
          </button>
        )}
      </PageContainer>
    )
  }

  // ---- Render: Review phase ----
  const currentPageData = pages[currentPage]

  return (
    <PageContainer mode="study" maxWidth={560}>
      <ModeHeader category="capture" mode="study" />

      {/* Review card with page nav + image + OCR */}
      <div className={styles.reviewCard}>
        <div className={styles.pageNav}>
          <button
            className={styles.pageNavBtn}
            disabled={currentPage === 0}
            onClick={() => navPage(-1)}
          >
            &larr; prev
          </button>
          <span className={styles.pageIndicator}>
            page {currentPage + 1} of {pages.length}
          </span>
          <button
            className={styles.pageNavBtn}
            disabled={currentPage === pages.length - 1}
            onClick={() => navPage(1)}
          >
            next &rarr;
          </button>
        </div>

        <div className={styles.reviewPhoto}>
          <img
            className={styles.reviewPhotoImg}
            src={currentPageData?.imageData}
            alt={`Page ${currentPage + 1}`}
          />
          <span className={styles.photoBadge}>
            page {currentPage + 1} of {pages.length} &middot; original preserved
          </span>
        </div>

        <div className={styles.reviewTextSection}>
          <div className={styles.reviewLabel}>
            <span className={styles.statusDot} />
            extracted text
          </div>
          <textarea
            ref={ocrRef}
            className={styles.extractedText}
            value={currentPageData?.ocrText ?? ''}
            onChange={(e) => {
              handleOcrChange(e.target.value)
              autoResize(e.target, 300)
            }}
            placeholder="OCR text will appear here..."
          />
        </div>
      </div>

      {/* Takeaway section */}
      <div className={styles.takeawaySection}>
        <div className={styles.takeawayLabel}>your takeaway</div>
        <div className={styles.takeawayPrompt}>
          What did you learn from this? Put it in your own words — the act of
          reformulating is where learning happens.
        </div>
        <textarea
          ref={takeawayRef}
          className={styles.takeawayInput}
          value={takeaway}
          onChange={handleTakeawayChange}
          placeholder="in my own words, the key insight here is..."
          rows={2}
        />
        <div className={styles.takeawayHint}>
          this gets embedded as your interpretation, separate from the source text
        </div>
      </div>

      {/* Connection suggestions */}
      <div className={`${styles.connectionSection} ${showConnections ? styles.connectionVisible : ''}`}>
        <div className={styles.connectionItem}>
          <div className={styles.connectionLabel}>from your corpus</div>
          <div className={styles.connectionText}>
            {connectionDoc.excerpt}
          </div>
          <div className={styles.connectionSource}>
            from: {connectionDoc.type} &middot; {connectionDoc.createdAt} &middot; tagged: {connectionDoc.tags.join(', ')}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className={styles.tagSection}>
        <TagRow
          tags={tags}
          onDismiss={(tag) => setTags((prev) => prev.filter((t) => t !== tag))}
          onAdd={(tag) => setTags((prev) => [...prev, tag])}
        />
      </div>

      {/* Capture button */}
      <CaptureButton
        label={captureLabel}
        capturedLabel={`saved ${pages.length} page${pages.length > 1 ? 's' : ''} + takeaway`}
        onCapture={handleCapture}
      />

      {/* Back button */}
      <button className={styles.backBtn} onClick={backToCapture}>
        &larr; capture more pages
      </button>
    </PageContainer>
  )
}
