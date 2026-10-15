'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { OFFICE, ROOMS, centreOf } from './rooms'
import type { Room } from './rooms'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/** The camera never comes closer than this, so the drawing stays sharp. */
const MAX_ZOOM = 1.25

const pct = ([x, y]: [number, number]) => ({ left: `${(x / OFFICE.width) * 100}%`, top: `${(y / OFFICE.height) * 100}%` })

/** How close the camera comes: a little for one island, not at all for a few spread across the map. */
function zoomFor(room: Room) {
  const l = Math.min(...room.areas.map((a) => a[0]))
  const r = Math.max(...room.areas.map((a) => a[2]))
  const t = Math.min(...room.areas.map((a) => a[1]))
  const b = Math.max(...room.areas.map((a) => a[3]))
  const fill = Math.max((r - l) / OFFICE.width, (b - t) / OFFICE.height)
  return Math.min(MAX_ZOOM, Math.max(1, 0.45 / fill))
}

/** A slice of a real app screen, shown at its own proportions. */
function UiSlice({ ui }: { ui: Room['ui'] }) {
  const [x0, y0, x1, y1] = ui.box
  const w = x1 - x0
  const h = y1 - y0
  return (
    <div
      aria-hidden="true"
      className="office-ui"
      style={{
        // at most 150px tall: a glimpse of the app, not a screenshot
        width: `min(100%, ${(150 * w) / h}px)`,
        aspectRatio: `${w} / ${h}`,
        backgroundImage: `url(${ui.src})`,
        backgroundSize: `${(1600 / w) * 100}% auto`,
        backgroundPosition: `${(x0 / (1600 - w)) * 100}% ${(y0 / (1000 - h)) * 100}%`,
      }}
    />
  )
}

