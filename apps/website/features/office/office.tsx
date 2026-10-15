'use client'

import { useRef } from 'react'
import type { CSSProperties } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { OFFICE, ROOMS } from './rooms'
import type { Room } from './rooms'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ')
const pct = ([x, y]: [number, number]) => ({ left: `${(x / OFFICE.width) * 100}%`, top: `${(y / OFFICE.height) * 100}%` })
const clip = (r: Room): CSSProperties => ({ clipPath: `polygon(${r.outline.map(([x, y]) => `${(x / OFFICE.width) * 100}% ${(y / OFFICE.height) * 100}%`).join(', ')})` })

/** A crosshair, the drafting mark at the corners of the section's frame. */
function Cross({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={`office-cross absolute size-4 ${className}`}>
      <path d="M8 0v16M0 8h16" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

/**
 * "Inside your workspace": an isometric office in which each app has its room. On desktop the
 * section is pinned and steps through the apps as the visitor scrolls. The building is drawn in
 * grey; the current app's room comes back in its own colour (a colour copy of the drawing, clipped to
 * the room), edged by a soft amber line, and a card rises out of it with one thing that app knows.
 * The drawing stays still: the light moves, not the building. On the left, the apps as a numbered
 * timeline: the current one amber with its description open; clicking one goes to its room. The
 * first app is lit as the section arrives. Scrubbed both ways and settling on each app. Below lg,
 * and with reduced motion, nothing is pinned and the drawing is shown in full colour.
 */
export function Office() {
  const section = useRef<HTMLElement>(null)
  const trigger = useRef<ScrollTrigger | null>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const q = gsap.utils.selector(section)
        const n = ROOMS.length
        section.current?.setAttribute('data-live', '') // the building greys (globals.css)
        const parts = (id: string) => ({
          lit: q(`[data-office-lit="${id}"]`),
          card: q(`[data-office-card="${id}"]`),
          item: q(`[data-office-item="${id}"]`),
          route: q(`[data-office-route="${id}"]`),
        })
        ROOMS.forEach((r, i) => {
          const p = parts(r.id)
          gsap.set([...p.lit, ...p.card, ...p.route], { autoAlpha: i === 0 ? 1 : 0 })
          gsap.set(p.item, { '--on': i === 0 ? 1 : 0 })
        })

        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } })
        tl.addLabel(ROOMS[0].id, 0)
        ROOMS.slice(1).forEach((room, k) => {
          const from = parts(ROOMS[k].id)
          const to = parts(room.id)
          const at = k + 0.2
          tl.to([...from.lit, ...from.route], { autoAlpha: 0, duration: 0.45 }, at)
            .to(from.card, { autoAlpha: 0, y: -10, duration: 0.3 }, at)
            .to(from.item, { '--on': 0, duration: 0.4 }, at)
            .to(to.lit, { autoAlpha: 1, duration: 0.5 }, at + 0.2)
            .to(to.item, { '--on': 1, duration: 0.4 }, at + 0.2)
            .fromTo(to.card, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }, at + 0.4)
          // Requests draws its route from the desks to the store counter
          if (to.route.length) tl.fromTo(to.route, { autoAlpha: 1, clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)', duration: 0.45, ease: 'none' }, at + 0.45)
          tl.addLabel(room.id, at + 0.85)
        })
        tl.to({}, { duration: 0.25 }) // the last app holds a beat before the pin lets go

        const snaps = [...ROOMS.map((r) => tl.labels[r.id] / tl.duration()), 1]
        trigger.current = ScrollTrigger.create({
          trigger: section.current,
          start: 'top top',
          end: () => `+=${innerHeight * (n - 0.4)}`,
          pin: true,
          scrub: 0.5,
          animation: tl,
          snap: { snapTo: snaps, duration: { min: 0.25, max: 0.7 }, delay: 0.06, ease: 'power2.inOut' },
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
    if (!st) return
    const y = st.labelToScroll(id)
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  return (
    <section ref={section} id="workspace" className="relative overflow-hidden bg-background lg:h-svh">
      {/* the drafting paper: a faint grid, and crosshairs at the frame's corners */}
      <div aria-hidden="true" className="office-grid pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-6 hidden lg:block">
        <Cross className="-left-2 -top-2" />
        <Cross className="-right-2 -top-2" />
        <Cross className="-bottom-2 -left-2" />
        <Cross className="-bottom-2 -right-2" />
        <Cross className="-top-2 left-[34%]" />
        <Cross className="-bottom-2 left-[34%]" />
      </div>

      <div className="relative mx-auto grid h-full w-full max-w-7xl items-center gap-10 px-6 py-20 lg:grid-cols-[minmax(0,0.32fr)_minmax(0,0.68fr)] lg:py-0 2xl:max-w-[88rem]">
        <div className="relative z-10">
          <p className="flex items-center gap-4 text-overline tracking-[0.28em] text-muted-foreground">
            Bool workspace <span aria-hidden="true" className="h-px w-20 bg-border" />
          </p>
          <h2 className="mt-5 text-balance text-[clamp(2.25rem,3.3vw,3.5rem)] font-light leading-[1.03] tracking-[-0.035em] text-foreground">
            Every team, <span className="text-(--brand)">one building</span>.
          </h2>
          {/* the apps as a timeline: a dot on a line for each, the current one amber and open */}
          <ol className="relative mt-10">
            <span aria-hidden="true" className="absolute bottom-3 left-[5px] top-3 w-px bg-border" />
            {ROOMS.map((room, i) => (
              <li key={room.id} data-office-item={room.id} className="office-item relative">
                <button type="button" onClick={() => go(room.id)} className="grid w-full grid-cols-[1.5rem_2.25rem_1fr] items-start py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span aria-hidden="true" className="office-dot mt-[7px] size-[11px] rounded-full" />
                  <span className="office-num mt-[3px] text-sm tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="office-title block text-[17px]">{room.title}</span>
                    <span className="office-body block max-w-xs text-sm leading-relaxed text-muted-foreground">{room.body}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* the drawing: still, and larger than its column, running on toward the screen's edge */}
        <div className="relative aspect-[2000/1333] w-full lg:-mr-[14%] lg:w-[114%]">
          <img src={OFFICE.src} alt="An office in which each Bool app has its room" width={OFFICE.width} height={OFFICE.height} decoding="async" className="office-base absolute inset-0 size-full select-none" draggable={false} />
          {/* the current room in colour */}
          {ROOMS.map((r) => (
            <img key={r.id} data-office-lit={r.id} src={OFFICE.src} alt="" aria-hidden="true" className="office-colour invisible absolute inset-0 size-full select-none" style={clip(r)} draggable={false} />
          ))}
          <svg aria-hidden="true" viewBox={`0 0 ${OFFICE.width} ${OFFICE.height}`} className="absolute inset-0 size-full overflow-visible">
            <defs>
              <filter id="office-glow" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>
            {ROOMS.map((r) => (
              <g key={r.id} data-office-lit={r.id} className="invisible">
                {/* a soft amber edge: a blurred glow under a fine line */}
                <polygon points={pts(r.outline)} fill="none" stroke="#f6a24d" strokeOpacity={0.45} strokeWidth={7} strokeLinejoin="round" filter="url(#office-glow)" />
                <polygon points={pts(r.outline)} fill="rgb(246 162 77 / 0.06)" stroke="#f0913a" strokeOpacity={0.75} strokeWidth={1.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </g>
            ))}
            {ROOMS.filter((r) => r.route).map((r) => (
              <polyline key={r.id} data-office-route={r.id} points={pts(r.route!)} fill="none" stroke="#f0913a" strokeWidth={2.5} strokeDasharray="0 9" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="invisible" />
            ))}
          </svg>
          {/* each room's card: above its pin, on a short amber leader */}
          {ROOMS.map((r) => {
            const Icon = r.icon
            return (
              <div key={r.id} data-office-card={r.id} className="invisible absolute" style={pct(r.pin)}>
                <span aria-hidden="true" className="absolute -left-[5px] -top-[5px] size-2.5 rounded-full bg-[#f0913a] shadow-[0_0_0_5px_rgb(240_145_58/0.18)]" />
                <span aria-hidden="true" className="absolute bottom-0 left-0 h-12 w-px bg-[#f0913a]/80" />
                <div className="office-card absolute bottom-12 left-[-1.5rem] flex w-max items-center gap-3 py-2.5 pl-2.5 pr-4">
                  <span className="grid size-9 place-items-center rounded-xl bg-[#fdf1e4] text-[#e0730f]">
                    <Icon className="size-[18px]" strokeWidth={1.7} />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[13.5px] font-bold text-foreground">{r.card.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{r.card.detail}</span>
                  </span>
                  {r.card.status && <span className="ml-2 rounded-full bg-[#fdf1e4] px-2 py-0.5 text-[11px] font-bold text-[#b45d0c]">{r.card.status}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
