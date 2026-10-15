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
 * "Inside your workspace": an isometric office drawing in which each app has its room. On desktop the
 * section is pinned and steps through the apps as the visitor scrolls; the drawing itself stays still
 * (the light moves, not the building). For each app its room's own line work turns amber (an amber
 * copy of the drawing, clipped to the room, so the lit lines are the drawing's own, not traced over
 * it) over a warm wash, a card rises out of the room, and on the left its headline and description
 * take over. The first app is lit from the start, so the section never opens on nothing. Scrubbed
 * both ways and settling on each app. Below lg, and with reduced motion, nothing is pinned.
 */
export function Office() {
  const section = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const q = gsap.utils.selector(section)
        const n = ROOMS.length
        const parts = (id: string) => ({
          lit: q(`[data-office-lit="${id}"]`),
          card: q(`[data-office-card="${id}"]`),
          copy: q(`[data-office-copy="${id}"]`),
          step: q(`[data-office-step="${id}"]`),
          route: q(`[data-office-route="${id}"]`),
        })
        // everything but the first app starts hidden; the first is already lit as the section arrives
        ROOMS.forEach((r, i) => {
          const p = parts(r.id)
          gsap.set([...p.lit, ...p.card, ...p.copy, ...p.route], { autoAlpha: i === 0 ? 1 : 0 })
          gsap.set(p.step, { '--on': i === 0 ? 1 : 0 })
        })

        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } })
        tl.addLabel(ROOMS[0].id, 0)
        ROOMS.slice(1).forEach((room, k) => {
          const from = parts(ROOMS[k].id)
          const to = parts(room.id)
          const at = k + 0.2
          tl.to([...from.lit, ...from.route], { autoAlpha: 0, duration: 0.35 }, at)
            .to(from.card, { autoAlpha: 0, y: -10, duration: 0.3 }, at)
            .to(from.copy, { autoAlpha: 0, y: -16, duration: 0.3 }, at)
            .to(from.step, { '--on': 0, duration: 0.3 }, at)
            .to(to.lit, { autoAlpha: 1, duration: 0.45 }, at + 0.25)
            .fromTo(to.card, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }, at + 0.4)
            .fromTo(to.copy, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }, at + 0.3)
            .to(to.step, { '--on': 1, duration: 0.3 }, at + 0.3)
          // Requests draws its route from the desk to the store
          if (to.route.length) tl.fromTo(to.route, { autoAlpha: 1, clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)', duration: 0.45, ease: 'none' }, at + 0.45)
          tl.addLabel(room.id, at + 0.85)
        })
        tl.to({}, { duration: 0.25 }) // the last app holds a beat before the pin lets go

        const snaps = [...ROOMS.map((r) => tl.labels[r.id] / tl.duration()), 1]
        ScrollTrigger.create({
          trigger: section.current,
          start: 'top top',
          end: () => `+=${innerHeight * (n - 0.4)}`,
          pin: true,
          scrub: 0.5,
          animation: tl,
          snap: { snapTo: snaps, duration: { min: 0.25, max: 0.7 }, delay: 0.06, ease: 'power2.inOut' },
        })
      })
      return () => mm.revert()
    },
    { scope: section },
  )

  return (
    <section ref={section} id="workspace" className="relative overflow-hidden bg-background lg:h-svh">
      {/* the drafting paper: a faint grid, and crosshairs at the frame's corners */}
      <div aria-hidden="true" className="office-grid pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-6 hidden lg:block">
        <Cross className="-left-2 -top-2" />
        <Cross className="-right-2 -top-2" />
        <Cross className="-bottom-2 -left-2" />
        <Cross className="-bottom-2 -right-2" />
        <Cross className="-top-2 left-[36%]" />
        <Cross className="-bottom-2 left-[36%]" />
      </div>

      <div className="relative mx-auto grid h-full w-full max-w-7xl items-center gap-10 px-6 py-20 lg:grid-cols-[minmax(0,0.36fr)_minmax(0,0.64fr)] lg:py-0 2xl:max-w-[88rem]">
        <div className="relative">
          <p className="flex items-center gap-4 text-overline tracking-[0.28em] text-muted-foreground">
            Bool workspace <span aria-hidden="true" className="h-px w-24 bg-border" />
          </p>
          {/* one block of copy per app, stacked in one grid cell on desktop; the current one shows */}
          <div className="mt-10 grid gap-14 lg:gap-0">
            {ROOMS.map((room, i) => {
              const [a, b, c] = room.headline
              return (
                <div key={room.id} data-office-copy={room.id} className="lg:[grid-area:1/1]">
                  <p className="flex items-center gap-3 text-overline tracking-[0.28em] text-(--brand)">
                    {String(i + 1).padStart(2, '0')} · {room.title}
                    <span aria-hidden="true" className="h-px w-10 bg-(--brand)/60" />
                  </p>
                  <h2 className="mt-5 text-balance text-[clamp(2.25rem,3.4vw,3.6rem)] font-light leading-[1.02] tracking-[-0.035em] text-foreground">
                    {a} <span className="text-(--brand)">{b}</span>
                    {c.startsWith('.') ? c : ` ${c}`}
                  </h2>
                  <p className="mt-6 max-w-sm text-pretty text-[clamp(1rem,1.15vw,1.15rem)] leading-relaxed text-muted-foreground">{room.body}</p>
                </div>
              )
            })}
          </div>
          {/* where the visitor is: a hairline per app, the current one amber */}
          <ol aria-label="Apps" className="mt-12 hidden gap-2 lg:flex">
            {ROOMS.map((room) => (
              <li key={room.id} data-office-step={room.id} className="office-step" title={room.title} />
            ))}
          </ol>
        </div>

        {/* the drawing: still; only the light moves through it */}
        <div className="relative aspect-[3/2] w-full">
          <img src={OFFICE.src} alt="An office in which each Bool app has its room" width={OFFICE.width} height={OFFICE.height} decoding="async" className="absolute inset-0 size-full select-none" draggable={false} />
          <svg aria-hidden="true" viewBox={`0 0 ${OFFICE.width} ${OFFICE.height}`} className="absolute inset-0 size-full">
            <defs>
              <linearGradient id="office-wash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f6a24d" stopOpacity="0.22" />
                <stop offset="1" stopColor="#f28213" stopOpacity="0.08" />
              </linearGradient>
            </defs>
            {ROOMS.map((r) => (
              <polygon key={r.id} data-office-lit={r.id} points={pts(r.outline)} fill="url(#office-wash)" className="invisible" />
            ))}
          </svg>
          {/* the lit room's own lines, in amber */}
          {ROOMS.map((r) => (
            <div key={r.id} data-office-lit={r.id} aria-hidden="true" className="invisible absolute inset-0 bg-size-[100%_100%]" style={{ backgroundImage: `url(${OFFICE.lines})`, ...clip(r) }} />
          ))}
          <svg aria-hidden="true" viewBox={`0 0 ${OFFICE.width} ${OFFICE.height}`} className="absolute inset-0 size-full overflow-visible">
            {ROOMS.filter((r) => r.route).map((r) => (
              <polyline key={r.id} data-office-route={r.id} points={pts(r.route!)} fill="none" stroke="#f28213" strokeWidth={2.5} strokeDasharray="0 9" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="invisible" />
            ))}
          </svg>
          {/* each room's card: above its pin, on a short amber leader */}
          {ROOMS.map((r) => {
            const Icon = r.icon
            return (
              <div key={r.id} data-office-card={r.id} className="invisible absolute" style={pct(r.pin)}>
                <span aria-hidden="true" className="absolute -left-[5px] -top-[5px] size-2.5 rounded-full bg-[#f28213] shadow-[0_0_0_5px_rgb(242_130_19/0.18)]" />
                <span aria-hidden="true" className="absolute bottom-0 left-0 h-12 w-px bg-[#f28213]" />
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
