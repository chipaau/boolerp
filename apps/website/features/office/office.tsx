'use client'

import { useRef } from 'react'
import type { ReactNode } from 'react'
import Image from 'next/image'
import { ArrowRightLeft, KeyRound, ShieldCheck, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { HEX_MASK } from '@/components/hex'
import boolLogo from '@workspace/assets/logos/bool-logo.png'
import { HUB, ROOMS, STAGE, TILE, focusOf, placeOf, walkway } from './rooms'
import type { Room, Tile } from './rooms'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const pct = (x: number, y: number) => ({ left: `${(x / STAGE.width) * 100}%`, top: `${(y / STAGE.height) * 100}%` })

/** Something a card lists, with its own small orange icon. */
function Point({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="card-body flex items-center gap-3 text-foreground">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-(--brand)/10">
        <Icon className="size-4 text-(--brand)" strokeWidth={1.8} />
      </span>
      {children}
    </li>
  )
}

/** The app's card: what it does for the team, and what it does. */
function RoomCard({ room }: { room: Room }) {
  return (
    <article className="glass-card office-card p-7">
      <p className="card-label text-(--brand)">{room.title}</p>
      <h3 className="card-title mt-3 text-balance text-foreground">{room.headline}</h3>
      <ul className="mt-5 grid gap-2.5 border-t border-border/60 pt-5">
        {room.features.map((f) => (
          <Point key={f.text} icon={f.icon}>
            {f.text}
          </Point>
        ))}
      </ul>
    </article>
  )
}

/**
 * The app's card on phones and tablets, where the story doesn't play: compact, so the six read at a
 * glance (the full card is the desktop story's). Its logo, name and headline, one of its rooms drawn
 * small, and what it does, a line each.
 */
function CompactCard({ room }: { room: Room }) {
  return (
    <article className="glass-card office-card relative overflow-hidden p-5">
      <img src={`/workspace/${room.tiles[0].src}.webp`} alt="" width={900} height={675} loading="lazy" className="pointer-events-none absolute -right-3 -top-2 h-auto w-28 opacity-90" />
      <div className="flex items-center gap-3 pr-24">
        <Image src={room.logo} alt="" className="size-9 shrink-0 object-contain" />
        <p className="card-label text-(--brand)">{room.title}</p>
      </div>
      <h3 className="mt-3 pr-20 text-[1.0625rem] leading-snug text-foreground">{room.headline}</h3>
      <ul className="mt-4 grid gap-2 border-t border-border/60 pt-4">
        {room.features.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2.5 text-[14px] leading-snug text-foreground/80">
            <Icon className="mt-0.5 size-4 shrink-0 text-(--brand)" strokeWidth={1.8} />
            {text}
          </li>
        ))}
      </ul>
    </article>
  )
}

