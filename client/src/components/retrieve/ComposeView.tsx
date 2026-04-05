import { useState, useCallback, useRef, type KeyboardEvent } from 'react'
import { PageContainer } from '@/components/ui/PageContainer'
import { ModeHeader } from '@/components/ui/ModeHeader'
import { query } from '@/lib/api'
import { useWebLLM } from '@/hooks/useWebLLM'
import styles from './ComposeView.module.css'

interface Quote {
  id: string
  text: string
  sourceType: string
  sourceName: string
  date: string
}

interface WritingPrompt {
  id: string
  question: string
  context: string
}

type ViewPhase = 'idle' | 'loading' | 'loaded'

export function ComposeView() {
  const [topic, setTopic] = useState('')
  const [phase, setPhase] = useState<ViewPhase>('idle')
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [prompts, setPrompts] = useState<WritingPrompt[]>([])
  const [removingQuotes, setRemovingQuotes] = useState<Set<string>>(new Set())
  const [removingPrompts, setRemovingPrompts] = useState<Set<string>>(new Set())
  const [showPrompts, setShowPrompts] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { generateComplete, isReady: llmReady } = useWebLLM()

  const fetchQuotes = useCallback(async () => {
    const trimmed = topic.trim()
    if (!trimmed) return

    setPhase('loading')
    setShowPrompts(false)
    setRemovingQuotes(new Set())
    setRemovingPrompts(new Set())

    try {
      // Pull real quotes from corpus via hybrid search
      const results = await query(trimmed, { limit: 5 })
      const fetchedQuotes: Quote[] = results.map((r, i) => ({
        id: `q-${i}-${Date.now()}`,
        text: r.highlights[0] || r.document.excerpt,
        sourceType: r.document.type,
        sourceName: r.document.title || r.document.source || 'untitled',
        date: r.document.createdAt,
      }))
      setQuotes(fetchedQuotes)
      setPhase('loaded')

      // Generate writing prompts via LLM if available
      if (llmReady) {
        setTimeout(async () => {
          try {
            const context = fetchedQuotes.map((q) => `"${q.text}" — ${q.sourceName}`).join('\n\n')
            const response = await generateComplete(
              'You generate thought-provoking writing prompts. Return exactly 3 prompts, each on its own line prefixed with a number. Each prompt should be a question that helps someone start writing about the topic. Be concise.',
              `Topic: ${trimmed}\n\nRelevant excerpts from the user's notes:\n${context}\n\nGenerate 3 writing prompts:`,
            )
            const lines = response.split('\n').filter((l) => l.trim().length > 5)
            const fetchedPrompts: WritingPrompt[] = lines.slice(0, 3).map((line, i) => ({
              id: `wp-${i}-${Date.now()}`,
              question: line.replace(/^\d+[\.\)]\s*/, ''),
              context: `Based on ${fetchedQuotes.length} sources from your corpus`,
            }))
            setPrompts(fetchedPrompts)
            setShowPrompts(true)
          } catch {
            setShowPrompts(false)
          }
        }, 400)
      }
    } catch {
      setQuotes([])
      setPhase('loaded')
    }
  }, [topic, llmReady, generateComplete])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        fetchQuotes()
      }
    },
    [fetchQuotes],
  )

  const removeQuote = useCallback((id: string) => {
    setRemovingQuotes((prev) => new Set(prev).add(id))
    setTimeout(() => {
      setQuotes((prev) => prev.filter((q) => q.id !== id))
      setRemovingQuotes((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 350)
  }, [])

  const removePrompt = useCallback((id: string) => {
    setRemovingPrompts((prev) => new Set(prev).add(id))
    setTimeout(() => {
      setPrompts((prev) => prev.filter((p) => p.id !== id))
      setRemovingPrompts((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 350)
  }, [])

  const regeneratePrompts = useCallback(async () => {
    if (!llmReady) return
    try {
      const context = quotes.map((q) => `"${q.text}" — ${q.sourceName}`).join('\n\n')
      const response = await generateComplete(
        'You generate thought-provoking writing prompts. Return exactly 3 prompts, each on its own line prefixed with a number. Each prompt should be a question that helps someone start writing about the topic. Be concise and creative — generate different prompts than before.',
        `Topic: ${topic.trim()}\n\nRelevant excerpts:\n${context}\n\nGenerate 3 new writing prompts:`,
      )
      const lines = response.split('\n').filter((l) => l.trim().length > 5)
      setPrompts(lines.slice(0, 3).map((line, i) => ({
        id: `wp-${i}-${Date.now()}`,
        question: line.replace(/^\d+[\.\)]\s*/, ''),
        context: `Based on ${quotes.length} sources from your corpus`,
      })))
    } catch { /* ignore */ }
  }, [topic, quotes, llmReady, generateComplete])

  const visibleQuotes = quotes.filter((q) => !removingQuotes.has(q.id))
  const visiblePrompts = prompts.filter((p) => !removingPrompts.has(p.id))

  return (
    <PageContainer mode="compose" maxWidth={640}>
      <ModeHeader category="retrieve" mode="compose">
        {phase === 'loaded' && quotes.length > 0 && (
          <span className={styles.quoteCount}>
            {quotes.length} quote{quotes.length !== 1 ? 's' : ''}
          </span>
        )}
      </ModeHeader>

      {/* Topic input */}
      <div className={styles.topicSection}>
        <div className={styles.topicLabel}>what are you writing about?</div>
        <input
          ref={inputRef}
          type="text"
          className={styles.topicInput}
          placeholder="what are you writing about?"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className={styles.topicHint}>
          enter a topic and we'll pull exact quotes from your corpus
        </div>
        <button
          className={styles.fetchBtn}
          onClick={fetchQuotes}
          disabled={!topic.trim() || phase === 'loading'}
          type="button"
        >
          Pull quotes from corpus
        </button>
      </div>

      {/* Loading */}
      {phase === 'loading' && (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
          <span className={styles.loadingText}>
            searching your corpus for relevant passages...
          </span>
        </div>
      )}

      {/* Quotes */}
      {phase === 'loaded' && (
        <div className={styles.quotesSection}>
          <div className={styles.quotesHeader}>
            <span className={styles.quotesTitle}>exact quotes from your corpus</span>
          </div>

          {visibleQuotes.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>{'\u270D'}</div>
              <div className={styles.emptyText}>
                no quotes found for this topic yet.
                <br />
                try broadening your search or adding more to your corpus.
              </div>
            </div>
          ) : (
            visibleQuotes.map((quote, i) => (
              <div
                key={quote.id}
                className={`${styles.quoteCard} ${removingQuotes.has(quote.id) ? styles.quoteCardRemoving : ''}`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <button
                  className={styles.quoteRemove}
                  onClick={() => removeQuote(quote.id)}
                  title="Remove quote"
                  type="button"
                >
                  {'\u2715'}
                </button>
                <div className={styles.quoteText}>{quote.text}</div>
                <div className={styles.quoteSource}>
                  <span className={styles.quoteSourceType}>
                    {quote.sourceType.replace('_', ' ')}
                  </span>
                  <span className={styles.quoteSourceName}>{quote.sourceName}</span>
                  <span className={styles.quoteSourceDate}>{quote.date}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Divider + Writing prompts */}
      {phase === 'loaded' && showPrompts && (
        <>
          <div className={styles.sectionDivider}>
            <span className={styles.sectionDividerLabel}>writing prompts</span>
          </div>

          <div>
            <div className={styles.questionsHeader}>
              <span className={styles.questionsTitle}>questions to guide your writing</span>
              <button
                className={styles.regenerateBtn}
                onClick={regeneratePrompts}
                type="button"
              >
                {'\u21BB'} new questions
              </button>
            </div>

            {visiblePrompts.map((prompt, i) => (
              <div
                key={prompt.id}
                className={`${styles.questionCard} ${removingPrompts.has(prompt.id) ? styles.questionCardRemoving : ''}`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <button
                  className={styles.questionRemove}
                  onClick={() => removePrompt(prompt.id)}
                  title="Remove question"
                  type="button"
                >
                  {'\u2715'}
                </button>
                <div className={styles.questionNumber}>prompt {i + 1}</div>
                <div className={styles.questionText}>{prompt.question}</div>
                <div className={styles.questionContext}>{prompt.context}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </PageContainer>
  )
}
