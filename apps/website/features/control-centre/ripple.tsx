'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Activity, Bell, LayoutDashboard, Package, ScanLine, SlidersHorizontal, UserMinus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HEX_MASK } from '@/components/hex'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * The apps one exit reaches, and what each does with it (as the Control Centre's own screens say):
 * where each sits round the hub, in the stage's box (fractions).
 */
const APPS: { id: string; icon: LucideIcon; name: string; does: string; x: number; y: number }[] = [
  { id: 'inventory', icon: Package, name: 'Inventory', does: 'Refuses to issue him stock', x: 0.13, y: 0.2 },
  { id: 'scan', icon: ScanLine, name: 'Scan', does: 'Refuses his scans', x: 0.87, y: 0.2 },
  { id: 'overview', icon: LayoutDashboard, name: 'Overview', does: 'Flags anything he still holds', x: 0.1, y: 0.8 },
  { id: 'notifications', icon: Bell, name: 'Notifications', does: 'Go to whoever holds his site now', x: 0.9, y: 0.8 },
  { id: 'activity', icon: Activity, name: 'Activity log', does: 'Records who did it, and when', x: 0.5, y: 0.97 },
]
const HUB = { x: 0.5, y: 0.47 }

/**
 * "One change": on desktop, as the stage comes into view, one person is marked as exited at the
 * Control Centre hub and the change runs out along the walkways to five apps, one after another,
 * each lighting up with what it now does. It plays once; the page scrolls as usual.
 * Below lg, and with reduced motion, the five outcomes in a grid.
 */
export function Ripple() {
  const section = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const q = gsap.utils.selector(section)
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
        tl.fromTo(q('[data-ripple-event]'), { autoAlpha: 0, y: 16, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0)
          .to(q('[data-ripple-hub]'), { scale: 1.08, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 }, 0.45)
        APPS.forEach((app, i) => {
          const at = 0.8 + i * 0.5
          tl.fromTo(q(`[data-ripple-line="${app.id}"]`), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, ease: 'power1.inOut' }, at)
            .fromTo(q(`[data-ripple-app="${app.id}"]`), { '--lit': 0 }, { '--lit': 1, duration: 0.25 }, at + 0.4)
            .fromTo(q(`[data-ripple-app="${app.id}"] [data-ripple-does]`), { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out' }, at + 0.4)
        })
        const end = tl.duration()
        tl.to(q('[data-ripple-caption="start"]'), { autoAlpha: 0, y: -10, duration: 0.3 }, end)
          .fromTo(q('[data-ripple-caption="end"]'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.3 }, end + 0.15)

        // it plays through once, at its own pace, when the stage is well in view
        const st = ScrollTrigger.create({
          trigger: q('[data-ripple-stage]')[0],
          start: 'top 65%',
          once: true,
          onEnter: () => tl.play(),
        })
        return () => st.kill()
      })
      return () => mm.revert()
    },
    { scope: section },
  )

  return (
    <section ref={section} className="relative overflow-hidden bg-ink lg:motion-safe:pb-(--section-y)">
      <div aria-hidden="true" className="office-grid-dark pointer-events-none absolute inset-0" />

      {/* the caption: what happens, then what came of it */}
      <div className="section-t relative mx-auto grid max-w-3xl gutter text-center">
        <h2 data-ripple-caption="start" className="section-title text-[#f6eee3] [grid-area:1/1]">
          One change in Control Centre.
        </h2>
        <h2 data-ripple-caption="end" aria-hidden="true" className="section-title invisible text-[#f6eee3] [grid-area:1/1]">
          Every app <span className="text-(--brand-soft)">already has it.</span>
        </h2>
      </div>

      {/* desktop: the hub, the walkways and the apps */}
      <div data-ripple-stage="" className="relative mx-auto mt-10 hidden aspect-[16/8] h-[min(62svh,40rem)] max-w-full lg:motion-safe:block">
        {/* drawn in the stage's own proportions (16:8), so the walkways keep their weight and dashes */}
        <svg aria-hidden="true" viewBox="0 0 200 100" className="absolute inset-0 size-full overflow-visible">
          {APPS.map((a) => {
            const d = `M ${HUB.x * 200} ${HUB.y * 100} L ${a.x * 200} ${a.y * 100}`
            return (
              <g key={a.id}>
                <path d={d} className="cc-ripple-rest" />
                <path d={d} data-ripple-line={a.id} pathLength={1} className="cc-ripple-line" />
              </g>
            )
          })}
        </svg>

        {/* the hub, and the change made there */}
        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${HUB.x * 100}%`, top: `${HUB.y * 100}%` }}>
          <div data-ripple-hub="" className="office-hub relative grid size-28 place-items-center">
            <span aria-hidden="true" className="absolute inset-0 bg-[#fbf5ec]" style={{ mask: HEX_MASK }} />
            <span className="relative grid place-items-center text-center">
              <SlidersHorizontal className="size-6 text-(--brand)" strokeWidth={1.7} />
              <span className="mt-1 text-[10.5px] font-bold uppercase leading-tight tracking-[0.08em] text-foreground/75">
                Control
                <br />
                Centre
              </span>
            </span>
          </div>
          <div data-ripple-event="" className="invisible absolute bottom-full left-1/2 mb-4 flex w-max -translate-x-1/2 items-center gap-2.5 rounded-full bg-(--brand-soft) py-2 pl-2 pr-4 text-[14px] font-bold text-ink shadow-[0_12px_30px_-10px_rgb(240_145_58/0.7)]">
            <span className="grid size-7 place-items-center rounded-full bg-ink/12">
              <UserMinus className="size-4" strokeWidth={2} />
            </span>
            Hugo Fernández · exited
          </div>
        </div>

        {/* the apps */}
        {APPS.map(({ id, icon: Icon, name, does, x, y }) => (
          <div key={id} data-ripple-app={id} className="cc-ripple-app absolute w-56 -translate-x-1/2 -translate-y-1/2" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
            <div className="flex items-center gap-3 rounded-2xl border px-4 py-3">
              <span className="cc-ripple-icon grid size-9 shrink-0 place-items-center rounded-xl">
                <Icon className="size-[18px]" strokeWidth={1.7} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-bold text-[#f6eee3]">{name}</span>
                <span data-ripple-does="" className="invisible block text-[12.5px] leading-snug text-[#f6eee3]/65">
                  {does}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* below lg, and with reduced motion: what each app does */}
      <ul className="section-b relative mx-auto grid max-w-5xl gap-3 gutter pt-10 sm:grid-cols-2 lg:motion-safe:hidden">
        {APPS.map(({ id, icon: Icon, name, does }) => (
          <li key={id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-(--brand-soft)/20 text-(--brand-soft)">
              <Icon className="size-[18px]" strokeWidth={1.7} />
            </span>
            <span>
              <span className="block text-[14px] font-bold text-[#f6eee3]">{name}</span>
              <span className="block text-[13px] text-[#f6eee3]/65">{does}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
