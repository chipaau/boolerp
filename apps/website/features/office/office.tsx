'use client'

import { useRef } from 'react'
import { Check } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { HUB, OFFICE, ROOMS, centreOf } from './rooms'
import type { Room } from './rooms'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const pct = ([x, y]: [number, number]) => ({ left: `${(x / OFFICE.width) * 100}%`, top: `${(y / OFFICE.height) * 100}%` })

/** How close the camera comes: closer for one island, further out for a few spread across the map. */
function zoomFor(room: Room) {
  const l = Math.min(...room.areas.map((a) => a[0]))
  const r = Math.max(...room.areas.map((a) => a[2]))
  const t = Math.min(...room.areas.map((a) => a[1]))
  const b = Math.max(...room.areas.map((a) => a[3]))
  const fill = Math.max((r - l) / OFFICE.width, (b - t) / OFFICE.height)
  return Math.min(1.4, Math.max(1, 0.62 / fill))
}

/**
 * "Inside your workspace": the workspace map, a hub with every app an island around it. On desktop the
 * section is pinned; the map starts quiet (warm grey, only the hub in colour) and, as the visitor
 * scrolls, each app in turn comes forward: its islands return to colour under a soft glow, the camera
 * glides toward them, and a card unrolls what the app does. At the end the camera pulls back and every
 * island lights at once: everything connected. On the left, a large title and the apps as a ruled
 * list (number, name, tags), the current one amber; clicking one goes to it. Scrubbed both ways.
 * Below lg, and with reduced motion, nothing is pinned and the whole map shows in colour.
 */
