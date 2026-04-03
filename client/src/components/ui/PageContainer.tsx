import { type ReactNode } from 'react'
import styles from './PageContainer.module.css'

interface PageContainerProps {
  mode: string
  maxWidth?: number
  children: ReactNode
}

export function PageContainer({ mode, maxWidth = 560, children }: PageContainerProps) {
  return (
    <div data-mode={mode} className={styles.page}>
      <div className={styles.container} style={{ maxWidth }}>
        {children}
      </div>
    </div>
  )
}