/** The end of the story: what every app shares. */
function SharedCard() {
  return (
    <article className="glass-card office-card p-7">
      <p className="card-label text-(--brand)">Every app</p>
      <h3 className="card-title mt-3 text-balance text-foreground">Add an app and it already knows your organisation</h3>
      <ul className="mt-5 grid gap-2.5 border-t border-border/60 pt-5">
        <Point icon={KeyRound}>One sign-in for every app</Point>
        <Point icon={Users}>One set of people, sites and approvals</Point>
        <Point icon={ArrowRightLeft}>Records that follow the work from app to app</Point>
        <Point icon={ShieldCheck}>One audit trail across all of it</Point>
      </ul>
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
        {/* resting in grey, and the same room in colour over it, faded in (opacity only: an animated
            filter would repaint the picture every frame) */}
        <img src={`/workspace/${tile.src}.webp`} alt="" width={900} height={675} loading="eager" decoding="async" draggable={false} className="office-tile-grey h-auto w-full select-none" />
        <img src={`/workspace/${tile.src}.webp`} alt="" width={900} height={675} loading="eager" decoding="async" draggable={false} className="office-tile-colour absolute inset-0 h-auto w-full select-none" />
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
        // the camera: leans in toward an app's rooms (origin top-left; the point brought a little right
        // of the map's middle, away from the card), and back out to the whole workspace at the end
        const camera = q('[data-office-camera]')
        const ZOOM = 1.18
        const look = (room: Room) => {
          const f = focusOf(room)
          // half way between the app's rooms and the hub, so the hub (where every app meets) stays in view
          const x = (f.x + HUB.x) / 2 / STAGE.width
          const y = (f.y + HUB.y) / 2 / STAGE.height
          return { xPercent: (0.5 - ZOOM * x) * 100, yPercent: (0.5 - ZOOM * y) * 100, scale: ZOOM }
        }
        const on = (p: ReturnType<typeof parts>, at: number, tl: gsap.core.Timeline, room: Room) =>
          tl
            .to(camera, { ...look(room), duration: 0.5, ease: 'power2.inOut' }, at - 0.05)
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
        tl.set(camera, { transformOrigin: '0 0', ...look(ROOMS[0]) }, 0)
        tl.set(q('[data-office-all]'), { autoAlpha: 0, y: 24 }, 0).addLabel(ROOMS[0].id, 0)
        ROOMS.slice(1).forEach((room, k) => {
          const at = k + 0.5
          off(parts(ROOMS[k].id), at, tl)
          on(parts(room.id), at + 0.05, tl, room)
          tl.addLabel(room.id, at + 0.45)
        })
        // the finale: every room in colour, every walkway lit, and the one line that matters
        const end = ROOMS.length - 0.5
        off(parts(ROOMS[ROOMS.length - 1].id), end, tl)
        tl.to(camera, { xPercent: 0, yPercent: 0, scale: 1, duration: 0.5, ease: 'power2.inOut' }, end)
          .to(q('[data-office-tile]'), { '--c': 1, duration: 0.35, stagger: 0.03 }, end + 0.05)
          .to(q('[data-office-route]'), { autoAlpha: 1, duration: 0.3, stagger: 0.03 }, end + 0.05)
          // and every app in the list along the foot lit with them, not left greyed under full lines
          .to(q('[data-office-step]'), { '--on': 1, duration: 0.3, stagger: 0.03 }, end + 0.2)
          .fromTo(q('[data-office-all]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out', immediateRender: false }, end + 0.15)
          .addLabel('all', end + 0.5)
          .to({}, { duration: 0.15 })
        // each app's segment along the foot of the screen fills while the story is with that app
        ROOMS.forEach((room, k) => {
          const from = k === 0 ? 0 : k - 0.45
          tl.fromTo(q(`[data-office-fill="${room.id}"]`), { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: k + 0.5 - from }, from)
        })

        trigger.current = ScrollTrigger.create({
          trigger: section.current,
          start: 'top top',
          end: () => `+=${innerHeight * (ROOMS.length + 0.5)}`,
          pin: true,
          scrub: 0.8,
          animation: tl,
          // the site's header keeps out of the way while the story holds the screen (header-motion.tsx)
          onToggle: (self) => document.documentElement.toggleAttribute('data-pinned', self.isActive),
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
    <section ref={section} id="workspace" className="relative overflow-hidden bg-background lg:motion-safe:h-svh">
      <div aria-hidden="true" className="office-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid h-full w-full max-w-7xl gap-10 gutter py-20 lg:motion-safe:grid-cols-[minmax(0,0.36fr)_minmax(0,0.64fr)] lg:items-start lg:gap-6 lg:motion-safe:pb-24 lg:motion-safe:pt-[16svh] 2xl:max-w-[88rem]">
        {/* the story: the promise, then the current app's card */}
        <div className="relative z-10">
          <p className="text-overline tracking-[0.28em] text-muted-foreground">Inside your workspace</p>
          <h2 className="section-title mt-4 text-foreground lg:w-[min(40rem,46vw)]">
            Every app your team runs on, <span className="text-(--brand)">sharing one record.</span>
          </h2>
          {/* desktop: the cards share one place and take turns */}
          <div className="mt-8 hidden lg:motion-safe:grid">
            {ROOMS.map((room) => (
              <div key={room.id} data-office-card={room.id} className="invisible [grid-area:1/1]">
                <RoomCard room={room} />
              </div>
            ))}
            <div data-office-all="" className="invisible [grid-area:1/1]">
              <SharedCard />
            </div>
          </div>
          {/* below lg (and with reduced motion): the six apps as compact cards, then what they share */}
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:motion-safe:hidden">
            {ROOMS.map((room) => (
              <CompactCard key={room.id} room={room} />
            ))}
            <div className="md:col-span-2 lg:col-span-3">
              <SharedCard />
            </div>
          </div>
        </div>

        {/* the map */}
        <div className="office-map-frame pointer-events-none absolute inset-y-0 left-[30%] right-[-8vw] hidden items-center justify-center lg:motion-safe:flex">
          {/* the map fills the right of the screen, top to bottom, fading only at the screen's own edges;
              the camera moves within it */}
          <div className="relative aspect-[16/10] h-full max-w-none">
          <div data-office-camera="" className="absolute inset-0 will-change-transform">
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
                        <circle r="3" className="office-spark">
                          <animateMotion dur="5s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
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
              {/* a cream hexagon round the logo, the brand's own shape */}
              <div className="office-hub relative grid size-24 place-items-center">
                <span aria-hidden="true" className="absolute inset-0 bg-[#fffaf2]/70" style={{ mask: HEX_MASK }} />
                <Image src={boolLogo} alt="Bool" className="relative h-12 w-auto" />
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
      {/* the apps, in order, as a line along the foot of the screen: where the story is, and a way
          to go to any of them */}
      <div className="absolute inset-x-0 bottom-0 hidden bg-linear-to-t from-background from-55% to-transparent pb-8 pt-14 lg:motion-safe:block">
        <ol className="mx-auto grid w-full max-w-7xl grid-cols-6 gap-3 gutter 2xl:max-w-[88rem]">
          {ROOMS.map((room) => (
            <li key={room.id} data-office-step={room.id} className="office-item">
              <button type="button" onClick={() => go(room.id)} className="pointer-events-auto block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {/* the app's part of the story: fills as the story passes through it */}
                <span aria-hidden="true" className="block h-[2px] overflow-hidden rounded-full bg-foreground/10">
                  <span data-office-fill={room.id} className="block h-full origin-left scale-x-0 bg-(--brand-soft)" />
                </span>
                <span className="mt-3 flex items-center gap-2">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="office-hex size-3 shrink-0">
                    <path d="M12 2 L20.66 7 V17 L12 22 L3.34 17 V7 Z" />
                  </svg>
                  <span className="office-title text-[11px] font-bold uppercase tracking-[0.14em]">{room.title}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