/**
 * "Inside your workspace": the answer to "does it cover what we do, and does it all fit together?".
 * On desktop the section is pinned: on the left the story (the promise, the apps as a list; the
 * current one opens to its value, its features and a slice of the real app), on the right the
 * workspace map, where the current app's islands come forward from under a cream veil, the camera
 * eases toward them, and only their walkways into the hub run. At the end every island lights.
 * Follows the scroll freely; clicking an app goes to it. Below lg, and with reduced motion, nothing
 * is pinned and every app's story is open.
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
          item: q(`[data-office-item="${id}"]`),
          detail: q(`[data-office-detail="${id}"]`),
        })
        const fit = () => Math.min(1, stage.clientWidth / camera.offsetWidth, (stage.clientHeight * 0.95) / camera.offsetHeight)
        const shot = (c: { x: number; y: number }, z: number) => ({
          scale: () => fit() * z,
          x: () => stage.clientWidth * 0.5 - c.x * camera.offsetWidth * fit() * z,
          y: () => stage.clientHeight * 0.5 - c.y * camera.offsetHeight * fit() * z,
        })
        const whole = shot({ x: 0.5, y: 0.5 }, 1)
        ROOMS.forEach((r) => {
          const p = parts(r.id)
          gsap.set(p.lit, { autoAlpha: 0 })
          gsap.set(p.veil, { autoAlpha: 1 })
          gsap.set(p.item, { '--on': 0 })
          gsap.set(p.detail, { height: 0, autoAlpha: 0 })
        })
        gsap.set(camera, { transformOrigin: '0 0', ...whole })
        gsap.set(q('[data-office-all]'), { autoAlpha: 0, y: 8 })

        const tl = gsap.timeline()
        ROOMS.forEach((room, k) => {
          const to = parts(room.id)
          const at = k + 0.1
          if (k > 0) {
            const from = parts(ROOMS[k - 1].id)
            tl.to(from.lit, { autoAlpha: 0, duration: 0.2 }, at)
              .to(from.veil, { autoAlpha: 1, duration: 0.25 }, at)
              .to(from.item, { '--on': 0, duration: 0.2 }, at)
              .to(from.detail, { height: 0, autoAlpha: 0, duration: 0.25, ease: 'power2.inOut' }, at)
          }
          tl.to(camera, { ...shot(centreOf(room), zoomFor(room)), duration: 0.45, ease: 'power2.inOut' }, at)
            .to(to.veil, { autoAlpha: 0, duration: 0.3, stagger: 0.04 }, at + 0.12)
            .to(to.lit, { autoAlpha: 1, duration: 0.3, stagger: 0.04 }, at + 0.15)
            .to(to.item, { '--on': 1, duration: 0.2 }, at + 0.1)
            .to(to.detail, { height: 'auto', autoAlpha: 1, duration: 0.3, ease: 'power2.out' }, at + 0.15)
            .addLabel(room.id, at + 0.45)
        })
        // the finale: the camera pulls back and every island lights at once
        const end = ROOMS.length + 0.1
        const last = parts(ROOMS[ROOMS.length - 1].id)
        tl.to(last.detail, { height: 0, autoAlpha: 0, duration: 0.25 }, end)
          .to(last.item, { '--on': 0, duration: 0.2 }, end)
          .to(camera, { ...whole, duration: 0.5, ease: 'power2.inOut' }, end)
          .to(q('[data-office-veil]'), { autoAlpha: 0, duration: 0.3, stagger: 0.03 }, end + 0.15)
          .to(q('[data-office-route]'), { autoAlpha: 1, duration: 0.3, stagger: 0.03 }, end + 0.15)
          .to(q('[data-office-all]'), { autoAlpha: 1, y: 0, duration: 0.3 }, end + 0.25)
          .addLabel('all', end + 0.6)
          .to({}, { duration: 0.3 })

        trigger.current = ScrollTrigger.create({
          trigger: section.current,
          start: 'top top',
          end: () => `+=${innerHeight * (ROOMS.length + 1)}`,
          pin: true,
          scrub: 0.8,
          animation: tl,
          invalidateOnRefresh: true,
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
      <div className="relative mx-auto grid h-full w-full max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] lg:gap-8 lg:py-0 2xl:max-w-[88rem]">
        {/* the story */}
        <div className="flex flex-col justify-center lg:py-16">
          <p className="text-overline tracking-[0.28em] text-muted-foreground">Inside your workspace</p>
          <h2 className="mt-4 text-balance text-[clamp(2rem,2.8vw,3rem)] font-light leading-[1.05] tracking-[-0.03em] text-foreground">
            Every app your team runs on, <span className="text-(--brand)">sharing one record.</span>
          </h2>
          <ol className="mt-8 border-t border-border/70">
            {ROOMS.map((room) => (
              <li key={room.id} data-office-item={room.id} className="office-item border-b border-border/70">
                <button type="button" onClick={() => go(room.id)} className="flex w-full items-center gap-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Image src={room.logo} alt="" className="office-logo h-6 w-7 object-contain" />
                  <span className="office-title text-[16px]">{room.title}</span>
                  <span className="office-tags ml-auto text-[10px] font-bold uppercase tracking-[0.14em]">{room.tags.join(' · ')}</span>
                </button>
                <div data-office-detail={room.id} className="overflow-hidden">
                  <div className="pb-4 pl-10">
                    <p className="text-[14.5px] leading-snug text-foreground">{room.value}</p>
                    <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {room.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-[13px] text-body">
                          <Check className="size-3.5 shrink-0 text-(--brand)" strokeWidth={2.6} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3.5 hidden lg:block">
                      <UiSlice ui={room.ui} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p data-office-all="" className="mt-5 text-[14px] text-muted-foreground">
            One sign-in, one set of people and sites, one record: <span className="text-foreground">add an app and it already knows your organisation.</span>
          </p>
        </div>

        {/* the map */}
        <div data-office-stage="" className="relative aspect-[3/2] overflow-hidden lg:aspect-auto">
          <div data-office-camera="" className="isolate absolute left-0 top-0 aspect-[3/2] w-full will-change-transform">
            <img src={OFFICE.src} alt="The Bool workspace as a hub, with each app an island connected to it" width={OFFICE.width} height={OFFICE.height} decoding="async" className="absolute inset-0 size-full select-none" draggable={false} />
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
            {/* the current app's walkways into the hub: dashes marching along them */}
            <svg aria-hidden="true" viewBox={`0 0 ${OFFICE.width} ${OFFICE.height}`} className="absolute inset-0 size-full overflow-visible">
              {ROOMS.flatMap((r) =>
                r.routes.map((route, i) => (
                  <polyline key={`${r.id}-${i}`} data-office-route={r.id} points={route.map(([x, y]) => `${x},${y}`).join(' ')} className="office-route invisible" vectorEffect="non-scaling-stroke" />
                )),
              )}
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}
