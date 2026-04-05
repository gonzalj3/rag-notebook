import { Link, useRouterState } from '@tanstack/react-router'
import styles from './Navigation.module.css'

const captureRoutes = [
  { to: '/capture/curation', label: 'curation' },
  { to: '/capture/study', label: 'study' },
  { to: '/capture/dialogue', label: 'dialogue' },
] as const

const retrieveRoutes = [
  { to: '/retrieve/search', label: 'search' },
  { to: '/retrieve/chat', label: 'chat' },
  { to: '/retrieve/projects', label: 'projects' },
  { to: '/retrieve/compose', label: 'compose' },
] as const

export function Navigation() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isHome = pathname === '/'

  if (isHome) return null

  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.brand}>RAG Notebook</Link>
      <div className={styles.groups}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>capture</span>
          {captureRoutes.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className={`${styles.link} ${pathname === r.to ? styles.active : ''}`}
            >
              {r.label}
            </Link>
          ))}
        </div>
        <div className={styles.group}>
          <span className={styles.groupLabel}>retrieve</span>
          {retrieveRoutes.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className={`${styles.link} ${pathname === r.to ? styles.active : ''}`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
