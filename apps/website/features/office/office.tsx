'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import boolLogo from '@workspace/assets/logos/bool-logo.png'
import { HUB, ROOMS, STAGE, TILE, placeOf, walkway } from './rooms'
import type { Room, Tile } from './rooms'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const pct = (x: number, y: number) => ({ left: `${(x / STAGE.width) * 100}%`, top: `${(y / STAGE.height) * 100}%` })

/** A view of the real app, cropped to the part worth seeing, at its own proportions. */
function UiView({ ui }: { ui: Room['ui'] }) {
  const [x0, y0, x1, y1] = ui.box
  const w = x1 - x0
  const h = y1 - y0
  return (
    <div
      aria-hidden="true"
      className="office-ui w-full"
      style={{
        aspectRatio: `${w} / ${h}`,
        backgroundImage: `url(${ui.src})`,
        backgroundSize: `${(1600 / w) * 100}% auto`,
        backgroundPosition: `${w < 1600 ? (x0 / (1600 - w)) * 100 : 0}% ${h < 1000 ? (y0 / (1000 - h)) * 100 : 0}%`,
      }}
    />
  )
}

/** The app's card: what it is, what it is worth, what it does, and a look at it. */
function RoomCard({ room }: { room: Room }) {
  return (
    <article className="office-card p-5">
      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-(--brand)/10">
          <Image src={room.logo} alt="" className="h-7 w-8 object-contain" />
        </span>
        <div>
          <h3 className="text-[19px] font-medium leading-tight text-foreground">{room.title}</h3>
          <p className="mt-0.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-(--brand)">{room.tags.join(' · ')}</p>
        </div>
      </header>
      <p className="mt-4 text-[15px] leading-snug text-foreground">{room.value}</p>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {room.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-[13px] text-body">
            <Check className="size-3.5 shrink-0 text-(--brand)" strokeWidth={2.6} />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <UiView ui={room.ui} />
      </div>
    </article>
  )
}

/** One of an app's rooms on the map. */
function RoomTile({ room, tile }: { room: Room; tile: Tile }) {
  const at = placeOf(tile)
  return (
    <div
      data-office-tile={room.id}
      className="office-tile absolute -translate-x-1/2 -translate-y-1/2"
      style={{ ...pct(at.x, at.y), width: `${(TILE.width / STAGE.width) * 100}%` }}
    >
      <div data-office-lift="" className="relative">
        <div aria-hidden="true" className="office-tile-glow absolute inset-x-[8%] bottom-[2%] top-[30%] -z-10" />
        <img src={`/workspace/${tile.src}.webp`} alt="" width={900} height={675} loading="eager" decoding="async" draggable={false} className="h-auto w-full select-none" />
      </div>
    </div>
  )
}

/**
 * "Inside your workspace": the answer to "does it cover what we do, and does it all fit together?".
 * On desktop the section is pinned. On the right, the workspace map: the workspace as a hub, each
 * app's rooms in a ring around it, joined by dotted walkways. As the visitor scrolls, one app at a
 * time comes forward: its rooms in colour, lifted, the others resting in grey, and light runs along
 * its walkways into the hub. On the left, the app's card (the point of the section): what it is
 * worth, what it does, and a look at the real app. At the end every room lights at once. Follows
 * the scroll freely; the app names under the map go to each one. Below lg, and with reduced
 * motion, nothing is pinned: every app's card in turn, with its rooms.
 */
export function Office() {
  const section = useRef<HTMLElement>(null)
  const trigger = useRef<ScrollTrigger | null>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const q = gsap.utils.selector(section)
        section.current?.setAttribute('data-live', '')
        const parts = (id: string) => ({
          tiles: q(`[data-office-tile="${id}"]`),
          lift: q(`[data-office-tile="${id}"] [data-office-lift]`),
          route: q(`[data-office-route="${id}"]`),
          card: q(`[data-office-card="${id}"]`),
          step: q(`[data-office-step="${id}"]`),
        })
        const on = (p: ReturnType<typeof parts>, at: number, tl: gsap.core.Timeline) =>
          tl
            .to(p.tiles, { '--c': 1, duration: 0.3 }, at)
            .to(p.lift, { y: -14, duration: 0.35, ease: 'power2.out', stagger: 0.05 }, at)
            .to(p.route, { autoAlpha: 1, duration: 0.3 }, at + 0.05)
            .to(p.step, { '--on': 1, duration: 0.2 }, at)
            .fromTo(p.card, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out', immediateRender: false }, at + 0.08)
        const off = (p: ReturnType<typeof parts>, at: number, tl: gsap.core.Timeline) =>
          tl
            .to(p.tiles, { '--c': 0, duration: 0.25 }, at)
            .to(p.lift, { y: 0, duration: 0.25, ease: 'power2.inOut' }, at)
            .to(p.route, { autoAlpha: 0, duration: 0.2 }, at)
            .to(p.step, { '--on': 0, duration: 0.2 }, at)
            .to(p.card, { autoAlpha: 0, y: -20, duration: 0.2, ease: 'power1.in' }, at)

        const tl = gsap.timeline()
        // the starting state lives in the timeline (the first app forward), so a refresh re-renders it
        ROOMS.forEach((r, i) => {
          const p = parts(r.id)
          tl.set(p.tiles, { '--c': i === 0 ? 1 : 0 }, 0)
            .set(p.lift, { y: i === 0 ? -14 : 0 }, 0)
            .set(p.route, { autoAlpha: i === 0 ? 1 : 0 }, 0)
            .set(p.step, { '--on': i === 0 ? 1 : 0 }, 0)
            .set(p.card, { autoAlpha: i === 0 ? 1 : 0, y: 0 }, 0)
        })
        tl.set(q('[data-office-all]'), { autoAlpha: 0, y: 24 }, 0).addLabel(ROOMS[0].id, 0)
        ROOMS.slice(1).forEach((room, k) => {
          const at = k + 0.5
          off(parts(ROOMS[k].id), at, tl)
          on(parts(room.id), at + 0.05, tl)
          tl.addLabel(room.id, at + 0.45)
        })
        // the finale: every room in colour, every walkway lit, and the one line that matters
        const end = ROOMS.length - 0.5
        off(parts(ROOMS[ROOMS.length - 1].id), end, tl)
        tl.to(q('[data-office-tile]'), { '--c': 1, duration: 0.35, stagger: 0.03 }, end + 0.05)
          .to(q('[data-office-route]'), { autoAlpha: 1, duration: 0.3, stagger: 0.03 }, end + 0.05)
          .fromTo(q('[data-office-all]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out', immediateRender: false }, end + 0.15)
          .addLabel('all', end + 0.5)
          .to({}, { duration: 0.35 })

        trigger.current = ScrollTrigger.create({
          trigger: section.current,
          start: 'top top',
          end: () => `+=${innerHeight * (ROOMS.length + 0.5)}`,
          pin: true,
          scrub: 0.8,
          animation: tl,
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
      <div className="relative mx-auto grid h-full w-full max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[minmax(0,0.34fr)_minmax(0,0.66fr)] lg:items-center lg:gap-10 lg:py-0 2xl:max-w-[88rem]">
        {/* the story: the promise, then the current app's card */}
        <div>
          <p className="text-overline tracking-[0.28em] text-muted-foreground">Inside your workspace</p>
          <h2 className="mt-4 text-balance text-[clamp(2rem,2.6vw,2.9rem)] font-light leading-[1.05] tracking-[-0.03em] text-foreground">
            Every app your team runs on, <span className="text-(--brand)">sharing one record.</span>
          </h2>
          {/* desktop: the cards share one place and take turns */}
          <div className="mt-8 hidden lg:grid">
            {ROOMS.map((room) => (
              <div key={room.id} data-office-card={room.id} className="invisible [grid-area:1/1]">
                <RoomCard room={room} />
              </div>
            ))}
            <div data-office-all="" className="invisible self-center [grid-area:1/1]">
              <p className="text-[clamp(1.25rem,1.6vw,1.6rem)] font-light leading-snug text-foreground">
                One sign-in, one set of people and sites, one record.
              </p>
              <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                Add an app and it already knows your organisation: its people, its sites, and everything the other apps have recorded.
              </p>
            </div>
          </div>
          {/* below lg: every app's card in turn, with its rooms */}
          <div className="mt-10 grid gap-8 lg:hidden">
            {ROOMS.map((room) => (
              <div key={room.id}>
                <div className="mx-auto mb-2 flex max-w-md justify-center gap-2">
                  {room.tiles.map((t) => (
                    <img key={t.src} src={`/workspace/${t.src}.webp`} alt="" width={900} height={675} loading="lazy" className="h-auto w-1/2 max-w-48" />
                  ))}
                </div>
                <RoomCard room={room} />
              </div>
            ))}
          </div>
        </div>

        {/* the map */}
        <div className="relative hidden lg:block">
          <div className="relative aspect-[16/10] w-full">
            <svg aria-hidden="true" viewBox={`0 0 ${STAGE.width} ${STAGE.height}`} className="absolute inset-0 size-full overflow-visible">
              {ROOMS.flatMap((r) =>
                r.tiles.map((t) => {
                  const d = walkway(t)
                  return (
                    <g key={t.src}>
                      <path d={d} className="office-route-rest" vectorEffect="non-scaling-stroke" />
                      <g data-office-route={r.id} className="invisible">
                        <path id={`walk-${t.src}`} d={d} className="office-route" vectorEffect="non-scaling-stroke" />
                        {/* a spark running in along the walkway */}
                        <circle r="5" className="office-spark">
                          <animateMotion dur="2.4s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                            <mpath href={`#walk-${t.src}`} />
                          </animateMotion>
                        </circle>
                      </g>
                    </g>
                  )
                }),
              )}
            </svg>
            {ROOMS.flatMap((r) => r.tiles.map((t) => <RoomTile key={t.src} room={r} tile={t} />))}
            {/* the hub: the workspace every app joins */}
            <div className="absolute -translate-x-1/2 -translate-y-1/2" style={pct(HUB.x, HUB.y)}>
              <div className="office-hub grid size-28 place-items-center rounded-[28%] border border-border/70 bg-card shadow-[0_18px_40px_-18px_rgb(90_70_40/0.45)]">
                <Image src={boolLogo} alt="Bool" className="h-14 w-auto" />
              </div>
            </div>
          </div>
          {/* the apps, in order: where the story is, and a way to go to any of them */}
          <ol className="mt-6 flex flex-wrap justify-center gap-x-7 gap-y-2">
            {ROOMS.map((room) => (
              <li key={room.id} data-office-step={room.id} className="office-item">
                <button type="button" onClick={() => go(room.id)} className="flex flex-col items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="office-dot size-2 rounded-full" />
                  <span className="office-title text-[11px] font-bold uppercase tracking-[0.16em]">{room.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
