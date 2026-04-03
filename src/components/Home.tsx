import { Link } from '@tanstack/react-router'
import styles from './Home.module.css'

const captureCards = [
  { to: '/capture/browsing', icon: '🌐', name: 'browsing', desc: 'Paste tweets, links, thoughts' },
  { to: '/capture/thinking', icon: '📷', name: 'thinking', desc: 'Photograph handwritten notes' },
  { to: '/capture/curation', icon: '📑', name: 'curation', desc: 'Save and annotate articles' },
  { to: '/capture/dialogue', icon: '✍', name: 'dialogue', desc: 'Reflective writing sessions' },
  { to: '/capture/study', icon: '📚', name: 'study', desc: 'Capture book pages and takeaways' },
  { to: '/capture/conversation', icon: '💬', name: 'conversation', desc: 'Import LLM conversations' },
] as const

const retrieveCards = [
  { to: '/retrieve/search', icon: '🔍', name: 'search', desc: 'Find anything in your corpus' },
  { to: '/retrieve/chat', icon: '🗣', name: 'chat', desc: 'Ask questions, get sourced answers' },
  { to: '/retrieve/projects', icon: '📁', name: 'projects', desc: 'Organize into collections' },
  { to: '/retrieve/compose', icon: '🖊', name: 'compose', desc: 'Write with your corpus' },
] as const

export function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>RAG Notebook</h1>
          <p className={styles.subtitle}>your personal knowledge system</p>
          <span className={styles.corpus}>247 items in corpus</span>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>capture</h2>
          <div className={styles.grid}>
            {captureCards.map((card) => (
              <Link key={card.to} to={card.to} className={styles.card}>
                <span className={styles.cardIcon}>{card.icon}</span>
                <div className={styles.cardInfo}>
                  <span className={styles.cardName}>{card.name}</span>
                  <span className={styles.cardDesc}>{card.desc}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>retrieve</h2>
          <div className={styles.grid}>
            {retrieveCards.map((card) => (
              <Link key={card.to} to={card.to} className={styles.card}>
                <span className={styles.cardIcon}>{card.icon}</span>
                <div className={styles.cardInfo}>
                  <span className={styles.cardName}>{card.name}</span>
                  <span className={styles.cardDesc}>{card.desc}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
