import { useState, useCallback } from 'react'
import styles from './CaptureButton.module.css'

interface CaptureButtonProps {
  label: string
  capturedLabel?: string
  onCapture: () => void | Promise<void>
}

type ButtonState = 'idle' | 'capturing' | 'captured'

export function CaptureButton({ label, capturedLabel = 'captured', onCapture }: CaptureButtonProps) {
  const [state, setState] = useState<ButtonState>('idle')

  const handleClick = useCallback(async () => {
    if (state !== 'idle') return
    setState('capturing')
    await onCapture()
    setState('captured')
    setTimeout(() => setState('idle'), 2000)
  }, [state, onCapture])

  return (
    <button
      className={`${styles.btn} ${styles[state]}`}
      onClick={handleClick}
      disabled={state !== 'idle'}
    >
      {state === 'idle' && label}
      {state === 'capturing' && (
        <span className={styles.spinner} />
      )}
      {state === 'captured' && (
        <>
          <span className={styles.check}>✓</span>
          {capturedLabel}
        </>
      )}
    </button>
  )
}
