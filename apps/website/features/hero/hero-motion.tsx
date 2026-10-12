'use client'

import { useRef } from 'react'
import type { ReactNode } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { useGSAP } from '@gsap/react'
import { ARRIVE, DESCENT, FRAME, LAND, LAND_GROWTH, RATE, SCENE_TIMING, buildFlight, smoothThrough } from './flight'
import type { FlightBox } from './flight'

gsap.registerPlugin(useGSAP, MotionPathPlugin)

/** How long the opening waits for its clips before the hero simply stays as rendered. */
const CLIP_WAIT_MS = 1500
/** The crossfade from the flying bee to the landing clip. */
const HANDOFF = 0.15

/**
 * The hero's one client piece: it wraps the server-rendered hero and plays the opening once.
 * Everything it animates is already on the page in its final state (the bee landed, the copy
 * shown); html[data-hero-motion] (set by the inline script in hero.tsx, styled in globals.css)
 * holds the opening state until the timeline takes over, and "done" releases it. The headline,
 * navigation and dashboard are never held: the opening adds to the hero, it never gates it.
 *
 * Desktop flies the full route, tablet the same faster, mobile only the landing. Reduced motion,
 * data saver, clips that are not ready in time, or a breakpoint change after the opening leave
 * the hero as rendered. Only transforms and opacity are animated.
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
      const one = <T extends Element>(sel: string) => hero.querySelector<T>(sel) ?? undefined
      const scene = one<HTMLElement>('[data-hero-scene]')
      const air = one<HTMLElement>('[data-bee-air]')
      const landed = one<HTMLElement>('[data-bee-landed]')
      const target = one<HTMLElement>('[data-bee-landing-target]')
      const shadow = one<HTMLElement>('[data-bee-shadow]')
      const airClip = one<HTMLVideoElement>('[data-bee-clip="air"]')
      const landClip = one<HTMLVideoElement>('[data-bee-clip="land"]')
      const rest = one<HTMLElement>('[data-bee-rest]')
      const stage = one<HTMLElement>('[data-hero-stage]')
      const display = one<HTMLElement>('[data-tablet-display]')
      const reveals = q('[data-hero-reveal]')

      const finish = () => {
        played.current = true
        html.dataset.heroMotion = 'done'
      }
      // no flight: show the copy and the landed bee, and stop
      const settle = () => {
        gsap.to([landed, ...reveals], { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', onComplete: finish })
        gsap.to(shadow ?? [], { opacity: 0.18, duration: 0.5 })
        gsap.to(stage ?? [], { filter: 'blur(0px)', scale: 1, duration: 0.5, ease: 'sine.out' })
        gsap.to(display ?? [], { opacity: 1, filter: 'blur(0px)', duration: 0.5, delay: 0.2 })
      }
      if (!scene || !air || !landed || !target || !shadow || !airClip || !landClip || !rest || !stage || !display) return finish()

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
          const clips = mobile ? [landClip] : [airClip, landClip]
          clips.forEach((v) => (v.src = clipSrc(v.dataset.beeClip!)))
          // a named add() is not run now: it returns the function, bound to this media context
          const start = ctx.add('start', () => {
            if (!alive) return
            const tl = gsap.timeline({ onComplete: finish })
            if (tablet) tl.timeScale(1.2)
            if (mobile) {
              landing(tl, 0.6)
              surroundings(tl, { focused: 1.2, screen: [0.8, 2] })
            } else {
              flight(tl, measure(scene, air, target))
              surroundings(tl, SCENE_TIMING)
            }
            // the supporting copy settles in while the bee is still in the air
            tl.to(reveals, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.1 }, mobile ? 0.2 : 1.2)
          })
          ready(clips, CLIP_WAIT_MS).then(
            () => start(),
            () => alive && settle(),
          )
          return () => {
            alive = false
            clips.forEach((v) => v.pause())
          }
        },
      )

      // clips play at the timeline's speed, so tablet's faster flight keeps them in step
      const play = (v: HTMLVideoElement, rate: number, tl: gsap.core.Timeline) => () => {
        v.currentTime = 0
        v.playbackRate = rate * tl.timeScale()
        void v.play().catch(() => {})
      }

      /** The landing clip at the target from `at`, the shadow firming up as the feet touch, then the still. */
      function landing(tl: gsap.core.Timeline, at: number) {
        const touch = at + LAND.touchdown
        const end = at + LAND.duration
        tl.set(rest!, { opacity: 0 }, 0)
          // held at one size while the clip's bee grows as it comes in (flight.ts, LAND_GROWTH)
          .set(landed!, { transformOrigin: `50% ${FRAME.feetY * 100}%`, scale: 1 / LAND_GROWTH.from }, 0)
          .to(landed!, { scale: 1, duration: LAND_GROWTH.end - LAND_GROWTH.start, ease: 'none' }, at + LAND_GROWTH.start)
          .set(landClip!, { opacity: 1 }, at)
          .call(play(landClip!, RATE, tl), [], at)
          .to(landed!, { opacity: 1, duration: HANDOFF, ease: 'none' }, at)
          .fromTo(shadow!, { opacity: 0.1, scale: 0.85 }, { opacity: 0.18, scale: 1, duration: 0.35, ease: 'sine.out' }, touch - 0.15)
          // the still is the clip's last frame, so the swap is invisible; it frees the decoder
          .set(rest!, { opacity: 1 }, end)
          .set(landClip!, { opacity: 0 }, end)
      }

      /**
       * The scene around the bee: it comes into focus, then the tablet's screen wakes: the
       * dashboard brightens from dark and sharpens. Blur is the one property here that is not a
       * transform or opacity; it runs briefly, on the stage layer and the screen only.
       */
      function surroundings(tl: gsap.core.Timeline, t: { focused: number; screen: [number, number] }) {
        const [on, sharp] = t.screen
        tl.fromTo(stage!, { filter: `blur(${SCENE_TIMING.blur}px)`, scale: 1.03 }, { filter: 'blur(0px)', scale: 1, duration: t.focused, ease: 'sine.out' }, 0)
          .fromTo(display!, { opacity: 0, filter: 'blur(8px)' }, { opacity: 1, duration: (sharp - on) * 0.6, ease: 'sine.out' }, on)
          .to(display!, { filter: 'blur(0px)', duration: sharp - on, ease: 'power2.out' }, on)
      }

      /**
       * The flight: one smooth curve through the marks (flight.ts), flown with one easing over
       * its whole length so the speed only ever eases off, gliding to a stop as it lands (the marks
       * shape the curve; their times set depth and drift). No rotation: the footage carries the
       * bee's orientation. Then the landing.
       */
      function flight(tl: gsap.core.Timeline, box: FlightBox) {
        const marks = buildFlight(box)
        const times = marks.map((m) => m.t)
        const raw = MotionPathPlugin.arrayToRawPath(marks.map((m) => m.point), { curviness: 1 })
        MotionPathPlugin.cacheRawPathMeasurements(raw)
        const at = (p: number) => MotionPathPlugin.getPositionOnPath(raw, Math.min(1, Math.max(0, p)))
        const glide = gsap.parseEase('power1.out')
        const progress = (t: number) => glide(Math.min(1, t / ARRIVE))
        const depth = smoothThrough(times, marks.map((m) => m.scale), 0)
        const life = smoothThrough(times, marks.map((m) => m.life), 0)

        const setX = gsap.quickSetter(air!, 'x', 'px')
        const setY = gsap.quickSetter(air!, 'y', 'px')
        const setScale = gsap.quickSetter(air!, 'scale')
        const clock = { t: 0 }
        const draw = () => {
          const t = clock.t
          const p = at(progress(t))
          const l = life(t)
          setX(p.x + l * 2.5 * Math.sin(t * 2 * Math.PI * 0.9))
          setY(p.y + l * 2 * Math.sin(t * 2 * Math.PI * 1.3 + 1))
          setScale(depth(t))
        }

        // placed by its feet, scaled about its centre (so it grows evenly toward the camera); it starts
        // off-screen, so it flies in rather than fading in
        tl.set(air!, { xPercent: -50, yPercent: -FRAME.feetY * 100, transformOrigin: '50% 50%', opacity: 1 }, 0)
          .set(shadow!, { opacity: 0 }, 0)
          .call(draw, [], 0)
          // the airborne clip already has RATE built into its frames; the landing clip is played at it
          .call(play(airClip!, 1, tl), [], 0)
          .to(clock, { t: ARRIVE, duration: ARRIVE, ease: 'none', onUpdate: draw }, 0)
          // the shadow appears as the bee drifts down, growing as it nears
          .fromTo(shadow!, { opacity: 0, scale: 0.6 }, { opacity: 0.1, scale: 0.85, duration: ARRIVE - DESCENT, ease: 'sine.in' }, DESCENT)
          // hand over: the landing clip continues the same footage where the flying bee is
          .to(air!, { opacity: 0, duration: HANDOFF, ease: 'none' }, ARRIVE)
          .call(() => airClip!.pause(), [], ARRIVE + HANDOFF)
        landing(tl, ARRIVE)
      }

      return () => mm.revert()
    },
    { scope },
  )

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  )
}

/**
 * The clips are transparent video: VP9 with alpha in WebM for Chromium and Firefox, HEVC with alpha
 * for WebKit, which plays WebM without its alpha. Every iOS browser is WebKit, and none of them
 * says "Chrome" in its user agent, so this test covers them too.
 */
function clipSrc(name: string) {
  const webkit = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  return `/hero/bee/bee-${name}.${webkit ? 'mp4' : 'webm'}`
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
      }),
    ),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('clips too slow')), ms)),
  ])
}

/** The scene's size, the landed feet in it and the bee's frame width, measured untransformed. */
function measure(scene: HTMLElement, air: HTMLElement, target: HTMLElement): FlightBox {
  const s = scene.getBoundingClientRect()
  const t = target.getBoundingClientRect()
  return { width: s.width, height: s.height, feet: { x: t.left - s.left, y: t.top - s.top }, frame: air.offsetWidth }
}
