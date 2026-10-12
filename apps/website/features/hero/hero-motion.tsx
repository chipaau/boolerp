'use client'

import { useRef } from 'react'
import type { ReactNode } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { useGSAP } from '@gsap/react'
import { DEPTH, LAND_DURATION, RATE, TIMING, buildFlight } from './flight'
import type { FlightBox } from './flight'
import type { BeePose } from './bee'

gsap.registerPlugin(useGSAP, MotionPathPlugin)

type Clip = Exclude<BeePose, 'rest'>

/** How long the opening waits for its clips before the hero simply settles without them. */
const CLIP_WAIT_MS = 1500

/**
 * The hero's one client piece: it wraps the server-rendered hero and plays the opening once.
 * Everything it animates is already on the page in its final state; html[data-hero-motion]
 * (set by the inline script in hero.tsx, styled in globals.css) holds the opening state until
 * the timeline takes over, and "done" releases it.
 *
 * Desktop flies the full path, tablet the same faster, mobile only the landing. Reduced motion,
 * data saver, clips that are not ready in time, or a breakpoint change after the opening all
 * leave the hero as rendered.
 */
export function HeroMotion({ children, className }: { children: ReactNode; className?: string }) {
  const scope = useRef<HTMLDivElement>(null)
  const played = useRef(false)

  useGSAP(
    () => {
      const hero = scope.current
      if (!hero) return
      const html = document.documentElement
      const q = gsap.utils.selector(hero)
      const bee = q('[data-bee]')[0] as HTMLElement | undefined
      const scene = q('[data-hero-scene]')[0] as HTMLElement | undefined
      const focus = q('[data-hero-focus]')
      const reveals = q('[data-hero-reveal]')

      const finish = () => {
        played.current = true
        html.dataset.heroMotion = 'done'
      }
      // no flight: bring the hero into focus quickly and stop
      const settle = () => {
        gsap.to(focus, { opacity: 0, duration: 0.5, ease: 'sine.out' })
        gsap.to(reveals, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', onComplete: finish })
      }
      if (!bee || !scene) return finish()

      const video = (clip: Clip) => q(`[data-clip="${clip}"]`)[0] as HTMLVideoElement
      const pose = (p: BeePose) => ({ attr: { 'data-pose': p } })
      const play = (clip: Clip, rate: number, tl: gsap.core.Timeline) => () => {
        const v = video(clip)
        v.currentTime = 0
        v.playbackRate = rate * tl.timeScale()
        void v.play().catch(() => {})
      }

      const mm = gsap.matchMedia()
      mm.add(
        {
          reduce: '(prefers-reduced-motion: reduce)',
          mobile: '(max-width: 767.98px)',
          tablet: '(min-width: 768px) and (max-width: 1023.98px)',
          desktop: '(min-width: 1024px)', // the handler runs only when some condition matches
        },
        (ctx) => {
          const { reduce, mobile, tablet } = ctx.conditions as Record<string, boolean>
          const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
          if (played.current) return finish()
          if (reduce || saveData) return settle()

          let alive = true
          const needed: Clip[] = mobile ? ['land'] : ['fly', 'swoop', 'land']
          // a named add() is not run now: it returns the function, bound to this media context
          const start = ctx.add('start', () => {
              if (!alive) return
              const tl = gsap.timeline({ onComplete: finish })
              if (tablet) tl.timeScale(1.2)
              if (mobile) landing(tl)
              else flight(tl, measure(scene, bee))
            })
          ready(needed.map(video), CLIP_WAIT_MS).then(() => start(), () => alive && settle())
          return () => {
            alive = false
            needed.forEach((clip) => video(clip).pause())
          }
        }
      )

      /** Mobile: the bee is already over the stone; the landing clip brings it down. */
      function landing(tl: gsap.core.Timeline) {
        tl.set(bee!, { opacity: 1, ...pose('land') }, 0)
          .call(play('land', RATE.land, tl), [], 0)
          .to(focus, { opacity: 0, duration: 0.8, ease: 'sine.out' }, 0.2)
          .to(reveals, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.06 }, 0.3)
          .set(bee!, pose('rest'), LAND_DURATION)
      }

      function flight(tl: gsap.core.Timeline, box: FlightBox) {
        const path = buildFlight(box)
        const T = TIMING
        const facing = q('[data-bee-facing]')

        tl.set(bee!, { ...path.start, opacity: 1, scale: DEPTH.entry, rotation: -3, ...pose('fly') }, 0)
          .set(facing, { scaleX: -1 }, 0) // the clips face left; mirror for the crossing
          .call(play('fly', RATE.fly, tl), [], 0)

          // 1 · far away, left → right
          .to(bee!, { motionPath: { path: path.crossing, curviness: 1.2 }, duration: T.crossEnd, ease: 'sine.inOut' }, 0)
          .to(bee!, { scale: DEPTH.crossing, rotation: -5, duration: T.crossEnd, ease: 'sine.inOut' }, 0)

          // 2 · bank: a short hook while it turns to face left (the flip reads as the turn)
          .to(bee!, { motionPath: { path: path.bank, curviness: 1.5 }, duration: T.bankEnd - T.crossEnd, ease: 'sine.inOut' }, T.crossEnd)
          .to(facing, { scaleX: 1, duration: T.bankEnd - T.crossEnd, ease: 'sine.inOut' }, T.crossEnd)
          .to(bee!, { scale: DEPTH.bank, rotation: 2, duration: T.bankEnd - T.crossEnd }, T.crossEnd)

          // 3 · the swoop: toward the camera, turning to look at it, largest in the middle
          .set(bee!, pose('swoop'), T.bankEnd)
          .call(play('swoop', RATE.swoop, tl), [], T.bankEnd)
          .to(bee!, { motionPath: { path: path.swoop, curviness: 1.3 }, duration: T.closest - T.bankEnd, ease: 'sine.in' }, T.bankEnd)
          .to(bee!, { scale: DEPTH.closest, rotation: 0, duration: T.closest - T.bankEnd, ease: 'sine.inOut' }, T.bankEnd)

          // 4 · down to the stone, shrinking back to life size; the landing clip finishes it
          .to(bee!, { motionPath: { path: path.descent, curviness: 1 }, duration: T.arrive - T.closest, ease: 'power2.out' }, T.closest)
          .to(bee!, { scale: DEPTH.landed, duration: T.arrive - T.closest, ease: 'power2.out' }, T.closest)
          .set(bee!, pose('land'), T.land)
          .call(play('land', RATE.land, tl), [], T.land)
          .set(bee!, pose('rest'), T.land + LAND_DURATION)

          // focus pull, and the page settling in around the landing
          .to(focus, { opacity: 0, duration: T.focus[1] - T.focus[0], ease: 'sine.inOut' }, T.focus[0])
          .to(q('[data-hero-reveal="copy"]'), { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.08 }, 2.4)
          .to(q('[data-hero-reveal="dashboard"]'), { opacity: 1, duration: 0.9, ease: 'sine.out' }, 2.6)
          .to(q('[data-hero-reveal="cta"]'), { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 3.0)
      }

      return () => mm.revert()
    },
    { scope }
  )

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  )
}

/** Starts loading the clips; resolves once each can play through, rejects after `ms` or on error. */
function ready(videos: HTMLVideoElement[], ms: number) {
  return Promise.race([
    Promise.all(
      videos.map((v) => {
        v.preload = 'auto'
        if (v.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return
        return new Promise<void>((resolve, reject) => {
          v.addEventListener('canplaythrough', () => resolve(), { once: true })
          v.addEventListener('error', () => reject(new Error('clip failed')), { once: true })
          v.load()
        })
      })
    ),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('clips too slow')), ms)),
  ])
}

/** Scene size and the bee's resting feet within it, measured with no transform applied. */
function measure(scene: HTMLElement, bee: HTMLElement): FlightBox {
  gsap.set(bee, { clearProps: 'transform' })
  const s = scene.getBoundingClientRect()
  const target = (bee.parentElement as HTMLElement).getBoundingClientRect() // the landing target point
  return { width: s.width, height: s.height, home: { x: target.left - s.left, y: target.top - s.top } }
}
