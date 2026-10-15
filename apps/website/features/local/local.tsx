'use client'

import { useRef } from 'react'
import type { ComponentType } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Audit, Currency, Geography, Identity, Oversight } from './illustrations'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * The local points, written for the first market (the Maldives) but true of any country: its
 * geography, identity provider and currencies are data per country, so the same point holds when
 * another country's are added (country rules are data, never code).
 */
const POINTS: { id: string; title: string; body: string; art: ComponentType }[] = [
  { id: 'geography', title: 'Local geography', body: 'Atoll → island → ward, kept as data for each country, with a global fallback for foreign entities.', art: Geography },
  { id: 'identity', title: 'eFaas-ready', body: 'National identity verification through eFaas, kept separate from core identity. Another country’s provider plugs in the same way.', art: Identity },
  { id: 'currency', title: 'MVR & USD', body: 'Multi-currency money with captured exchange rates, MVR by default.', art: Currency },
  { id: 'oversight', title: 'Oversight built in', body: 'Parent organisations see across their authorised branches and affiliated facilities.', art: Oversight },
  { id: 'audit', title: 'Audit & lifecycle', body: 'Institutional-grade audit, per-organisation data lifecycle and prompt access revocation.', art: Audit },
]

/**
 * "Built for the Maldives": the local realities Bool is designed around, each with an illustration
 * drawn in code that plays as it scrolls into view (layers spread, the ID connects and checks, coins
 * fall, branches link to their parent, the shield lifts and the clock turns), then keeps a quiet
 * idle motion. Reduced motion: the illustrations are shown as drawn.
 */
