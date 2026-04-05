import { useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { useTransitionNavigate } from '@/lib/transitions'
import styles from './Home.module.css'

const captureCards = [
  { to: '/capture/curation', name: 'curation', desc: 'Save and annotate articles', color: '#e8a598' },
  { to: '/capture/study', name: 'study', desc: 'Capture book pages and takeaways', color: '#e8c878' },
  { to: '/capture/dialogue', name: 'notes', desc: 'Reflective writing sessions', color: '#a8c898' },
] as const

const retrieveCards = [
  { to: '/retrieve/queue', name: 'reading queue', desc: 'Your saved articles and blog posts' },
  { to: '/retrieve/search', name: 'search', desc: 'Find anything in your corpus' },
  { to: '/retrieve/chat', name: 'chat', desc: 'Ask questions, get sourced answers' },
  { to: '/retrieve/projects', name: 'projects', desc: 'Organize into collections' },
  { to: '/retrieve/compose', name: 'compose', desc: 'Write with your corpus' },
] as const

export function Home() {
  const navigate = useTransitionNavigate()

  const turnPage = useCallback((e: React.MouseEvent, to: string) => {
    e.preventDefault()
    navigate(to, 'iris', { x: e.clientX, y: e.clientY })
  }, [navigate])

  return (
    <div className={styles.page}>
      <div className={styles.notebook}>
        {/* Leather header */}
        <div className={styles.leather}>
          <span className={styles.leatherTitle}>RAG Notebook</span>
          <span className={styles.leatherSub}>personal knowledge system</span>
        </div>

        {/* Paper body */}
        <div className={styles.paper}>
          <div className={styles.paperGrain} />

          <div className={styles.contents}>
            <h2 className={styles.tocTitle}>Table of Contents</h2>

            <div className={styles.sectionHeader}>capture</div>
            <div className={styles.gridCards}>
              {captureCards.map((card) => (
                <Link
                  key={card.to}
                  to={card.to}
                  className={styles.gridCard}
                  onClick={(e) => turnPage(e, card.to)}
                >
                  <span className={styles.gridCardTab} style={{ background: card.color }} />
                  <div className={styles.gridCardTitle}>{card.name}</div>
                  <div className={styles.gridCardDesc}>{card.desc}</div>
                </Link>
              ))}
            </div>

            <div className={styles.sectionHeader}>retrieve</div>
            <div className={styles.gridCards}>
              {retrieveCards.map((card) => (
                <Link
                  key={card.to}
                  to={card.to}
                  className={styles.gridCard}
                  onClick={(e) => turnPage(e, card.to)}
                >
                  <div className={styles.gridCardTitle}>{card.name}</div>
                  <div className={styles.gridCardDesc}>{card.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Page stack shadow */}
        <div className={styles.pageStack} />
      </div>
    </div>
  )
}
