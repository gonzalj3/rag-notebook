import { useRouter } from '@tanstack/react-router'
import { flushSync } from 'react-dom'
import { useCallback } from 'react'

export function useIrisNavigate() {
  const router = useRouter()

  const irisNavigate = useCallback((to: string, x: number, y: number) => {
    // Fallback: instant navigation if API unsupported
    if (!document.startViewTransition) {
      router.navigate({ to })
      return
    }

    // Radius must reach the farthest corner from click point
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )

    // The browser snapshots the current page, then we swap the DOM
    const transition = document.startViewTransition(() => {
      flushSync(() => {
        router.navigate({ to })
      })
    })

    // Once both snapshots are ready, animate the new page as an expanding circle
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 3500,
          easing: 'cubic-bezier(0.25, 0, 0.05, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      )
    })
  }, [router])

  return irisNavigate
}