export function Local() {
  const section = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const q = gsap.utils.selector(section)
        const on = (id: string, build: (tl: gsap.core.Timeline, $: (s: string) => Element[]) => void) => {
          const el = q(`[data-point="${id}"]`)[0]
          const $ = gsap.utils.selector(el)
          const tl = gsap.timeline({ paused: true })
          build(tl, $)
          ScrollTrigger.create({ trigger: el, start: 'top 78%', onEnter: () => tl.play(), onLeaveBack: () => tl.reverse() })
        }
        const draw = (path: Element) => {
          const len = (path as SVGGeometryElement).getTotalLength()
          return { from: { strokeDashoffset: len, strokeDasharray: `7 7` }, len }
        }
        /** Sends a dot along a path, over and over, as the idle motion. */
        const travel = (dot: Element, path: Element, duration: number, delay = 0) => {
          const p = path as SVGGeometryElement
          const len = p.getTotalLength()
          const o = { t: 0 }
          return gsap.to(o, {
            t: 1, duration, delay, repeat: -1, repeatDelay: 0.6, ease: 'sine.inOut',
            onUpdate: () => {
              const pt = p.getPointAtLength(o.t * len)
              gsap.set(dot, { attr: { cx: pt.x, cy: pt.y } })
            },
          })
        }

        on('geography', (tl, $) => {
          tl.from($('[data-geo-layer="atoll"]'), { y: 70, duration: 0.8, ease: 'power3.out' }, 0)
            .from($('[data-geo-layer="island"], [data-geo-layer="island-houses"]'), { y: 35, duration: 0.8, ease: 'power3.out' }, 0)
            .from($('[data-geo-layer="ward-houses"] > g, [data-geo-layer="island-houses"] > g'), { scale: 0, transformOrigin: '50% 100%', stagger: 0.06, duration: 0.35, ease: 'back.out(2)' }, 0.5)
            .from($('[data-geo-pin]'), { y: -40, autoAlpha: 0, duration: 0.5, ease: 'bounce.out' }, 0.9)
            .from($('[data-geo-stop]'), { scale: 0, transformOrigin: '50% 50%', stagger: 0.12, duration: 0.3, ease: 'back.out(2)' }, 0.9)
          gsap.to($('[data-geo-pin]'), { y: -6, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 2 })
          gsap.to($('[data-geo-chain]'), { strokeDashoffset: -18, duration: 1.2, repeat: -1, ease: 'none' })
        })

        on('identity', (tl, $) => {
          const link = $('[data-id-link]')[0]
          tl.fromTo(link, draw(link).from, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, 0.2)
            .from($('[data-id-check]'), { scale: 0, transformOrigin: '50% 50%', duration: 0.45, ease: 'back.out(2.5)' }, 0.9)
          travel($('[data-id-dot]')[0], link, 1.6, 1)
          gsap.fromTo($('[data-id-scan]'), { y: 0, autoAlpha: 0.9 }, { y: 57, autoAlpha: 0, duration: 1.4, repeat: -1, repeatDelay: 0.8, ease: 'sine.inOut', delay: 1 })
        })

        on('currency', (tl, $) => {
          ;['mvr', 'usd'].forEach((k, s) => {
            const coins = $(`[data-coin="${k}"]`)
            tl.from(coins, { y: -90, autoAlpha: 0, stagger: 0.09, duration: 0.45, ease: 'bounce.out' }, s * 0.25)
            // idle: now and then a coin drops onto the top again
            gsap.fromTo(coins[coins.length - 1], { y: -70, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'bounce.out', repeat: -1, repeatDelay: 3.4, delay: 3 + s * 1.7 })
          })
        })

        on('oversight', (tl, $) => {
          const links = $('[data-link]')
          tl.from($('[data-site="parent"]'), { y: -30, autoAlpha: 0, duration: 0.6, ease: 'power3.out' }, 0)
            .from($('[data-site^="kid"]'), { y: 20, autoAlpha: 0, stagger: 0.1, duration: 0.5, ease: 'power3.out' }, 0.25)
          links.forEach((l, i) => tl.fromTo(l, draw(l).from, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, 0.6 + i * 0.12))
          $('[data-link-dot]').forEach((d, i) => travel(d, links[i], 1.4, 1.2 + i * 0.4))
        })

        on('audit', (tl, $) => {
          const link = $('[data-audit-link]')[0]
          tl.from($('[data-audit-card]'), { x: -30, autoAlpha: 0, stagger: 0.1, duration: 0.5, ease: 'power3.out' }, 0)
            .from($('[data-audit-shield]'), { y: 30, autoAlpha: 0, duration: 0.6, ease: 'power3.out' }, 0.3)
            .fromTo(link, draw(link).from, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut' }, 0.8)
          // idle: the shield lifts like a dashboard tile, the clock's hand turns
          gsap.to($('[data-audit-shield]'), { y: -10, duration: 1.2, yoyo: true, repeat: -1, repeatDelay: 1.6, ease: 'sine.inOut', delay: 1.6 })
          gsap.to($('[data-audit-hand]'), { rotation: 360, svgOrigin: '0 0', duration: 6, repeat: -1, ease: 'none' })
          travel($('[data-audit-dot]')[0], link, 1.5, 1.4)
        })
      })
      return () => mm.revert()
    },
    { scope: section },
  )

  return (
    <section ref={section} id="local" className="relative overflow-hidden bg-background">
      <div aria-hidden="true" className="office-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-7xl px-6 py-28 2xl:max-w-[88rem]">
        <p className="text-overline tracking-[0.28em] text-muted-foreground">Designed for local realities</p>
        <h2 className="mt-4 text-[clamp(2.25rem,3.6vw,4rem)] font-light leading-[1.02] tracking-[-0.035em] text-foreground">
          Built for the <span className="text-(--brand)">Maldives.</span>
        </h2>
        <p className="mt-6 max-w-2xl text-pretty text-[clamp(1rem,1.2vw,1.15rem)] leading-relaxed text-muted-foreground">
          From atolls to eFaas to MVR, Bool fits how organisations here actually work, and the same foundations carry to every country it goes to next.
        </p>

        <ol className="mt-16 grid gap-x-16 md:grid-cols-2">
          {POINTS.map((p, i) => {
            const Art = p.art
            return (
              <li key={p.id} data-point={p.id} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-6 border-t border-border/70 py-10">
                <div>
                  <p className="flex items-center gap-3 text-xs font-bold tabular-nums text-(--brand)">
                    {String(i + 1).padStart(2, '0')} <span aria-hidden="true" className="h-px w-10 bg-(--brand)/40" />
                  </p>
                  <h3 className="mt-4 text-[22px] font-bold tracking-[-0.01em] text-foreground">{p.title}</h3>
                  <p className="mt-2 text-pretty text-[15px] leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
                <Art />
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
