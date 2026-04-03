import { useState, useRef, useCallback } from 'react'

type SaveStatus = 'idle' | 'saving' | 'saved'

export function useAutoSave(delay = 800) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setStatus('saving')

    timer.current = setTimeout(() => {
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    }, delay)
  }, [delay])

  return { status, save }
}
