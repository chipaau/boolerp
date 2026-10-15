'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * The local points, written for the first market (the Maldives) but true of any country: its
 * geography, identity provider and currencies are data per country, so the same point holds when
 * another country's are added. `art` is in public/local; `blend` for a drawing on white.
 */
const POINTS: { id: string; title: string; body: string; art: string; alt: string; blend?: boolean }[] = [
  { id: 'geography', title: 'Local geography', body: 'Atoll, island and ward, kept as data for each country, with a global fallback for foreign entities.', art: 'atoll', alt: 'An atoll' },
  { id: 'identity', title: 'eFaas-ready', body: 'National identity verification through eFaas, kept separate from core identity. Another country’s provider plugs in the same way.', art: 'identity', alt: 'An identity card verified against a fingerprint' },
  { id: 'currency', title: 'MVR & USD', body: 'Multi-currency money with captured exchange rates, MVR by default.', art: 'currency', alt: 'Rufiyaa and dollar coins', blend: true },
  { id: 'oversight', title: 'Oversight built in', body: 'Parent organisations see across their authorised branches and affiliated facilities.', art: 'oversight', alt: 'A parent office linked to its branches' },
  { id: 'audit', title: 'Audit & lifecycle', body: 'Institutional-grade audit, per-organisation data lifecycle and prompt access revocation.', art: 'audit', alt: 'Records protected by a shield, with their history' },
]

/** Where the islands sit on the chain (fractions of public/local/map.webp), for their little lights. */
const LIGHTS: [number, number][] = [[0.5, 0.14], [0.56, 0.24], [0.61, 0.31], [0.63, 0.38], [0.62, 0.46], [0.66, 0.56], [0.48, 0.7], [0.51, 0.78], [0.54, 0.89]]

function PointCard({ point, n }: { point: (typeof POINTS)[number]; n: number }) {
  return (
    <article className="office-card flex items-center gap-5 p-5">
      <img
        src={`/local/${point.art}.webp`}
        alt={point.alt}
        loading="eager"
        decoding="sync"
        draggable={false}
        className={`h-24 w-28 shrink-0 select-none object-contain ${point.blend ? 'mix-blend-multiply' : ''}`}
      />
      <div>
        <p className="flex items-baseline gap-2.5">
          <span className="text-xs font-medium tabular-nums text-(--brand)">{String(n).padStart(2, '0')}</span>
          <span className="text-[18px] font-medium text-foreground">{point.title}</span>
        </p>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">{point.body}</p>
      </div>
    </article>
  )
}

/**
 * "Built for the Maldives". On desktop the section is pinned: the title at the top, the island chain
 * down the middle, moving down with the scroll (its islands' lights blinking, the sea moving, a boat
 * sailing down the channel), and the points coming up one by one as cards, from the left and the
 * right in turn, until all five stand together around the chain. Below lg, and with reduced motion,
 * nothing is pinned: the title and the five cards.
 */
export function Local() {
  const section = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const q = gsap.utils.selector(section)
        const tl = gsap.timeline()
        POINTS.forEach((p, i) => {
          const side = i % 2 === 0 ? -1 : 1
          tl.fromTo(q(`[data-local-card="${p.id}"]`), { autoAlpha: 0, x: side * 90, y: 40 }, { autoAlpha: 1, x: 0, y: 0, duration: 0.6, ease: 'power3.out' }, i * 0.7)
        })
        tl.to({}, { duration: 0.5 })
        // the chain moves down with the scroll, and the boat sails down the channel
        tl.fromTo(q('[data-local-map]'), { yPercent: -26 }, { yPercent: 0, ease: 'none', duration: tl.duration() }, 0)
          .fromTo(q('[data-local-boat]'), { top: '30%', left: '70%' }, { top: '72%', left: '64%', ease: 'none', duration: tl.duration() }, 0)

        ScrollTrigger.create({
          trigger: section.current,
          start: 'top top',
          end: () => `+=${innerHeight * POINTS.length * 0.6}`,
          pin: true,
          scrub: 0.8,
          animation: tl,
        })
        // the boat rocks gently on the swell, always
        gsap.to(q('[data-local-boat] img'), { y: -3, rotation: -3, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
      })
      return () => mm.revert()
    },
    { scope: section },
  )

  const left = POINTS.filter((_, i) => i % 2 === 0)
  const right = POINTS.filter((_, i) => i % 2 === 1)
  const card = (p: (typeof POINTS)[number]) => (
    <div key={p.id} data-local-card={p.id}>
      <PointCard point={p} n={POINTS.indexOf(p) + 1} />
    </div>
  )

  return (
    <section ref={section} id="local" className="relative overflow-hidden bg-background lg:h-svh">
      <div aria-hidden="true" className="office-grid pointer-events-none absolute inset-0" />

      {/* the island chain, down the middle */}
      <div aria-hidden="true" className="local-chain pointer-events-none absolute inset-y-0 left-1/2 hidden -translate-x-1/2 lg:block">
        <div data-local-map="" className="relative h-[135svh]">
          <img src="/local/map.webp" alt="" width={700} height={1119} loading="eager" decoding="sync" draggable={false} className="h-full w-auto max-w-none select-none opacity-90" />
          {/* the sea: soft swells drifting across */}
          <div className="local-sea absolute inset-0" />
          {LIGHTS.map(([x, y], i) => (
            <span key={i} className="local-light absolute size-1.5 rounded-full" style={{ left: `${x * 100}%`, top: `${y * 100}%`, animationDelay: `${(i * 0.73) % 3}s` }} />
          ))}
          <div data-local-boat="" className="absolute w-[9%] -translate-x-1/2">
            <img src="/local/boat.webp" alt="" draggable={false} className="h-auto w-full select-none" />
          </div>
        </div>
      </div>

      <div className="relative mx-auto flex h-full w-full max-w-7xl flex-col px-6 py-24 lg:py-14 2xl:max-w-[88rem]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-overline tracking-[0.28em] text-muted-foreground">Designed for local realities</p>
          <h2 className="mt-4 text-[clamp(2.25rem,3.6vw,4rem)] font-light leading-[1.02] tracking-[-0.035em] text-foreground">
            Built for the <span className="text-(--brand)">Maldives.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-[16px] leading-relaxed text-muted-foreground">
            From atolls to eFaas to MVR, Bool fits how organisations here actually work, and the same foundations carry to every country it goes to next.
          </p>
        </div>

        {/* desktop: the cards either side of the chain */}
        <div className="mt-8 hidden flex-1 grid-cols-[minmax(0,1fr)_17rem_minmax(0,1fr)] items-center gap-8 lg:grid">
          <div className="grid gap-4">{left.map(card)}</div>
          <div />
          <div className="grid gap-4">{right.map(card)}</div>
        </div>
        {/* below lg: the five cards */}
        <div className="mt-10 grid gap-4 lg:hidden">
          {POINTS.map((p, i) => (
            <PointCard key={p.id} point={p} n={i + 1} />
          ))}
        </div>
      </div>
    </section>
  )
}
