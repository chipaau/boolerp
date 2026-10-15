'use client'

import { useRef } from 'react'
import type { ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Currency } from './illustrations'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const img = (src: string, alt: string, className = '') => (
  // decoded up front: these start hidden, and a lazily decoded image in a hidden box may not be ready when it is shown
  <img src={src} alt={alt} loading="eager" decoding="sync" draggable={false} className={`h-auto w-full select-none ${className}`} />
)

/** Atoll, island and ward as three layers that spread apart as the point comes forward. */
function Geography() {
  return (
    <div className="relative mx-auto w-[78%]">
      <div data-geo="ward" className="relative z-0">{img('/local/ward.webp', '')}</div>
      <div data-geo="island" className="absolute inset-x-0 top-0 z-10 -translate-y-[38%]">{img('/local/island.webp', '')}</div>
      <div data-geo="atoll" className="absolute inset-x-0 top-0 z-20 -translate-y-[76%]">{img('/local/atoll.webp', 'Atoll, island and ward, stacked as layers')}</div>
    </div>
  )
}

/**
 * The local points, written for the first market (the Maldives) but true of any country: its
 * geography, identity provider and currencies are data per country, so the same point holds when
 * another country's are added.
 */
const POINTS: { id: string; title: string; body: string; art: ReactNode }[] = [
  { id: 'geography', title: 'Local geography', body: 'Atoll, island and ward, kept as data for each country, with a global fallback for foreign entities.', art: <Geography /> },
  { id: 'identity', title: 'eFaas-ready', body: 'National identity verification through eFaas, kept separate from core identity. Another country’s provider plugs in the same way.', art: img('/local/identity.webp', 'An identity card verified against a fingerprint') },
  { id: 'currency', title: 'MVR & USD', body: 'Multi-currency money with captured exchange rates, MVR by default.', art: <div className="mx-auto w-[70%]"><Currency /></div> },
  { id: 'oversight', title: 'Oversight built in', body: 'Parent organisations see across their authorised branches and affiliated facilities.', art: img('/local/oversight.webp', 'A parent office linked to its branches') },
  { id: 'audit', title: 'Audit & lifecycle', body: 'Institutional-grade audit, per-organisation data lifecycle and prompt access revocation.', art: img('/local/audit.webp', 'Records protected by a shield, with their history') },
]

/** Where the islands sit on the chain (fractions of the map), for their little lights. */
const LIGHTS: [number, number][] = [[0.5, 0.16], [0.54, 0.24], [0.59, 0.32], [0.61, 0.38], [0.6, 0.46], [0.62, 0.57], [0.47, 0.68], [0.5, 0.76], [0.54, 0.89]]

/**
 * "Built for the Maldives". On desktop the section is pinned: the story panel on the left (title,
 * intro, the points as a list; the current one opens), the current point's illustration in the
 * middle, and the island chain on the right scrolling slowly by, its islands' lights blinking, the
 * sea moving and a boat sailing down it as the visitor moves through the points. Follows the scroll
 * freely. Below lg, and with reduced motion, nothing is pinned: every point, with its illustration.
 */
