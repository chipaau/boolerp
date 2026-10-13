'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { cn } from '@workspace/ui/lib/utils'

gsap.registerPlugin(ScrollTrigger)

/** How far the visitor scrolls one way before the header follows (px): small moves and snaps leave it be. */
const SLACK = 24

/**
 * The header's behaviour, as data attributes its classes read: at the top it sits on the hero
 * with nothing behind it; scrolling down it slides away, and scrolling back up it returns on a
 * frosted bar. Its Get started (`[data-header-cta]`) comes in only once the hero's own buttons are
 * out of view, so the page never offers two at once.
 */
export function HeaderMotion({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const header = ref.current
    if (!header) return
    const cta = header.querySelector<HTMLElement>('[data-header-cta]')
    // where the hero's buttons leave the view (measured from the top of the page, before any scroll)
    let ctaGoneAt = innerHeight * 0.6
    const measure = () => {
      const heroCta = document.querySelector('[data-hero-reveal="cta"]')
      if (heroCta && scrollY < 8) ctaGoneAt = Math.min(heroCta.getBoundingClientRect().bottom - header.offsetHeight, innerHeight * 0.6)
    }
    measure()

    let shown = true
    let anchor = scrollY
    const update = (y: number) => {
      if (y < 8) {
        shown = true
        anchor = y
      } else if (shown && y > anchor + SLACK) {
        shown = false
        anchor = y
      } else if (!shown && y < anchor - SLACK) {
        shown = true
        anchor = y
      } else if (shown ? y < anchor : y > anchor) anchor = y // follow the furthest point in the current direction
      header.dataset.hidden = String(!shown)
      header.dataset.floating = String(y >= 8)
      const offer = y > ctaGoneAt
      header.dataset.cta = String(offer)
      if (cta) cta.inert = !offer
    }
    update(scrollY)

    const trigger = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => update(self.scroll()), onRefresh: measure })
    return () => trigger.kill()
  }, [])

  return (
    <header
      ref={ref}
      data-hidden="false"
      data-floating="false"
      data-cta="false"
      className={cn(
        'group/header fixed inset-x-0 top-0 z-50 transition-[translate,background-color] duration-300 ease-out',
        'data-[hidden=true]:-translate-y-full data-[floating=true]:bg-background/85 data-[floating=true]:backdrop-blur-md',
        // and out of the way while the hero's scroll story is under way (story.ts sets data-story)
        '[html[data-story=on]_&]:-translate-y-full',
        className,
      )}
    >
      {children}
    </header>
  )
}
