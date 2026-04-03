import { useThemeStore } from '@/stores/theme'
import { useEffect } from 'react'
import styles from './ThemeToggle.module.css'

export function ThemeToggle() {
  const { theme, toggle, init } = useThemeStore()

  useEffect(() => {
    init()
  }, [init])

  return (
    <button className={styles.toggle} onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? <span>☀</span> : <span>☽</span>}
    </button>
  )
}
