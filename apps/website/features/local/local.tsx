'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, useGSAP)

/**
 * The local points, written for the first market (the Maldives) but true of any country: its
 * geography, identity provider and currencies are data per country, so the same point holds when
 * another country's are added. `at` is where down the chain the point's card sits (a share of the
 * map's height), evenly spaced; they alternate west and east of the chain. `art` is in public/local.
 */
const POINTS = [
  { id: 'addresses', at: 0.1, title: 'Addresses the way they are written here', body: 'Atoll, island and ward, kept as data for each country, with a fallback for addresses abroad.', art: 'atoll', alt: 'An atoll' },
  { id: 'currency', at: 0.26, title: 'MVR alongside USD', body: 'Prices, payments and reports in Rufiyaa and dollars, with the exchange rate captured on every record.', art: 'currency', alt: 'Rufiyaa and dollar coins', blend: true },
  { id: 'identity', at: 0.42, title: 'Sign in with eFaas', body: 'People verify with their national digital identity, kept separate from their Bool account.', art: 'identity', alt: 'An identity card verified against a fingerprint' },
  { id: 'oversight', at: 0.58, title: 'Oversight built in', body: 'Parent organisations see across their authorised branches and affiliated facilities.', art: 'oversight', alt: 'A parent office linked to its branches' },
  { id: 'audit', at: 0.74, title: 'Audit and lifecycle', body: 'Institutional-grade audit, data lifecycle per organisation and prompt access revocation.', art: 'audit', alt: 'Records protected by a shield, with their history' },
  {
    id: 'residency',
    at: 0.9,
    title: 'Your data can stay in the Maldives',
    body: 'Hosted locally or on your own servers, so your records never have to leave the country.',
    art: 'audit',
    alt: 'Records kept safe',
    link: { href: '#deployment', label: 'How you can deploy' },
  },
] as const

type Point = (typeof POINTS)[number]