export function Local() {
  const section = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const q = gsap.utils.selector(section)
        section.current?.setAttribute('data-live', '')
        const parts = (id: string) => ({ art: q(`[data-local-art="${id}"]`), item: q(`[data-local-item="${id}"]`), detail: q(`[data-local-detail="${id}"]`) })
        POINTS.forEach((p, i) => {
          const s = parts(p.id)
          gsap.set(s.art, { autoAlpha: i === 0 ? 1 : 0, y: i === 0 ? 0 : 30 })
          gsap.set(s.detail, i === 0 ? { height: 'auto', autoAlpha: 1 } : { height: 0, autoAlpha: 0 })
        })
        // the geography layers start together and spread as the section arrives
        gsap.fromTo(q('[data-geo="island"]'), { yPercent: 18 }, { yPercent: 0, scrollTrigger: { trigger: section.current, start: 'top 80%', end: 'top 10%', scrub: true } })
        gsap.fromTo(q('[data-geo="atoll"]'), { yPercent: 36 }, { yPercent: 0, scrollTrigger: { trigger: section.current, start: 'top 80%', end: 'top 10%', scrub: true } })

        const tl = gsap.timeline()
        // the list's starting state lives in the timeline, so a refresh re-renders it correctly
        POINTS.forEach((p, i) => tl.set(parts(p.id).item, { '--on': i === 0 ? 1 : 0 }, 0))
        POINTS.slice(1).forEach((p, k) => {
          const from = parts(POINTS[k].id)
          const to = parts(p.id)
          const at = k + 0.3
          // a quick crossfade, so there is always an illustration on screen
          tl.fromTo(from.art, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -24, duration: 0.2, ease: 'power1.in', immediateRender: false }, at)
            .to(from.item, { '--on': 0, duration: 0.2 }, at)
            .to(from.detail, { height: 0, autoAlpha: 0, duration: 0.2, ease: 'power2.inOut' }, at)
            .fromTo(to.art, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power1.out', immediateRender: false }, at + 0.08)
            .to(to.item, { '--on': 1, duration: 0.2 }, at + 0.08)
            .to(to.detail, { height: 'auto', autoAlpha: 1, duration: 0.22, ease: 'power2.out' }, at + 0.1)
        })
        tl.to({}, { duration: 0.4 })
        // the islands scroll by, and the boat sails down the chain, across the whole story
        tl.fromTo(q('[data-local-map]'), { xPercent: -58, yPercent: 0 }, { xPercent: -58, yPercent: -30, ease: 'none', duration: tl.duration() }, 0)
          .fromTo(q('[data-local-boat]'), { top: '12%', x: 0 }, { top: '78%', x: -24, ease: 'none', duration: tl.duration() }, 0)

        ScrollTrigger.create({
          trigger: section.current,
          start: 'top top',
          end: () => `+=${innerHeight * POINTS.length * 0.8}`,
          pin: true,
          scrub: 0.8,
          animation: tl,
        })
        // the boat bobs and the current illustration floats a little, always
        gsap.to(q('[data-local-boat] img'), { y: -5, rotation: -2, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' })
        gsap.to(q('[data-local-float]'), { y: -8, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
        return () => section.current?.removeAttribute('data-live')
      })
      return () => mm.revert()
    },
    { scope: section },
  )

  return (
    <section ref={section} id="local" className="relative overflow-hidden bg-background lg:h-svh">
      <div aria-hidden="true" className="office-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid h-full w-full max-w-7xl gap-10 px-6 py-24 lg:grid-cols-[minmax(0,0.36fr)_minmax(0,0.44fr)_minmax(0,0.2fr)] lg:items-center lg:gap-8 lg:py-0 2xl:max-w-[88rem]">
        {/* the story */}
        <div>
          <p className="text-overline tracking-[0.28em] text-muted-foreground">Designed for local realities</p>
          <h2 className="mt-4 text-[clamp(2.25rem,3.4vw,3.75rem)] font-light leading-[1.02] tracking-[-0.035em] text-foreground">
            Built for the <span className="text-(--brand)">Maldives.</span>
          </h2>
          <p className="mt-5 max-w-md text-pretty text-[15.5px] leading-relaxed text-muted-foreground">
            From atolls to eFaas to MVR, Bool fits how organisations here actually work, and the same foundations carry to every country it goes to next.
          </p>
          <ol className="mt-8 border-t border-border/70">
            {POINTS.map((p, i) => (
              <li key={p.id} data-local-item={p.id} className="office-item border-b border-border/70 py-3">
                <p className="flex items-baseline gap-3">
                  <span className="office-num w-6 text-xs tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span className="office-title text-[17px]">{p.title}</span>
                </p>
                <div data-local-detail={p.id} className="overflow-hidden">
                  <p className="max-w-sm pl-9 pt-1.5 text-[14px] leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
                {/* below lg each point carries its own illustration */}
                <div className="mx-auto mt-4 max-w-sm lg:hidden">{p.art}</div>
              </li>
            ))}
          </ol>
        </div>

        {/* the current point's illustration */}
        <div className="relative hidden h-[70svh] lg:block">
          {POINTS.map((p) => (
            <div key={p.id} data-local-art={p.id} className="invisible absolute inset-0 grid place-items-center">
              <div data-local-float="" className="w-full max-w-[34rem]">{p.art}</div>
            </div>
          ))}
        </div>

        {/* the island chain, scrolling by */}
        <div aria-hidden="true" className="relative hidden h-svh overflow-hidden lg:block">
          {/* taller than the screen, so it scrolls by as the story moves on */}
          <div data-local-map="" className="absolute left-1/2 top-0 h-[135svh]">
            <div className="relative h-full">
              <img src="/local/map.webp" alt="" decoding="async" draggable={false} className="h-full w-auto max-w-none select-none" />
              {/* the sea: soft swells drifting across */}
              <div className="local-sea absolute inset-0" />
              {LIGHTS.map(([x, y], i) => (
                <span key={i} className="local-light absolute size-1.5 rounded-full" style={{ left: `${x * 100}%`, top: `${y * 100}%`, animationDelay: `${(i * 0.73) % 3}s` }} />
              ))}
            </div>
          </div>
          <div data-local-boat="" className="absolute left-[54%] w-[22%]">{img('/local/boat.webp', '')}</div>
        </div>
      </div>
    </section>
  )
}
