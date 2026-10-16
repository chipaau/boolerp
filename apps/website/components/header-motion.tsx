'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { cn } from '@workspace/ui/lib/utils'

gsap.registerPlugin(ScrollTrigger)

/** How far the visitor scrolls one way before the header follows (px): small moves and snaps leave it be. */
const SLACK = 24

/**
 * The header's behaviour, as a data attribute its classes read: scrolling down it slides away, and
 * scrolling back up it returns.
 */
export function HeaderMotion({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const header = ref.current
    if (!header) return
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
    }
    update(scrollY)

    const trigger = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => update(self.scroll()) })
    return () => trigger.kill()
  }, [])

  return (
    <header
      ref={ref}
      data-hidden="false"
      className={cn(
        'group/header fixed inset-x-0 top-0 z-50 transition-[translate] duration-300 ease-out',
        'data-[hidden=true]:-translate-y-full',
        // and out of the way while the hero's scroll story is under way (story.ts sets data-story)
        '[html[data-story=on]_&]:-translate-y-full',
        // and while a pinned section holds the screen (office.tsx, tickets.tsx set data-pinned)
        '[html[data-pinned]_&]:-translate-y-full',
        className,
      )}
    >
      {children}
    </header>
  )
}
