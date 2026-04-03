import { type ReactNode } from 'react'
import styles from './ModeHeader.module.css'

interface ModeHeaderProps {
  category: 'capture' | 'retrieve'
  mode: string
  corpusCount?: number
  children?: ReactNode
}

export function ModeHeader({ category, mode, corpusCount = 247, children }: ModeHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>
        {category} <em className={styles.dot}>·</em> {mode}
      </h1>
      <div className={styles.right}>
        {children}
        <span className={styles.corpus}>{corpusCount} items</span>
      </div>
    </div>
  )
}
