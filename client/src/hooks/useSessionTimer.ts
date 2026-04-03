import { useState, useEffect, useRef } from 'react'

export function useSessionTimer() {
  const [elapsed, setElapsed] = useState('0:00')
  const startTime = useRef(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime.current) / 1000)
      const mins = Math.floor(diff / 60)
      const secs = diff % 60
      setElapsed(`${mins}:${secs.toString().padStart(2, '0')}`)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return elapsed
}
