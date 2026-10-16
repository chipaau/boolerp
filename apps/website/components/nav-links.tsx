'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ChevronDown } from 'lucide-react'
import { HexGlyph } from '@workspace/ui/components/hex-glyph'
import { HandStroke } from './hand-stroke'

gsap.registerPlugin(useGSAP)

// the page's own sections: the site is the one page about the workspace, so the menu goes to its parts
const NAV: { label: string; href: string; menu?: boolean }[] = [
  { label: 'Workspace', href: '#workspace' },
  { label: 'Built for the Maldives', href: '#local' },
  { label: 'Deployment', href: '#deployment' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Contact', href: '#contact' },
]

/**
 * Timing (seconds). Hover feedback should be mostly there within about 0.3 s and done by about 0.6 s,
 * so the stroke under a new item arrives about 0.6 s after the pointer does.
 */
const T = { gather: 0.2, jump: 0.3, drop: 0.22, draw: 0.3, leave: 0.22 } as const

// a stroke's reveal (a clip-path wipe; the insets past its edges keep the round caps)
const HIDDEN = 'inset(-50% 105% -50% -5%)' // nothing left of it, gathered at its start
const DRAWN = 'inset(-50% -5% -50% -5%)'
const GATHERED_END = 'inset(-50% -5% -50% 105%)' // nothing left of it, gathered at its end

type Point = { x: number; y: number }

/**
 * The header's sections. A small amber hexagon (the brand mark) marks the one the pointer is on:
 * it drops onto the start of the item's baseline, splats flat on landing and becomes the site's
 * hand-drawn stroke, which runs out under the item from left to right. Moving to another item, the
 * stroke gathers back into the hexagon at its end nearest the new one, and the hexagon jumps across
 * on a short arc, turning a sixth (so it lands as the same hexagon), and splats into that item's
 * stroke. Leaving the menu, the stroke gathers up and the hexagon pops off. Every move starts from
 * wherever the last one was, so quick passes never jump. Keyboard focus does the same; reduced
 * motion shows the stroke without the hexagon or the wipe. Without script, plain CSS hover
 * (globals.css, .nav-stroke) draws the stroke.
 */
export function NavLinks() {
  const nav = useRef<HTMLElement>(null)
  const hex = useRef<HTMLSpanElement>(null)
  const current = useRef<HTMLElement | null>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)

  const { contextSafe } = useGSAP(
    () => {
      nav.current?.setAttribute('data-live', '') // from here on the hexagon draws the strokes, not CSS hover
      gsap.set(hex.current, { xPercent: -50, yPercent: -50, autoAlpha: 0 })
    },
    { scope: nav },
  )

  const strokeOf = (label: HTMLElement) => label.querySelector<SVGSVGElement>('.nav-stroke')!
  /** Where an item's stroke starts and ends, in the menu's own coordinates (its baseline). */
  const ends = (label: HTMLElement) => {
    const r = label.getBoundingClientRect()
    const o = nav.current!.getBoundingClientRect()
    const y = r.bottom - o.top + 0.5
    return { start: { x: r.left - o.left + r.width * 0.015, y }, end: { x: r.right - o.left - r.width * 0.015, y } }
  }
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  const inFlight = () => Number(gsap.getProperty(hex.current, 'opacity')) > 0.5
  /** Clears any stroke a cut-short move left part drawn, other than those in `keep`. */
  const tidy = (keep: (HTMLElement | null)[]) =>
    nav.current!.querySelectorAll<HTMLElement>('[data-nav-label]').forEach((l) => {
      if (!keep.includes(l)) gsap.to(strokeOf(l), { clipPath: HIDDEN, duration: 0.2, ease: 'power1.out', overwrite: true })
    })

  /** The stroke draws itself back into the hexagon, which re-forms at `at` (one of the stroke's ends). */
  const gather = (t: gsap.core.Timeline, label: HTMLElement, toEnd: boolean, at: Point) => {
    t.to(strokeOf(label), { clipPath: toEnd ? GATHERED_END : HIDDEN, duration: T.gather, ease: 'power2.in' }, 0)
      .set(hex.current, { x: at.x, y: at.y, rotation: 0, scaleX: 1.9, scaleY: 0.32, autoAlpha: 0 }, 0)
      .to(hex.current, { autoAlpha: 1, scaleX: 1, scaleY: 1, duration: T.gather * 0.7, ease: 'back.out(2)' }, T.gather * 0.5)
      .set(strokeOf(label), { clipPath: HIDDEN }, T.gather)
    return T.gather
  }
  /** The hexagon lands at the start of `label`'s baseline, splats flat and runs out as its stroke. */
  const splat = (t: gsap.core.Timeline, label: HTMLElement, at: number) => {
    t.to(hex.current, { scaleX: 1.9, scaleY: 0.32, duration: 0.08, ease: 'power2.out' }, at)
      .fromTo(strokeOf(label), { clipPath: HIDDEN }, { clipPath: DRAWN, duration: T.draw, ease: 'power2.out' }, at + 0.02)
      .to(hex.current, { autoAlpha: 0, duration: 0.1, ease: 'power1.out' }, at + 0.04)
  }

  const go = contextSafe((label: HTMLElement | null) => {
    if (!label || label === current.current) return
    tl.current?.kill()
    const from = current.current
    current.current = label
    tidy([from, label])
    if (still()) {
      if (from) gsap.set(strokeOf(from), { clipPath: HIDDEN })
      gsap.set(strokeOf(label), { clipPath: DRAWN })
      return
    }
    const to = ends(label).start
    const t = gsap.timeline()
    tl.current = t
    let at = 0
    if (from || inFlight()) {
      // from where the hexagon is now: in the air (a move cut short), or re-formed from the last stroke
      let start: Point = { x: Number(gsap.getProperty(hex.current, 'x')), y: Number(gsap.getProperty(hex.current, 'y')) }
      if (from && !inFlight()) {
        const e = ends(from)
        const toEnd = to.x > e.start.x
        start = toEnd ? e.end : e.start
        at = gather(t, from, toEnd, start)
      } else if (from) {
        t.to(strokeOf(from), { clipPath: HIDDEN, duration: T.gather, ease: 'power1.out' }, 0)
      }
      const hop = Math.min(16, 6 + Math.abs(to.x - start.x) * 0.06)
      t.to(hex.current, { x: to.x, duration: T.jump, ease: 'power1.inOut' }, at)
        .to(hex.current, { keyframes: { y: [start.y, Math.min(start.y, to.y) - hop, to.y], easeEach: 'sine.inOut' }, duration: T.jump, ease: 'none' }, at)
        .to(hex.current, { rotation: `+=${to.x > start.x ? 60 : -60}`, duration: T.jump, ease: 'power1.inOut' }, at)
      at += T.jump
    } else {
      // the first item: the hexagon drops onto it
      t.set(hex.current, { x: to.x, y: to.y - 16, rotation: 0, scaleX: 1, scaleY: 1, autoAlpha: 0 }, 0)
        .to(hex.current, { autoAlpha: 1, duration: 0.1, ease: 'none' }, 0)
        .to(hex.current, { y: to.y, duration: T.drop, ease: 'power2.in' }, 0)
      at = T.drop
    }
    splat(t, label, at)
  })

  const leave = contextSafe(() => {
    const from = current.current
    if (!from) return
    current.current = null
    tl.current?.kill()
    tidy([from])
    if (still()) return void gsap.set(strokeOf(from), { clipPath: HIDDEN })
    const t = gsap.timeline()
    tl.current = t
    let at = 0
    if (!inFlight()) at = gather(t, from, false, ends(from).start)
    else t.to(strokeOf(from), { clipPath: HIDDEN, duration: T.gather, ease: 'power1.out' }, 0)
    t.to(hex.current, { y: '-=14', autoAlpha: 0, duration: T.leave, ease: 'power2.in' }, at)
  })

  const labelOf = (e: { currentTarget: HTMLElement }) => e.currentTarget.querySelector<HTMLElement>('[data-nav-label]')

  return (
    <nav ref={nav} aria-label="Main" onPointerLeave={leave} className="relative mx-auto hidden items-center gap-9 text-[15px] text-body lg:flex">
      {NAV.map((item) => (
        <a
          key={item.label}
          href={item.href}
          onPointerEnter={(e) => go(labelOf(e))}
          onFocus={(e) => go(labelOf(e))}
          onBlur={leave}
          className="nav-item flex items-center gap-1.5 py-2 outline-none transition-colors duration-300 hover:text-foreground focus-visible:text-foreground"
        >
          <span data-nav-label="" className="relative">
            {item.label}
            <HandStroke className="nav-stroke" weight={1.75} />
          </span>
          {item.menu && <ChevronDown className="size-4" strokeWidth={1.7} />}
        </a>
      ))}
      <span ref={hex} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 text-(--brand-soft) opacity-0 will-change-transform">
        <HexGlyph size={8} className="block" />
      </span>
    </nav>
  )
}
