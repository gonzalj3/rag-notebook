import { useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { useIrisNavigate } from '@/lib/portalTransition'
import styles from './Home.module.css'

const captureTabs = [
  { to: '/capture/curation', name: 'curation', desc: 'Save and annotate articles', color: '#e8a598' },
  { to: '/capture/study', name: 'study', desc: 'Capture book pages and takeaways', color: '#e8c878' },
  { to: '/capture/dialogue', name: 'dialogue', desc: 'Reflective writing sessions', color: '#a8c898' },
] as const

const retrieveCards = [
  { to: '/retrieve/search', name: 'search', desc: 'Find anything in your corpus' },
  { to: '/retrieve/chat', name: 'chat', desc: 'Ask questions, get sourced answers' },
  { to: '/retrieve/projects', name: 'projects', desc: 'Organize into collections' },
  { to: '/retrieve/compose', name: 'compose', desc: 'Write with your corpus' },
] as const

const RING_COUNT = 18

export function Home() {
  const irisNavigate = useIrisNavigate()

  const openPortal = useCallback((e: React.MouseEvent, to: string) => {
    e.preventDefault()
    irisNavigate(to, e.clientX, e.clientY)
  }, [irisNavigate])

  return (
    <div className={styles.page}>
      <div className={styles.notebook}>
        {/* Spiral binding */}
        <div className={styles.binding}>
          {Array.from({ length: RING_COUNT }, (_, i) => (
            <div key={i} className={styles.ring} />
          ))}
        </div>

        {/* Leather header */}
        <div className={styles.leather}>
          <span className={styles.leatherTitle}>RAG Notebook</span>
          <span className={styles.leatherSub}>personal knowledge system</span>
        </div>

        {/* Tab dividers along left */}
        <div className={styles.tabs}>
          {captureTabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className={styles.tab}
              style={{ '--tab-color': tab.color } as React.CSSProperties}
              onClick={(e) => openPortal(e, tab.to)}
            >
              <span className={styles.tabLabel}>{tab.name}</span>
            </Link>
          ))}
        </div>

        {/* Paper body */}
        <div className={styles.paper}>
          <div className={styles.paperGrain} />

          <div className={styles.contents}>
            <h2 className={styles.tocTitle}>Table of Contents</h2>

            <div className={styles.sectionHeader}>capture</div>
            <div className={styles.gridCards}>
              {captureTabs.map((card) => (
                <Link
                  key={card.to}
                  to={card.to}
                  className={styles.gridCard}
                  onClick={(e) => openPortal(e, card.to)}
                >
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
                  onClick={(e) => openPortal(e, card.to)}
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
