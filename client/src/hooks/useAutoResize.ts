import { useCallback, useRef } from 'react'

export function useAutoResize() {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  const refCallback = useCallback((node: HTMLTextAreaElement | null) => {
    ref.current = node
    if (node) {
      node.style.height = 'auto'
      node.style.height = node.scrollHeight + 'px'
    }
  }, [])

  const resize = useCallback(() => {
    const el = ref.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [])

  return { ref: refCallback, resize }
}
