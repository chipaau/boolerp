'use client'

import { useRef } from 'react'
import type { ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * Content that comes up into place as it scrolls into view: every element inside marked
 * `data-rise` (a heading, a card) rises a little and fades in, once, those that arrive together one
 * after another. For sections that scroll by; the pinned ones tell their own story. With reduced
 * motion, or before the script runs, everything is simply there.
 */
export function Rise({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const items = gsap.utils.toArray<HTMLElement>('[data-rise]', root.current)
        gsap.set(items, { autoAlpha: 0, y: 28 })
        ScrollTrigger.batch(items, {
          start: 'top 88%',
          once: true,
          onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, overwrite: true }),
        })
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  )
}
