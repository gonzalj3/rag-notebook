import { useState, useCallback } from 'react'
import styles from './RippleContainer.module.css'

interface Ripple {
  id: number
  x: number
  y: number
}

let rippleId = 0

export function RippleContainer() {
  const [ripples, setRipples] = useState<Ripple[]>([])

  const spawn = useCallback((x: number, y: number) => {
    const id = rippleId++
    setRipples((prev) => [...prev, { id, x, y }])
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id))
    }, 1200)
  }, [])

  return { ripples, spawn, RippleOverlay: () => (
    <div className={styles.overlay}>
      {ripples.map((r) => (
        <div
          key={r.id}
          className={styles.ripple}
          style={{ left: r.x, top: r.y }}
        />
      ))}
    </div>
  )}
}

export function useRipple() {
  return RippleContainer()
}