function PointCard({ point, n }: { point: Point; n: number }) {
  return (
    <article className="glass-card flex items-center gap-5 p-5">
      <img
        src={`/local/${point.art}.webp`}
        alt={point.alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        data-card-art=""
        className={`local-card-art h-24 w-28 shrink-0 select-none object-contain ${'blend' in point ? 'mix-blend-multiply' : ''}`}
      />
      <div>
        <p data-card-line="" className="card-label tabular-nums text-(--brand)">{String(n).padStart(2, '0')}</p>
        <p data-card-line="" className="card-title mt-1 text-foreground">{point.title}</p>
        <p data-card-line="" className="card-body mt-1.5 text-foreground/75">{point.body}</p>
        {'link' in point && (
          <a data-card-line="" href={point.link.href} className="mt-2 inline-block text-[14.5px] font-medium text-(--brand) underline decoration-(--brand)/40 underline-offset-4 hover:decoration-(--brand)">
            {point.link.label} →
          </a>
        )}
      </div>
    </article>
  )
}

/**
 * "Built for the Maldives": the watercolour island chain (public/local/map.webp) down the middle,
 * soft swells drifting across it, with the six points beside it, west and east by turns. Nothing is pinned: the page scrolls as usual. On desktop each
 * card fades up as it comes into view, following the scroll both ways, and the hero's bee flies down
 * the chain alongside, from card to card in soft arcs, facing the way it flies and leaning into
 * its turns. Below lg, and with reduced motion, the six cards in a column.
 */
export function Local() {
  const section = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const root = section.current!
        const q = gsap.utils.selector(root)
        const chain = q('[data-local-chain]')[0] as HTMLElement
        const bee = q('[data-local-bee]')[0] as HTMLElement
        const lean = q('[data-local-bee-lean]')[0] as HTMLElement
        const face = q('[data-local-bee-face]')[0] as HTMLElement
        const clip = q('[data-local-bee] video')[0] as HTMLVideoElement

        // each card rises slowly from below and fades in as it comes into view, its picture and words
        // following a beat behind, all tied to the scroll (so back up, it sinks away again)
        const fades = q('[data-local-card]').map((card) =>
          gsap
            .timeline({ scrollTrigger: { trigger: card, start: 'top 108%', end: 'top 55%', scrub: 1.8 } })
            .fromTo(card, { autoAlpha: 0, y: 180 }, { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 1 })
            .fromTo(card.querySelector('[data-card-art]'), { y: 14, scale: 0.92, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, ease: 'power2.out', duration: 0.7 }, 0.25)
            .fromTo(card.querySelectorAll('[data-card-line]'), { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, ease: 'power2.out', duration: 0.6, stagger: 0.12 }, 0.35),
        )

        // the bee: the hero's flying clip, flown down the chain beside the cards. Its route is in the
        // chain's box (fractions), from above the first card to below the last, swinging out to each
        // card's side and back over the chain between them
        const webkit = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
        clip.src = `/hero/bee/bee-air.${webkit ? 'mp4' : 'webm'}`
        clip.playbackRate = 0.7 // an unhurried bee, not a fly
        void clip.play().catch(() => {})
        // one gentle swing out toward each card, so it drifts down the chain rather than darting
        const route = [{ x: 0.5, y: 0.04 }]
        POINTS.forEach((p, i) => route.push({ x: 0.5 + (i % 2 === 0 ? -1 : 1) * 0.17, y: p.at }))
        route.push({ x: 0.5, y: 0.97 })
        const raw = MotionPathPlugin.arrayToRawPath(route, { curviness: 1.4 })
        MotionPathPlugin.cacheRawPathMeasurements(raw)
        const flight = { p: 0 }
        let lastX = route[0].x
        let facing = 1
        const place = () => {
          const pos = MotionPathPlugin.getPositionOnPath(raw, flight.p)
          const w = chain.offsetWidth
          const h = chain.offsetHeight
          bee.style.transform = `translate3d(calc(${chain.offsetLeft + pos.x * w}px - 50%), calc(${chain.offsetTop + pos.y * h}px - 50%), 0)`
          // it faces the way it is flying: it turns only at the ends of its swings (once it has moved a
          // clear few pixels the other way), at once, as a bee does, and leans a little into its heading
          const dx = (pos.x - lastX) * w
          if (Math.abs(dx) > 10) {
            const dir = dx > 0 ? 1 : -1
            if (dir !== facing) {
              facing = dir
              face.style.transform = `scaleX(${dir})`
            }
            lastX = pos.x
          }
          gsap.to(lean, { rotation: gsap.utils.clamp(-8, 8, dx * 0.6) * facing, duration: 0.6, ease: 'sine.out', overwrite: true })
        }
        const fly = gsap.to(flight, {
          p: 1,
          ease: 'none',
          onUpdate: place,
          scrollTrigger: { trigger: chain, start: 'top 75%', end: 'bottom 25%', scrub: 3.4, invalidateOnRefresh: true, onRefresh: place },
        })
        place()

        return () => {
          fades.forEach((t) => t.scrollTrigger?.kill())
          fly.scrollTrigger?.kill()
          clip.pause()
        }
      })
      return () => mm.revert()
    },
    { scope: section },
  )

  return (
    <section ref={section} id="local" className="relative overflow-hidden bg-background">
      <div aria-hidden="true" className="office-grid pointer-events-none absolute inset-0" />

      <div className="section-y relative mx-auto w-full max-w-7xl gutter lg:motion-safe:pb-[calc(var(--section-y)+4rem)] 2xl:max-w-[88rem]">
        <div className="max-w-2xl">
          <p className="text-overline tracking-[0.28em] text-muted-foreground">Designed for local realities</p>
          <h2 className="section-title mt-4 text-foreground">
            Built for the <span className="text-(--brand)">Maldives.</span>
          </h2>
          <p className="section-lead mt-4 max-w-xl text-muted-foreground">
            From atolls to eFaas to MVR, Bool fits how organisations here actually work, and the same foundations carry to every country it goes to next.
          </p>
        </div>

        {/* desktop: the chain down the middle, the cards beside it */}
        <div className="relative mt-10 hidden lg:motion-safe:block">
          <div data-local-chain="" aria-hidden="true" className="relative mx-auto aspect-[1024/1536] h-[min(140svh,1300px)]">
            <img src="/local/map.webp" alt="" width={1024} height={1536} loading="lazy" decoding="async" draggable={false} className="local-map-art size-full select-none" />
            {/* the sea: soft swells drifting slowly across */}
            <div className="local-sea pointer-events-none absolute inset-0" />
          </div>
          {POINTS.map((p, i) => (
            <div
              key={p.id}
              data-local-card={p.id}
              className={`absolute w-[min(25rem,calc(50%-min(17svh,170px)-1.5rem))] -translate-y-1/2 ${
                i % 2 === 0 ? 'right-[calc(50%+min(17svh,170px))]' : 'left-[calc(50%+min(17svh,170px))]'
              }`}
              style={{ top: `${p.at * 100}%` }}
            >
              <PointCard point={p} n={i + 1} />
            </div>
          ))}
          {/* the bee, flying down beside the cards */}
          <div data-local-bee="" aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-20 w-[clamp(92px,8vw,128px)] will-change-transform">
            <div className="local-bee-hover">
              <div data-local-bee-lean="">
                <div data-local-bee-face="">
                  <video muted loop playsInline preload="auto" className="aspect-[640/520] w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* below lg, and with reduced motion: the six cards */}
        <div className="mt-10 grid gap-4 lg:motion-safe:hidden">
          {POINTS.map((p, i) => (
            <PointCard key={p.id} point={p} n={i + 1} />
          ))}
        </div>
      </div>
    </section>
  )
}
