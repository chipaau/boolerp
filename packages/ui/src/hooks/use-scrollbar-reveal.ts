import { useEffect } from "react"

const THUMB = 76
const PAD = 3

/**
 * The theme scrollbar. Native bars are hidden in globals.css; this draws one fixed-length pill
 * beside whichever pane is scrolling, at the position a proportional thumb would sit, and hides
 * it a moment after the movement stops (the macOS overlay feel, on every platform). Vertical only,
 * and an indicator rather than a control: wheel, trackpad and keys do the scrolling. Call once at
 * the app root.
 */
export function useScrollbarReveal(lingerMs = 900) {
  useEffect(() => {
    const thumb = document.createElement("div")
    thumb.setAttribute("data-scroll-thumb", "")
    document.body.appendChild(thumb)
    let timer = 0

    function place(el: Element) {
      const root = el === document.documentElement
      const rect = root ? new DOMRect(0, 0, window.innerWidth, window.innerHeight) : el.getBoundingClientRect()
      const max = el.scrollHeight - el.clientHeight
      const track = rect.height - PAD * 2 - THUMB
      // e.g. the router nudging a page that has nothing to scroll: leave the pill as it is
      if (max <= 1 || track <= 0) return
      thumb.style.top = `${rect.top + PAD + (el.scrollTop / max) * track}px`
      thumb.style.left = `${rect.right - PAD - 4}px`
      thumb.setAttribute("data-on", "")
    }

    function onScroll(e: Event) {
      const t = e.target
      const el = t === document ? document.documentElement : t instanceof Element ? t : null
      if (!el || el.scrollHeight - el.clientHeight <= 1) return
      place(el)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => thumb.removeAttribute("data-on"), lingerMs)
    }

    document.addEventListener("scroll", onScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true })
      window.clearTimeout(timer)
      thumb.remove()
    }
  }, [lingerMs])
}
