import styles from './FetchIndicator.module.css'

interface FetchIndicatorProps {
  active: boolean
  text: string
}

export function FetchIndicator({ active, text }: FetchIndicatorProps) {
  if (!active) return null

  return (
    <div className={styles.indicator}>
      <span className={styles.spinner} />
      <span className={styles.text}>{text}</span>
    </div>
  )
}
