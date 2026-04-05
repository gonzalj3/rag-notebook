import { useRouter } from '@tanstack/react-router'
import { flushSync } from 'react-dom'
import { useCallback } from 'react'
import { runPageFlip } from './pageCurl'

export type TransitionType = 'iris' | 'page-turn'

export function useTransitionNavigate() {
  const router = useRouter()

  const navigate = useCallback((
    to: string,
    type: TransitionType,
    coords?: { x: number; y: number },
  ) => {
    if (type === 'iris') {
      if (!document.startViewTransition) {
        router.navigate({ to })
        return
      }

      const transition = document.startViewTransition(() => {
        flushSync(() => {
          router.navigate({ to })
        })
      })

      transition.ready.then(() => {
        const x = coords?.x ?? window.innerWidth / 2
        const y = coords?.y ?? window.innerHeight / 2
        // Radius = distance from click to the farthest viewport corner
        // This is exactly enough to cover the screen — no wasted animation time
        const endRadius = Math.ceil(Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        ))

        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 1200,
            easing: 'cubic-bezier(0.25, 0, 0.05, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        )
      })
    } else if (type === 'page-turn') {
      // Clone the current view, navigate, then curl the clone away
      // revealing the destination page underneath
      runPageFlip(() => router.navigate({ to }))
    }
  }, [router])

  return navigate
}
