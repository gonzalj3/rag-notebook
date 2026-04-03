import { useState, useCallback, useRef, useEffect } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { ModeHeader } from '@/components/ui/ModeHeader'
import { TagRow } from '@/components/ui/TagRow'
import { CaptureButton } from '@/components/ui/CaptureButton'
import { useAutoTags } from '@/hooks/useAutoTags'
import { useCaptureStore } from '@/stores/capture'
import styles from './ThinkingView.module.css'

type ViewState = 'camera' | 'scanning' | 'review'

const MOCK_OCR_TEXT = `The key insight about transformer attention is that it computes a weighted sum over all positions in the input sequence. Each position "attends" to every other position — but the weights are learned, not fixed.

This is fundamentally different from convolution, which only looks at local neighborhoods. Attention is global from the start.

The softmax over QK^T creates a probability distribution. High dot-product similarity = high attention weight. The model learns WHAT to attend to through gradient descent.

→ Attention is not a filter. It's a routing mechanism.`

const MOCK_CONNECTION = {
  text: 'Your note from last week about embedding models — you wrote that "the representation IS the retrieval." This new note about attention as routing connects directly: the quality of attention determines what gets represented.',
  source: 'from: handwritten note \u00b7 4 days ago \u00b7 tagged: llm, learning',
}

const SCAN_DURATION = 1500

export function ThinkingView() {
  const [viewState, setViewState] = useState<ViewState>('camera')
  const [imageData, setImageData] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [reflection, setReflection] = useState('')
  const [showReflection, setShowReflection] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const ocrRef = useRef<HTMLTextAreaElement>(null)
  const reflectionRef = useRef<HTMLTextAreaElement>(null)
  const scanLineRef = useRef<HTMLDivElement>(null)

  const { classify } = useAutoTags()
  const addCapture = useCaptureStore((s) => s.addCapture)
  const updateStatus = useCaptureStore((s) => s.updateStatus)

  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const data = e.target?.result as string
      setImageData(data)
      startScan(data)
    }
    reader.readAsDataURL(file)
  }, [])

  const startScan = useCallback((_imgData: string) => {
    setViewState('scanning')

    // Restart scan line animation
    if (scanLineRef.current) {
      scanLineRef.current.style.animation = 'none'
      // Force reflow
      void scanLineRef.current.offsetHeight
      scanLineRef.current.style.animation = ''
    }

    // Transition to review after scan
    setTimeout(() => {
      setViewState('review')
      setOcrText(MOCK_OCR_TEXT)

      // Auto-tag after text appears
      const autoTags = classify(MOCK_OCR_TEXT)
      if (autoTags.length > 0) {
        setTags(autoTags)
      } else {
        setTags(['notes'])
      }
    }, SCAN_DURATION + 700)
  }, [classify])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ''
    },
    [handleFile],
  )

  const handleCapture = useCallback(async () => {
    const title =
      ocrText.length > 72 ? ocrText.substring(0, 72) + '\u2026' : ocrText
    const id = addCapture({ title, mode: 'thinking', status: 'processing' })

    await new Promise((resolve) => setTimeout(resolve, 600))

    setTimeout(() => {
      updateStatus(id, 'stored')
    }, 2500)
  }, [ocrText, addCapture, updateStatus])

  const retake = useCallback(() => {
    setViewState('camera')
    setImageData(null)
    setOcrText('')
    setReflection('')
    setShowReflection(false)
    setTags([])
  }, [])

  const handleDismissTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleAddTag = useCallback((tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
  }, [])

  const toggleReflection = useCallback(() => {
    setShowReflection((prev) => {
      if (!prev) {
        setTimeout(() => reflectionRef.current?.focus(), 150)
      }
      return !prev
    })
  }, [])

  // Auto-resize OCR textarea when text changes
  useEffect(() => {
    if (ocrRef.current && ocrText) {
      autoResize(ocrRef.current)
    }
  }, [ocrText, autoResize])

  return (
    <PageContainer mode="thinking" maxWidth={520}>
      <ModeHeader category="capture" mode="think" />

      {/* STATE 1: Camera / Upload */}
      {viewState === 'camera' && (
        <>
          <div
            className={`${styles.viewfinder} ${isDragging ? styles.viewfinderDragActive : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className={styles.viewfinderInner}>
              <div className={styles.cornerTl} />
              <div className={styles.cornerTr} />
              <div className={styles.cornerBl} />
              <div className={styles.cornerBr} />
              <div className={styles.viewfinderIcon}>📷</div>
              <div className={styles.viewfinderText}>
                tap to photograph your notes
              </div>
              <div className={styles.viewfinderHint}>
                or drag &amp; drop an image
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className={styles.fileInput}
            accept="image/*"
            capture="environment"
            onChange={handleInputChange}
          />

          <div className={styles.orDivider}>
            <span className={styles.orDividerText}>or</span>
          </div>

          <label
            className={styles.uploadBtn}
            onClick={() => uploadInputRef.current?.click()}
          >
            choose from photo library
          </label>
          <input
            ref={uploadInputRef}
            type="file"
            className={styles.fileInput}
            accept="image/*"
            onChange={handleInputChange}
          />
        </>
      )}

      {/* STATE 2: Scanning */}
      {viewState === 'scanning' && (
        <div className={styles.scanCard}>
          <div className={styles.scanImageWrap}>
            {imageData && (
              <img src={imageData} alt="Captured note" />
            )}
            <div ref={scanLineRef} className={styles.scanLine} />
          </div>
          <div className={styles.scanStatus}>scanning...</div>
        </div>
      )}

      {/* STATE 3: Review */}
      {viewState === 'review' && (
        <>
          <div className={styles.reviewCard}>
            <div className={styles.reviewPhoto}>
              {imageData && (
                <img src={imageData} alt="Your handwritten note" />
              )}
              <span className={styles.photoBadge}>
                handwritten &middot; original preserved
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
                value={ocrText}
                onChange={(e) => {
                  setOcrText(e.target.value)
                  autoResize(e.target)
                }}
                placeholder="OCR text will appear here..."
              />
              <div className={styles.editHint}>
                tap to correct if the OCR missed something
              </div>
            </div>

            <div className={styles.connection}>
              <div className={styles.connectionLabel}>
                🔗 this connects to
              </div>
              <div className={styles.connectionText}>
                {MOCK_CONNECTION.text}
              </div>
              <div className={styles.connectionSource}>
                {MOCK_CONNECTION.source}
              </div>
            </div>

            <div className={styles.reviewNoteSection}>
              <button
                className={styles.reviewNoteToggle}
                onClick={toggleReflection}
              >
                ✎ add a reflection
              </button>
              <div
                className={`${styles.reviewNoteField} ${showReflection ? styles.reviewNoteFieldOpen : ''}`}
              >
                <textarea
                  ref={reflectionRef}
                  className={styles.reviewNoteInput}
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder="what does this connect to in your thinking?"
                  rows={1}
                />
              </div>
            </div>

            <div className={styles.tagRow}>
              <TagRow
                tags={tags}
                onDismiss={handleDismissTag}
                onAdd={handleAddTag}
              />
            </div>
          </div>

          <div className={styles.captureRow}>
            <CaptureButton
              label="Save to corpus"
              capturedLabel="Saved to corpus"
              onCapture={handleCapture}
            />
          </div>

          <div className={styles.retakeRow}>
            <button className={styles.retakeBtn} onClick={retake}>
              retake photo
            </button>
          </div>
        </>
      )}
    </PageContainer>
  )
}
