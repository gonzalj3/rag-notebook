import { useThemeStore } from '@/stores/theme'
import { useEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import styles from './ThemeToggle.module.css'

export function ThemeToggle() {
  const { theme, toggle, init } = useThemeStore()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isHome = pathname === '/'

  useEffect(() => {
    init()
  }, [init])

  return (
    <button
      className={`${styles.toggle} ${isHome ? styles.home : styles.nav}`}
      onClick={toggle}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <span>☀</span> : <span>☽</span>}
    </button>
  )
}
