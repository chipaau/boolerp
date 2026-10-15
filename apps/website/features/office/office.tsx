'use client'

import { useRef } from 'react'
import type { CSSProperties } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { OFFICE, ROOMS, centreOf } from './rooms'
import type { Room } from './rooms'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/** How close the camera comes to a room (1: the whole building fits the stage's width). */
const ZOOM = 1.55

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ')
const pct = ([x, y]: [number, number]) => ({ left: `${(x / OFFICE.width) * 100}%`, top: `${(y / OFFICE.height) * 100}%` })
const clip = (r: Room): CSSProperties => ({ clipPath: `polygon(${r.outline.map(([x, y]) => `${(x / OFFICE.width) * 100}% ${(y / OFFICE.height) * 100}%`).join(', ')})` })

/**
 * "Inside your workspace", after the reference's selected-work section: on the left only a large
 * title and, at the foot, the apps as a ruled list (number, name, tags); on the right the office
 * drawing fills the rest of the screen, edge to edge, on the page's cream. On desktop the section is
 * pinned: as the visitor scrolls the camera glides from room to room, coming in close on each, and
 * the current app's room comes back in its own colour (the building stays a soft, warm grey) under a
 * gentle glow, with a card rising out of it. Scrubbed both ways and settling on each app; clicking a
 * row goes to its room. Below lg, and with reduced motion, nothing is pinned and the whole drawing
 * shows in colour.
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
          lit: q(`[data-office-lit="${id}"]`),
          card: q(`[data-office-card="${id}"]`),
          face: q(`[data-office-card="${id}"] [data-office-face]`),
          item: q(`[data-office-item="${id}"]`),
          route: q(`[data-office-route="${id}"]`),
        })
        /** Where the camera sits to look at a room: its centre in the middle of the stage, at ZOOM. */
        const shot = (room: Room) => {
          const c = centreOf(room)
          const w = camera.offsetWidth
          const h = camera.offsetHeight
          return {
            scale: ZOOM,
            x: () => stage.clientWidth * 0.5 - camera.offsetLeft - c.x * w * ZOOM,
            y: () => stage.clientHeight * 0.48 - camera.offsetTop - c.y * h * ZOOM,
          }
        }
        ROOMS.forEach((r, i) => {
          const p = parts(r.id)
          gsap.set([...p.lit, ...p.card, ...p.route], { autoAlpha: i === 0 ? 1 : 0 })
          gsap.set(p.item, { '--on': i === 0 ? 1 : 0 })
        })
        // the cards keep their size whatever the zoom
        gsap.set(q('[data-office-face]'), { scale: 1 / ZOOM, transformOrigin: '0% 100%' })
        gsap.set(camera, { transformOrigin: '0 0', ...shot(ROOMS[0]) })

        const tl = gsap.timeline()
        tl.addLabel(ROOMS[0].id, 0)
        ROOMS.slice(1).forEach((room, k) => {
          const from = parts(ROOMS[k].id)
          const to = parts(room.id)
          const at = k + 0.15
          tl.to([...from.card], { autoAlpha: 0, y: -8, duration: 0.2, ease: 'power1.in' }, at)
            .to([...from.lit, ...from.route], { autoAlpha: 0, duration: 0.35, ease: 'power1.inOut' }, at + 0.05)
            .to(from.item, { '--on': 0, duration: 0.35, ease: 'power1.inOut' }, at)
            // the camera glides across the building to the next room, easing in and out of the move
            .to(camera, { ...shot(room), duration: 0.7, ease: 'power3.inOut' }, at + 0.05)
            .to(to.item, { '--on': 1, duration: 0.35, ease: 'power1.inOut' }, at + 0.3)
            .to(to.lit, { autoAlpha: 1, duration: 0.35, ease: 'power1.inOut' }, at + 0.5)
            .fromTo(to.card, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, at + 0.62)
          if (to.route.length) tl.fromTo(to.route, { autoAlpha: 1, clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)', duration: 0.3, ease: 'none' }, at + 0.62)
          tl.addLabel(room.id, at + 0.95)
        })
        tl.to({}, { duration: 0.2 })

        const snaps = [...ROOMS.map((r) => tl.labels[r.id] / tl.duration()), 1]
        trigger.current = ScrollTrigger.create({
          trigger: section.current,
          start: 'top top',
          end: () => `+=${innerHeight * (ROOMS.length - 0.4)}`,
          pin: true,
          scrub: 1, // a little lag behind the wheel, so the camera glides rather than steps
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

  /** Goes to an app's room: the point on the page where the story settles on it. */
  const go = (id: string) => {
    const st = trigger.current
    if (st) window.scrollTo({ top: st.labelToScroll(id), behavior: 'smooth' })
  }

  return (
    <section ref={section} id="workspace" className="relative overflow-hidden bg-background lg:h-svh">
      <div aria-hidden="true" className="office-grid pointer-events-none absolute inset-0" />

      {/* the drawing fills the right of the screen, edge to edge; the camera moves inside it */}
      <div data-office-stage="" className="relative aspect-[3/2] overflow-hidden lg:absolute lg:inset-y-0 lg:left-[38%] lg:right-0 lg:aspect-auto lg:[mask-image:linear-gradient(to_right,transparent,black_9%)]">
        <div data-office-camera="" className="absolute left-0 top-0 aspect-[2000/1333] w-full will-change-transform">
          <img src={OFFICE.src} alt="An office in which each Bool app has its room" width={OFFICE.width} height={OFFICE.height} decoding="async" className="office-base absolute inset-0 size-full select-none" draggable={false} />
          {ROOMS.map((r) => (
            <img key={r.id} data-office-lit={r.id} src={OFFICE.src} alt="" aria-hidden="true" className="office-colour invisible absolute inset-0 size-full select-none" style={clip(r)} draggable={false} />
          ))}
          <svg aria-hidden="true" viewBox={`0 0 ${OFFICE.width} ${OFFICE.height}`} className="absolute inset-0 size-full overflow-visible">
            <defs>
              <filter id="office-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="14" />
              </filter>
            </defs>
            {ROOMS.map((r) => (
              // a warm glow round the room, no hard edge
              <polygon key={r.id} data-office-lit={r.id} points={pts(r.outline)} fill="none" stroke="#f6a24d" strokeOpacity={0.35} strokeWidth={16} strokeLinejoin="round" filter="url(#office-glow)" className="invisible" />
            ))}
            {ROOMS.filter((r) => r.route).map((r) => (
              <polyline key={r.id} data-office-route={r.id} points={pts(r.route!)} fill="none" stroke="#f0913a" strokeWidth={2} strokeDasharray="0 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="invisible" />
            ))}
          </svg>
          {ROOMS.map((r) => {
            const Icon = r.icon
            return (
              <div key={r.id} data-office-card={r.id} className="invisible absolute" style={pct(r.pin)}>
                <div data-office-face="" className="absolute bottom-0 left-0">
                  <span aria-hidden="true" className="absolute -bottom-[6px] -left-[6px] size-3 rounded-full bg-[#f0913a] shadow-[0_0_0_6px_rgb(240_145_58/0.2)]" />
                  <span aria-hidden="true" className="absolute bottom-0 left-0 h-14 w-px bg-[#f0913a]" />
                  <div className="office-card absolute bottom-14 left-[-1.75rem] flex w-max items-center gap-3.5 py-3 pl-3 pr-5">
                    <span className="grid size-10 place-items-center rounded-xl bg-[#fdf1e4] text-[#e0730f]">
                      <Icon className="size-5" strokeWidth={1.7} />
                    </span>
                    <span className="leading-tight">
                      <span className="block text-[15px] font-bold text-foreground">{r.card.title}</span>
                      <span className="mt-0.5 block text-[13px] text-muted-foreground">{r.card.detail}</span>
                    </span>
                    {r.card.status && <span className="ml-2 rounded-full bg-[#fdf1e4] px-2.5 py-1 text-xs font-bold text-[#b45d0c]">{r.card.status}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* the left: a large title at the top, the apps as a ruled list at the foot */}
      <div className="relative mx-auto flex w-full max-w-7xl flex-col px-6 py-16 lg:h-full lg:py-0 2xl:max-w-[88rem]">
        <div className="flex max-w-[30%] flex-col max-lg:max-w-none lg:h-full lg:pb-14 lg:pt-28">
          <p className="text-overline tracking-[0.28em] text-muted-foreground">Inside your workspace</p>
          <h2 className="mt-5 text-[clamp(2.5rem,4vw,4.5rem)] font-light leading-[0.98] tracking-[-0.04em] text-foreground">
            Every team,
            <br />
            <span className="text-(--brand)">one building.</span>
          </h2>
          <ol className="mt-12 border-t border-border/70 lg:mt-auto">
            {ROOMS.map((room, i) => (
              <li key={room.id} data-office-item={room.id} className="office-item border-b border-border/70">
                <button type="button" onClick={() => go(room.id)} className="w-full py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
