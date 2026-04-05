/**
 * Page flip transition using page-flip (StPageFlip).
 *
 * Uses hard cover mode. Simple approach:
 * - Page 0: clone of current view
 * - Page 1: clone of destination view
 * - Opaque overlay hides the real DOM
 * - Hard flip from page 0 to page 1
 * - Clean up when done
 */

// @ts-expect-error — page-flip has no type declarations
import { PageFlip } from 'page-flip'

export function runPageFlip(onNavigate: () => void): Promise<void> {
  return new Promise((resolve) => {
    const W = window.innerWidth
    const H = window.innerHeight
    const rootEl = document.getElementById('root')
    if (!rootEl) { onNavigate(); resolve(); return }

    // 1. Clone current view
    const oldClone = rootEl.cloneNode(true) as HTMLElement
    oldClone.style.pointerEvents = 'none'

    // 2. Navigate
    onNavigate()

    // 3. Wait for paint, clone destination
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newClone = rootEl.cloneNode(true) as HTMLElement
        newClone.style.pointerEvents = 'none'

        // 4. Build overlay
        const overlay = document.createElement('div')
        overlay.style.cssText = `position:fixed;inset:0;z-index:2147483647;background:var(--bg,#f6f5f2);`

        const book = document.createElement('div')
        book.style.cssText = `width:${W}px;height:${H}px;`
        overlay.appendChild(book)

        const p0 = document.createElement('div')
        p0.setAttribute('data-density', 'hard')
        p0.style.cssText = `width:${W}px;height:${H}px;overflow:hidden;background:var(--bg,#f5efe0);`
        p0.appendChild(oldClone)

        const p1 = document.createElement('div')
        p1.setAttribute('data-density', 'hard')
        p1.style.cssText = `width:${W}px;height:${H}px;overflow:hidden;background:var(--bg,#f6f5f2);`
        p1.appendChild(newClone)

        book.appendChild(p0)
        book.appendChild(p1)
        document.body.appendChild(overlay)

        const pf = new PageFlip(book, {
          width: W,
          height: H,
          size: 'fixed',
          showCover: true,
          usePortrait: true,
          flippingTime: 1200,
          useMouseEvents: false,
          swipeDistance: 9999,
          showPageCorners: false,
          drawShadow: true,
          maxShadowOpacity: 0.5,
          startPage: 0,
          autoSize: false,
        })

        pf.loadFromHTML(book.querySelectorAll('[data-density]'))

        pf.on('flip', () => {
          setTimeout(() => {
            pf.destroy()
            overlay.remove()
            resolve()
          }, 100)
        })

        requestAnimationFrame(() => {
          pf.flipNext('bottom')
        })
      })
    })
  })
}