export function Office() {
  const section = useRef<HTMLElement>(null)
  const trigger = useRef<ScrollTrigger | null>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const q = gsap.utils.selector(section)
        const stage = q('[data-office-stage]')[0] as HTMLElement
        const camera = q('[data-office-camera]')[0] as HTMLElement
        section.current?.setAttribute('data-live', '')
        const parts = (id: string) => ({
          lit: [...q(`[data-office-lit="${id}"]`), ...q(`[data-office-route="${id}"]`)],
          veil: q(`[data-office-veil="${id}"]`),
          card: q(`[data-office-card="${id}"]`),
          features: q(`[data-office-card="${id}"] li`),
          item: q(`[data-office-item="${id}"]`),
        })
        const shot = (c: { x: number; y: number }, scale: number) => ({
          scale,
          x: () => stage.clientWidth * 0.5 - c.x * camera.offsetWidth * scale,
          y: () => stage.clientHeight * 0.5 - c.y * camera.offsetHeight * scale,
        })
        const whole = shot({ x: 0.5, y: 0.5 }, 1)
        ROOMS.forEach((r) => {
          const p = parts(r.id)
          gsap.set([...p.lit, ...p.card], { autoAlpha: 0 })
          gsap.set(p.veil, { autoAlpha: 1 })
          gsap.set(p.item, { '--on': 0 })
        })
        gsap.set(camera, { transformOrigin: '0 0', ...whole })
        // each card keeps its size whatever its step's zoom
        ROOMS.forEach((r) => gsap.set(q(`[data-office-card="${r.id}"] [data-office-face]`), { scale: 1 / zoomFor(r), transformOrigin: '0% 100%' }))

        const tl = gsap.timeline()
        tl.addLabel('start', 0)
        ROOMS.forEach((room, k) => {
          const to = parts(room.id)
          const at = k + 0.15
          if (k > 0) {
            const from = parts(ROOMS[k - 1].id)
            tl.to(from.card, { autoAlpha: 0, y: -8, duration: 0.2, ease: 'power1.in' }, at)
              .to(from.lit, { autoAlpha: 0, duration: 0.35, ease: 'power1.inOut' }, at + 0.05)
              .to(from.veil, { autoAlpha: 1, duration: 0.4, ease: 'power1.inOut' }, at + 0.05)
              .to(from.item, { '--on': 0, duration: 0.35, ease: 'power1.inOut' }, at)
          }
          tl.to(camera, { ...shot(centreOf(room), zoomFor(room)), duration: 0.7, ease: 'power3.inOut' }, at + 0.05)
            .to(to.item, { '--on': 1, duration: 0.35, ease: 'power1.inOut' }, at + 0.3)
            .to(to.veil, { autoAlpha: 0, duration: 0.45, ease: 'power1.inOut', stagger: 0.06 }, at + 0.4)
            .to(to.lit, { autoAlpha: 1, duration: 0.4, ease: 'power1.inOut', stagger: 0.06 }, at + 0.45)
            .fromTo(to.card, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, at + 0.6)
            .fromTo(to.features, { autoAlpha: 0, x: -6 }, { autoAlpha: 1, x: 0, duration: 0.25, stagger: 0.05, ease: 'power2.out' }, at + 0.7)
            .addLabel(room.id, at + 0.98)
        })
        // the finale: the camera pulls back and everything lights at once
        const end = ROOMS.length + 0.15
        const last = parts(ROOMS[ROOMS.length - 1].id)
        tl.to(last.card, { autoAlpha: 0, duration: 0.2 }, end)
          .to(last.item, { '--on': 0, duration: 0.3 }, end)
          .to(camera, { ...whole, duration: 0.7, ease: 'power3.inOut' }, end)
          .to(q('[data-office-veil]'), { autoAlpha: 0, duration: 0.4, stagger: 0.04 }, end + 0.3)
          .to(q('[data-office-route]'), { autoAlpha: 1, duration: 0.4, stagger: 0.04 }, end + 0.3)
          .addLabel('all', end + 0.95)
          .to({}, { duration: 0.2 })

        const snaps = [0, ...ROOMS.map((r) => tl.labels[r.id] / tl.duration()), tl.labels.all / tl.duration(), 1]
        trigger.current = ScrollTrigger.create({
          trigger: section.current,
          start: 'top top',
          end: () => `+=${innerHeight * (ROOMS.length + 0.6)}`,
          pin: true,
          scrub: 1,
          animation: tl,
          invalidateOnRefresh: true,
          snap: { snapTo: snaps, duration: { min: 0.35, max: 0.9 }, delay: 0.05, ease: 'power2.inOut' },
        })
        return () => {
          section.current?.removeAttribute('data-live')
          trigger.current = null
        }
      })
      return () => mm.revert()
    },
    { scope: section },
  )

  const go = (id: string) => {
    const st = trigger.current
    if (st) window.scrollTo({ top: st.labelToScroll(id), behavior: 'smooth' })
  }

  return (
    <section ref={section} id="workspace" className="relative overflow-hidden bg-background lg:h-svh">
      <div aria-hidden="true" className="office-grid pointer-events-none absolute inset-0" />

      {/* the map fills the right of the screen, edge to edge; the camera moves inside it */}
      <div data-office-stage="" className="relative aspect-[3/2] overflow-hidden lg:absolute lg:inset-y-0 lg:left-[36%] lg:right-0 lg:aspect-auto lg:[mask-image:linear-gradient(to_right,transparent,black_8%)]">
        <div data-office-camera="" className="isolate absolute left-0 top-0 aspect-[3/2] w-full will-change-transform">
          {/* the routes into the hub: dashes that keep marching, faint until their app comes forward */}
          <svg aria-hidden="true" viewBox={`0 0 ${OFFICE.width} ${OFFICE.height}`} className="absolute inset-0 size-full overflow-visible">
            {ROOMS.flatMap((r) =>
              r.areas.map((a, i) => {
                const [hx, hy] = [(HUB[0] + HUB[2]) / 2, (HUB[1] + HUB[3]) / 2]
                const [x, y] = [(a[0] + a[2]) / 2, (a[1] + a[3]) / 2]
                return (
                  <g key={`${r.id}-${i}`}>
                    <line x1={hx} y1={hy} x2={x} y2={y} className="office-route-rest" vectorEffect="non-scaling-stroke" />
                    <line data-office-route={r.id} x1={hx} y1={hy} x2={x} y2={y} className="office-route invisible" vectorEffect="non-scaling-stroke" />
                  </g>
                )
              }),
            )}
          </svg>
          <img src={OFFICE.src} alt="The Bool workspace as a hub, with each app an island connected to it" width={OFFICE.width} height={OFFICE.height} decoding="async" className="office-base absolute inset-0 size-full select-none" draggable={false} />
          {/* each app's islands: a warm glow under it when it comes forward, a cream veil over it when it does not */}
          {ROOMS.flatMap((r) =>
            r.areas.map((a, i) => {
              const box = { ...pct([a[0], a[1]]), width: `${((a[2] - a[0]) / OFFICE.width) * 100}%`, height: `${((a[3] - a[1]) / OFFICE.height) * 100}%` }
              return (
                <div key={`${r.id}-${i}`} aria-hidden="true">
                  <div data-office-lit={r.id} className="office-island-glow invisible absolute -z-10" style={box} />
                  <div data-office-veil={r.id} className="office-veil invisible absolute" style={box} />
                </div>
              )
            }),
          )}
          {ROOMS.map((r) => {
            const Icon = r.icon
            return (
              <div key={r.id} data-office-card={r.id} className="invisible absolute" style={pct(r.pin)}>
                <div data-office-face="" className="office-card absolute bottom-2 left-0 w-max min-w-56 py-3.5 pl-3.5 pr-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-xl bg-[#fdf1e4] text-[#e0730f]">
                      <Icon className="size-[18px]" strokeWidth={1.7} />
                    </span>
                    <span className="text-[15px] font-bold text-foreground">{r.title}</span>
                  </div>
                  <ul className="mt-3 space-y-1.5 pl-1">
                    {r.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-[13px] text-body">
                        <Check className="size-3.5 text-(--brand)" strokeWidth={2.4} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* the left: a large title at the top, the apps as a ruled list at the foot */}
      <div className="relative mx-auto flex w-full max-w-7xl flex-col px-6 py-16 lg:h-full lg:py-0 2xl:max-w-[88rem]">
        <div className="flex flex-col lg:h-full lg:max-w-[30%] lg:pb-14 lg:pt-28">
          <p className="text-overline tracking-[0.28em] text-muted-foreground">Inside your workspace</p>
          <h2 className="mt-5 text-[clamp(2.25rem,3.3vw,3.75rem)] font-light leading-[1.02] tracking-[-0.04em] text-foreground">
            One workspace,
            <br />
            <span className="text-(--brand)">every app connected.</span>
          </h2>
          <ol className="mt-12 border-t border-border/70 lg:mt-auto">
            {ROOMS.map((room, i) => (
              <li key={room.id} data-office-item={room.id} className="office-item border-b border-border/70">
                <button type="button" onClick={() => go(room.id)} className="w-full py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex items-baseline gap-3">
                    <span className="office-num w-6 text-xs tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                    <span className="office-title text-[17px]">{room.title}</span>
                    <span className="office-tags ml-auto text-[10px] font-bold uppercase tracking-[0.14em]">{room.tags.join(', ')}</span>
                  </span>
                  <span className="office-body block pl-9 text-[13px] leading-relaxed text-muted-foreground">{room.body}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
