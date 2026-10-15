'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { OFFICE, ROOMS, centreOf } from './rooms'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/** How close the camera comes to a lit room, and how far it turns toward it (0 stays put, 1 centres it). */
const CAMERA = { scale: 1.2, follow: 0.42 } as const
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ')
const pct = ([x, y]: [number, number]) => ({ left: `${(x / OFFICE.width) * 100}%`, top: `${(y / OFFICE.height) * 100}%` })

/**
 * "Inside your workspace": an isometric office in which each app has its room. On desktop the section
 * is pinned while the visitor scrolls; the list on the left steps through the apps and, for each, its
 * room lights up amber while the rest of the building dims, the drawing turns and comes a little
 * closer to it, and a card rises out of it with one thing that app knows (Requests also draws its
 * route from the desk to the store). The page settles on each app. Scrubbed, so it runs both ways.
 * Below lg, and with reduced motion, nothing is pinned: the list and the whole office, unlit.
 */
export function Office() {
  const section = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const q = gsap.utils.selector(section)
        const camera = q('[data-office-camera]')[0]
        const items = q('[data-office-item]')
        const n = ROOMS.length
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } })
        gsap.set(q('[data-office-dim]'), { opacity: 0 })
        gsap.set([...q('[data-office-light]'), ...q('[data-office-card]')], { autoAlpha: 0 })
        gsap.set(q('[data-office-card]'), { y: 14 })
        gsap.set(q('[data-office-hole]'), { attr: { 'fill-opacity': 0 } })

        // the building dims, then each room in turn: lit, approached, its card up; then on to the next
        tl.to(q('[data-office-dim]'), { opacity: 1, duration: 0.5 }, 0)
        ROOMS.forEach((room, i) => {
          const at = 0.5 + i
          const c = centreOf(room)
          const s = CAMERA.scale
          const light = q(`[data-office-light="${room.id}"]`)
          const hole = q(`[data-office-hole="${room.id}"]`)
          const card = q(`[data-office-card="${room.id}"]`)
          tl.addLabel(room.id, at + 0.7) // settled: lit, close and its card fully up
            .to(camera, { scale: s, xPercent: (0.5 - c.x * s) * 100 * CAMERA.follow, yPercent: (0.5 - c.y * s) * 100 * CAMERA.follow, duration: 0.7 }, at)
            .to(light, { autoAlpha: 1, duration: 0.35 }, at + 0.15)
            .to(hole, { attr: { 'fill-opacity': 1 }, duration: 0.35 }, at + 0.15)
            .to(card, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, at + 0.3)
            .to(items[i], { '--on': 1, duration: 0.3 }, at + 0.1)
          const route = q(`[data-office-route="${room.id}"]`)[0] as Element | undefined
          // the route draws on from the desk: revealed along its length by a growing clip
          if (route) tl.fromTo(route, { autoAlpha: 1, clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0%)', duration: 0.5, ease: 'none' }, at + 0.3)
          if (i < n - 1) {
            const out = at + 0.9
            tl.to([...light, ...card, ...(route ? [route] : [])], { autoAlpha: 0, duration: 0.3 }, out)
              .to(hole, { attr: { 'fill-opacity': 0 }, duration: 0.3 }, out)
              .to(items[i], { '--on': 0, duration: 0.3 }, out)
          }
        })
        tl.to({}, { duration: 0.3 }) // the last room stays a beat before the pin lets go

        // resting points: each room, and the section's start and end so the page can leave it either way
        const labels = [0, ...ROOMS.map((r) => tl.labels[r.id] / tl.duration()), 1]
        ScrollTrigger.create({
          trigger: section.current,
          start: 'top top',
          end: () => `+=${innerHeight * (n * 0.9 + 0.4)}`,
          pin: true,
          scrub: 0.6,
          animation: tl,
          snap: { snapTo: labels, duration: { min: 0.3, max: 0.8 }, delay: 0.08, ease: 'power2.inOut' },
        })
      })
      return () => mm.revert()
    },
    { scope: section },
  )

  return (
    <section ref={section} id="workspace" className="relative overflow-hidden bg-background lg:h-svh">
      {/* a faint drafting grid behind the drawing */}
      <div aria-hidden="true" className="office-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid h-full w-full max-w-7xl items-center gap-10 px-6 py-20 lg:grid-cols-[minmax(0,0.36fr)_minmax(0,0.64fr)] lg:py-0 2xl:max-w-[88rem]">
        <div>
          <p className="text-overline tracking-[0.28em] text-muted-foreground">Inside your workspace</p>
          <h2 className="mt-4 text-balance text-[clamp(2rem,3vw,3rem)] font-light leading-[1.05] tracking-[-0.03em] text-foreground">
            Every team, one building.
          </h2>
          <ol className="mt-10 space-y-1">
            {ROOMS.map((room, i) => (
              <li key={room.id} data-office-item="" className="office-item relative grid grid-cols-[2.25rem_1fr] gap-x-3 py-3 pl-1">
                <span className="office-num text-sm tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="office-title text-[17px]">{room.title}</h3>
                  <p className="office-body mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{room.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* the drawing has the column's width; as the camera moves it may run past the column to the
            right and over the section's height, but fades out softly before the copy on the left */}
        <div className="relative aspect-[3/2] w-full [container-type:inline-size] lg:aspect-auto lg:self-stretch">
          <div className="absolute inset-y-0 -right-[50vw] left-0 lg:[mask-image:linear-gradient(to_right,transparent,black_6%)]">
          <div data-office-camera="" className="absolute left-0 top-[calc(50%-100cqw/3)] aspect-[3/2] w-[100cqw] origin-top-left will-change-transform">
            <img src={OFFICE.src} alt="An office in which each Bool app has its room" width={OFFICE.width} height={OFFICE.height} decoding="async" className="absolute inset-0 size-full select-none" draggable={false} />
            <svg aria-hidden="true" viewBox={`0 0 ${OFFICE.width} ${OFFICE.height}`} className="absolute inset-0 size-full overflow-visible">
              <defs>
                {/* the building dims everywhere but the lit room */}
                <mask id="office-dim-mask" maskUnits="userSpaceOnUse">
                  <rect width={OFFICE.width} height={OFFICE.height} fill="white" />
                  {ROOMS.map((r) => (
                    <polygon key={r.id} data-office-hole={r.id} points={pts(r.outline)} fill="black" fillOpacity={0} />
                  ))}
                </mask>
                <linearGradient id="office-wash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f6a24d" stopOpacity="0.32" />
                  <stop offset="1" stopColor="#f28213" stopOpacity="0.14" />
                </linearGradient>
              </defs>
              <rect data-office-dim="" width={OFFICE.width} height={OFFICE.height} fill="var(--background)" fillOpacity={0.55} mask="url(#office-dim-mask)" />
              {ROOMS.map((r) => (
                <g key={r.id} data-office-light={r.id} className="invisible">
                  <polygon points={pts(r.outline)} fill="url(#office-wash)" style={{ mixBlendMode: 'multiply' }} />
                  <polygon points={pts(r.outline)} fill="none" stroke="#f28213" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  <circle cx={r.pin[0]} cy={r.pin[1]} r={7} fill="#f28213" />
                  <circle cx={r.pin[0]} cy={r.pin[1]} r={15} fill="#f28213" fillOpacity={0.2} />
                </g>
              ))}
              {ROOMS.filter((r) => r.route).map((r) => (
                <polyline key={r.id} data-office-route={r.id} points={pts(r.route!)} fill="none" stroke="#f28213" strokeWidth={2.5} strokeDasharray="0 9" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="invisible" />
              ))}
            </svg>
            {/* each room's card: up and to the right of its pin, on a short leader */}
            {ROOMS.map((r) => {
              const Icon = r.icon
              return (
                <div key={r.id} data-office-card={r.id} className="invisible absolute" style={pct(r.pin)}>
                  <span aria-hidden="true" className="absolute bottom-0 left-0 h-12 w-px origin-bottom bg-[#f28213]" />
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
        </div>
      </div>
    </section>
  )
}
