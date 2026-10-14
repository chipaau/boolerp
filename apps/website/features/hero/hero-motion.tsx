'use client'

import { useRef } from 'react'
import type { ReactNode } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { useGSAP } from '@gsap/react'
import { ALIVE, ARRIVE, DESCENT, FRAME, LAND, LAND_GROWTH, RATE, SCENE_TIMING, SHADOW_OPACITY, buildFlight, liftOrder, smoothThrough } from './flight'
import type { FlightBox } from './flight'
import { compactStory, scrollStory, smoothScroll, storyPerch } from './story'

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
 *
 * On desktop the hero then becomes the scroll story (story.ts): as the visitor scrolls, the bee
 * takes off and flies away, and the tablet comes to the centre to play the product demo; back at
 * the top, the bee flies in and lands again.
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
      const sharp = one<HTMLElement>('[data-tablet="sharp"]')
      const glow = one<HTMLElement>('[data-today-glow]')
      const tiles = q('[data-live-tile="app"]')
      const today = one<HTMLElement>('[data-live-tile="today"] [data-live-tile-face]')
      const underline = one<SVGSVGElement>('[data-hero-underline]')
      const drawn = 'inset(-50% -5% -50% -5%)' // the stroke uncovered, round caps included (globals.css)
      const tilt = one<HTMLElement>('[data-hero-tilt]')
      const trail = one<SVGSVGElement>('[data-bee-trail]')
      const trailDots = one<SVGPathElement>('[data-bee-trail-dots]')
      const trailReveal = one<SVGPathElement>('[data-bee-trail-reveal]')
      const reveals = q('[data-hero-reveal]')
      const takeoffClip = one<HTMLVideoElement>('[data-bee-clip="takeoff"]')
      const demo = one<HTMLVideoElement>('[data-demo-video]')
      const camera = one<HTMLElement>('[data-demo-camera]')
      const captions = one<HTMLElement>('[data-story-captions]')
      const cta = one<HTMLElement>('[data-story-cta]')
      const backdrop = one<HTMLElement>('[data-story-backdrop]')
      const cue = one<HTMLElement>('[data-scroll-cue]')
      const compactCaption = one<HTMLElement>('[data-compact-captions]')
      const slab = one<HTMLElement>('[data-tablet="sharp"] .tablet')
      const storyFade = [...q('[data-story-fade]'), ...q('[data-tablet="sharp"] .tablet-shadow')]

      // after the opening, on a desktop pointer, the tablet (and the bee on it) leans toward the cursor.
      // Not a contextSafe function: it is also called while the matchMedia handler runs, and a
      // context's function run inside another context links the two both ways (GSAP then recurses
      // forever when either is reverted). Its tweens are killed in the cleanup instead.
      let untilt = () => {}
      const enableTilt = () => {
        untilt()
        const fine = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px) and (prefers-reduced-motion: no-preference)')
        if (!tilt || !fine.matches) return
        gsap.set(tilt, { transformPerspective: 1600 })
        const toY = gsap.quickTo(tilt, 'rotationY', { duration: 0.9, ease: 'power3.out' })
        const toX = gsap.quickTo(tilt, 'rotationX', { duration: 0.9, ease: 'power3.out' })
        const move = (e: PointerEvent) => {
          const r = hero.getBoundingClientRect()
          toY(((e.clientX - r.left) / r.width - 0.5) * 6)
          toX(-((e.clientY - r.top) / r.height - 0.5) * 4)
        }
        const leave = () => (toY(0), toX(0))
        hero.addEventListener('pointermove', move)
        hero.addEventListener('pointerleave', leave)
        untilt = () => {
          hero.removeEventListener('pointermove', move)
          hero.removeEventListener('pointerleave', leave)
          gsap.killTweensOf(tilt)
          untilt = () => {}
        }
      }

      // once the hero is at rest, the notifications take turns over the tablet's corner (toasts.tsx),
      // each one's app hexagon on the dashboard lifting while it shows; with reduced motion the
      // first simply stays
      const toasts = q('[data-hero-toast]')
      const toastsWrap = one<HTMLElement>('[data-hero-toasts]')
      let toastTl: gsap.core.Timeline | undefined
      /** The notifications step aside at once while the story runs (paused), and carry on back at the top. */
      let toastsOut = false
      const toastsAside = (out: boolean) => {
        if (out === toastsOut || !toastsWrap) return
        toastsOut = out
        gsap.to(toastsWrap, { autoAlpha: out ? 0 : 1, duration: out ? 0.2 : 0.5, ease: 'sine.out', overwrite: true })
        if (out) toastTl?.pause()
        else toastTl?.resume()
      }
      const startToasts = () => {
        // desktop only: the cards are hidden below lg, and their hexagon lifts would play to no one
        if (toastTl || !toasts.length || !matchMedia('(min-width: 1024px)').matches) return
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return void gsap.set(toasts[0], { autoAlpha: 1 })
        toastTl = gsap.timeline({ repeat: -1 })
        toasts.forEach((el) => {
          const tile = tiles[Number((el as HTMLElement).dataset.tile)]
          const face = tile?.querySelector('[data-live-tile-face]')
          const under = tile?.querySelector('[data-live-tile-shadow]')
          // lengths doubled: the tablet is laid out at twice its size (scene.ts, raster)
          const dim = 'drop-shadow(0 0 0cqw rgb(240 154 67 / 0))'
          const lit = 'drop-shadow(0 0 1.8cqw rgb(252 196 128 / 0.6))'
          const at = toastTl!.duration()
          toastTl!
            .fromTo(el, { autoAlpha: 0, y: 14, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' }, at)
            .to(el, { autoAlpha: 0, y: -8, duration: 0.45, ease: 'power2.in' }, at + 4.2)
            .to({}, { duration: 1.6 })
          // the app it came from answers on the dashboard: up as the card arrives, down as it goes
          // (higher than the opening's gentle lifts, and lit amber from behind, so it reads at a glance)
          if (tile && face && under) {
            toastTl!
              .to(face, { scale: 1.14, yPercent: -7, duration: 0.55, ease: 'back.out(2)' }, at + 0.15)
              .to(under, { opacity: 1, scale: 1.18, duration: 0.55, ease: 'power2.out' }, at + 0.15)
              .fromTo(tile, { filter: dim }, { filter: lit, duration: 0.6, ease: 'sine.out' }, at + 0.15)
              .to(face, { scale: 1, yPercent: 0, duration: ALIVE.fall, ease: 'power2.inOut' }, at + 4.1)
              .to(under, { opacity: 0, scale: 1, duration: ALIVE.fall, ease: 'power2.inOut' }, at + 4.1)
              .to(tile, { filter: dim, duration: ALIVE.fall, ease: 'sine.inOut' }, at + 4.1)
          }
        })
      }

      const finish = () => {
        if (!played.current) enableTilt()
        played.current = true
        html.dataset.heroMotion = 'done'
        startToasts()
        loadTakeoff()
      }
      // no flight: show the copy and the landed bee, and stop
      const settle = () => {
        gsap.to([landed, ...reveals], { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', onComplete: finish })
        gsap.to(shadow ?? [], { opacity: SHADOW_OPACITY, duration: 0.5 })
        gsap.to(sharp ?? [], { opacity: 1, duration: 0.5, ease: 'sine.out' })
        gsap.to(underline ?? [], { clipPath: drawn, duration: 0.5 })
      }
      if (!scene || !air || !landed || !target || !shadow || !airClip || !landClip || !rest || !sharp || !glow || !today || !underline || !trail || !trailDots || !trailReveal) return finish()

      // ── the scroll story's bee ───────────────────────────────────────────────────────────────
      // The story says where the bee belongs (story.ts, onBee): on the hero's tablet at the top, away
      // while the tablet moves and the first chapters play, and on the big tablet's corner for the
      // last chapter, as the narrator. This moves it there from wherever it is, one trip at a time.
      //
      // It flies the way it faces: it leaves toward the side it faces (up and away) and comes back
      // from there facing the other way, so it lands facing back; the clips (all facing right) are
      // mirrored for a bee facing left. A perch is a point on the page for its feet: the landing
      // target is moved there, so the landed bee, its shadow and every trip measure from it.
      type Spot = 'hero' | 'away' | 'story'
      let opening: gsap.core.Timeline | undefined
      let at: Spot | 'opening' = 'opening' // where it is, or is landing
      let moving = false
      let want: Spot = 'hero'
      let hurry = 1
      let beeTl: gsap.core.Timeline | undefined
      let facing: 1 | -1 = 1
      let storyOff = () => {}
      const face = (dir: 1 | -1) => {
        facing = dir
        gsap.set([airClip!, landClip!, takeoffClip!, rest!], { scaleX: dir })
      }
      /** Puts the landing target (and with it the landed bee) on a perch: the hero's own spot, or the big tablet's corner. */
      const perch = (spot: 'hero' | 'story', glide = 0) => {
        let to = { x: 0, y: 0 }
        if (spot === 'story') {
          const now = { x: Number(gsap.getProperty(target!, 'x')), y: Number(gsap.getProperty(target!, 'y')) }
          const here = target!.getBoundingClientRect()
          const corner = storyPerch(slab!)
          to = { x: now.x + corner.x - here.left, y: now.y + corner.y - here.top }
        }
        if (glide) gsap.to(target!, { ...to, duration: glide, ease: 'power2.out', overwrite: true })
        else gsap.set(target!, to)
      }
      /** The arc between the perch and off-screen on the side the bee faces, from the feet out. */
      const route = (box: FlightBox, dir: 1 | -1) => {
        const { width: w, height: h, feet } = box
        const side = (dx: number) => feet.x + dir * dx
        return [
          { x: side(w * 0.03), y: feet.y - h * 0.06 },
          { x: side(w * 0.2), y: feet.y - h * 0.32 },
          { x: dir > 0 ? w * 1.15 : -w * 0.15, y: -h * 0.25 },
        ]
      }
      const box = () => measure(hero!, scene!, air!, target!)
      /** Stops any trip and stands the bee on the hero's tablet, facing as it first landed. */
      const homeBee = () => {
        beeTl?.kill()
        ;[airClip!, landClip!, takeoffClip].forEach((v) => v?.pause())
        moving = false
        at = want = 'hero'
        face(1)
        perch('hero')
        gsap.set([air!, airClip!, landClip!, takeoffClip ?? []], { opacity: 0 })
        gsap.set([landed!, rest!], { opacity: 1, scale: 1 })
        gsap.set(shadow!, { opacity: SHADOW_OPACITY, scale: 1 })
      }

      /**
       * The take-off clip, for when the story sends the bee away: loaded once the opening is done,
       * so it never competes with the opening's own clips (finish, storyOn). Desktop only.
       */
      function loadTakeoff() {
        if (!takeoffClip || takeoffClip.src || !matchMedia('(min-width: 1024px)').matches) return
        takeoffClip.src = clipSrc('takeoff')
        takeoffClip.preload = 'auto'
      }

      function storyOn() {
        if (!takeoffClip || !demo || !camera || !captions || !cta || !backdrop || !slab) return
        if (played.current) loadTakeoff()
        const smoothOff = matchMedia('(pointer: fine)').matches ? smoothScroll() : () => {}
        const storyStop = scrollStory({
          hero: hero!,
          scene: scene!,
          tablet: slab,
          fade: storyFade,
          video: demo,
          camera,
          captions,
          backdrop,
          cta,
          tour: cue,
          // standing on the big tablet as it steps back: it moves with it
          onTabletMove: () => {
            if (at === 'story' && !moving) perch('story')
          },
          onBee: (spot, scroll) => {
            toastsAside(scroll.progress > 0.002)
            // leaving while the visitor scrolls on fast, or once the tablet is well on its way: hurry
            // (the story always moves the tablet briskly now, so it never leaves slowly)
            hurry = Math.min(3, Math.max(1.8, Math.abs(scroll.velocity) / 900, scroll.progress > scroll.settledAt * 0.4 ? 2.5 : 1))
            if (moving && at === 'away') beeTl?.timeScale(hurry), (takeoffClip!.playbackRate = hurry)
            if (spot !== want) {
              want = spot
              next()
            }
          },
        })
        storyOff = () => (storyStop(), smoothOff())
      }

      /**
       * Starts the next trip toward where the bee belongs, if it is not there or on its way. A plain
       * function, like enableTilt: the story's triggers can call it while their matchMedia context is
       * being reverted. The trip's timeline is killed in the cleanup.
       */
      function next() {
        if (at === 'opening') {
          if (want === 'hero') return
          // the visitor scrolled before it landed: finish the opening now (its end calls next() again)
          opening?.progress(1)
          if (at !== 'opening') return
          at = 'hero'
        }
        if (moving) {
          if (at === want) return // already on its way there
          // heading somewhere it is no longer wanted: turn round
          if (at === 'away') return comeBack(want as 'hero' | 'story')
          return turnBack()
        }
        if (at === want) return
        if (want === 'away' || at !== 'away') return takeOff()
        comeBack(want)
      }
      const arrived = (spot: Spot) => () => {
        moving = false
        at = spot
        if (spot === 'hero') enableTilt()
        // the tablet may have moved while it was landing: settle onto the corner where it is now
        if (spot === 'story') perch('story', 0.35)
        next()
      }

      /** The bee lifts off its perch (the landing clip run backwards) and flies away the way it faces. */
      function takeOff() {
        moving = true
        at = 'away'
        if (tilt) {
          untilt()
          gsap.to(tilt, { rotationX: 0, rotationY: 0, duration: 0.4, ease: 'power2.out' })
        }
        const b = box()
        // the clip opens with the bee still standing as its wings start (the landing, backwards);
        // the tablet is already moving by then, so it starts as the wings are up and leaves at once
        const skip = 0.3
        const away = (takeoffClip!.duration || 76 / 24) - skip
        beeTl?.kill()
        beeTl = gsap.timeline({ onComplete: () => (takeoffClip!.pause(), arrived('away')()) })
        beeTl
          .set(air!, { xPercent: -50, yPercent: -FRAME.feetY * 100, transformOrigin: '50% 50%', x: b.feet.x, y: b.feet.y, scale: 1, opacity: 1 }, 0)
          .set(airClip!, { opacity: 0 }, 0)
          .set(takeoffClip!, { opacity: 1 }, 0)
          .call(() => {
            takeoffClip!.currentTime = skip
            takeoffClip!.playbackRate = hurry
            void takeoffClip!.play().catch(() => {})
          }, [], 0)
          .set(landed!, { opacity: 0 }, 0.05)
          .to(shadow!, { opacity: 0, scale: 0.6, duration: 0.25, ease: 'sine.out' }, 0)
          // up off the edge and away the way it faces, a little smaller as it goes
          .to(air!, { motionPath: { path: route(b, facing), curviness: 1.2 }, duration: away, ease: 'sine.in' }, 0.05)
          .to(air!, { scale: 0.82, duration: away, ease: 'power1.in' }, 0.05)
          .set(air!, { opacity: 0 }, away + 0.05)
        beeTl.timeScale(hurry)
      }

      /** On its way in but no longer wanted there: it turns round and flies back out the way it came. */
      function turnBack() {
        beeTl?.kill()
        landClip!.pause()
        face((-facing) as 1 | -1)
        const out = route(box(), facing).slice(1)
        moving = true
        at = 'away'
        beeTl = gsap.timeline({ onComplete: () => (airClip!.pause(), arrived('away')()) })
        beeTl
          .set(landed!, { opacity: 0 }, 0)
          .set([airClip!, air!], { opacity: 1 }, 0)
          .to(shadow!, { opacity: 0, duration: 0.3 }, 0)
          .to(air!, { motionPath: { path: out, curviness: 1.2 }, duration: 1.6, ease: 'power2.in' }, 0)
          .to(air!, { scale: 0.6, duration: 1.6, ease: 'power1.in' }, 0)
          .set(air!, { opacity: 0 }, 1.6)
      }

      /** The bee comes back from where it flew off, facing the perch, glides in along the same arc and lands. */
      function comeBack(to: 'hero' | 'story') {
        beeTl?.kill()
        takeoffClip!.pause()
        perch(to)
        const b = box()
        const from = facing
        face((-from) as 1 | -1) // it turns round to come back
        // the arc back, from off-screen to where the landing clip's bee begins (flight.ts)
        const handoff = buildFlight(b).at(-1)!.point
        const path = route(b, from).reverse().slice(1).concat([{ x: handoff.x, y: handoff.y }])
        const start = route(b, from).at(-1)!
        const glide = Math.max(2.2, Math.min(ARRIVE, airClip!.duration || ARRIVE))
        moving = true
        at = to
        beeTl = gsap.timeline()
        beeTl
          .set(takeoffClip!, { opacity: 0 }, 0)
          .set(airClip!, { opacity: 1 }, 0)
          .set(air!, { xPercent: -50, yPercent: -FRAME.feetY * 100, transformOrigin: '50% 50%', x: start.x, y: start.y, scale: 0.6, opacity: 1 }, 0)
          .call(() => {
            airClip!.currentTime = Math.max(0, (airClip!.duration || ARRIVE) - glide)
            airClip!.playbackRate = 1
            void airClip!.play().catch(() => {})
          }, [], 0)
          .to(air!, { motionPath: { path, curviness: 1.2 }, duration: glide, ease: 'power1.out' }, 0)
          .to(air!, { scale: 1, duration: glide, ease: 'power1.out' }, 0)
          .fromTo(shadow!, { opacity: 0, scale: 0.5 }, { opacity: SHADOW_OPACITY * 0.5, scale: 0.8, duration: 0.8, ease: 'sine.in' }, glide - 0.8)
          .to(air!, { opacity: 0, duration: HANDOFF, ease: 'none' }, glide)
          .call(() => airClip!.pause(), [], glide + HANDOFF)
        // on the big tablet the dashboard's lifts would be hidden under the recording: just the landing
        landing(beeTl, glide, to === 'hero')
        // down and settled (the dashboard's lifts that follow do not hold it)
        beeTl.call(arrived(to), [], glide + LAND.duration)
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
          const { reduce, mobile, tablet, desktop } = ctx.conditions as Record<string, boolean>
          const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
          if (reduce || saveData) return played.current ? finish() : settle()

          const story = () => {
            if (desktop) storyOn()
            else if (demo && compactCaption && slab) storyOff = compactStory({ scene: scene!, tablet: slab, video: demo, caption: compactCaption, bee: [landed!, shadow!] })
          }
          // back on a breakpoint after the opening has played: the bee starts again on the hero's
          // tablet, wherever it was when the last breakpoint's story was torn down
          if (played.current) {
            homeBee()
            story()
            finish()
            return () => storyOff()
          }

          let alive = true
          const clips = mobile ? [landClip] : [airClip, landClip]
          story()
          clips.forEach((v) => (v.src = clipSrc(v.dataset.beeClip!)))
          // a named add() is not run now: it returns the function, bound to this media context
          const start = ctx.add('start', () => {
            if (!alive) return
            const tl = gsap.timeline({ onComplete: () => (at === 'opening' && ((at = 'hero'), next()), finish()) })
            opening = tl
            if (tablet) tl.timeScale(1.2)
            if (mobile) {
              landing(tl, 0.6)
              focus(tl, [0.8, 2])
            } else {
              flight(tl, measure(hero, scene, air, target))
              focus(tl, SCENE_TIMING.focus)
            }
            // the headline's stroke draws on from left to right as the bee crosses above it
            tl.to(underline!, { clipPath: drawn, duration: mobile ? 1 : 1.5, ease: 'sine.inOut' }, mobile ? 0.4 : 0.5)
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
            storyOff()
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
      function landing(tl: gsap.core.Timeline, at: number, lifts = true) {
        const touch = at + LAND.touchdown
        const end = at + LAND.duration
        tl.set(rest!, { opacity: 0 }, 0)
          // held at one size while the clip's bee grows as it comes in (flight.ts, LAND_GROWTH)
          .set(landed!, { transformOrigin: `50% ${FRAME.feetY * 100}%`, scale: 1 / LAND_GROWTH.from }, 0)
          .to(landed!, { scale: 1, duration: LAND_GROWTH.end - LAND_GROWTH.start, ease: 'none' }, at + LAND_GROWTH.start)
          .set(landClip!, { opacity: 1 }, at)
          .call(play(landClip!, RATE, tl), [], at)
          .to(landed!, { opacity: 1, duration: HANDOFF, ease: 'none' }, at)
          // not rendered early: built at the start of a trip home, its start would show the shadow on the perch while the bee is still far away
          .fromTo(shadow!, { opacity: SHADOW_OPACITY * 0.5, scale: 0.8 }, { opacity: SHADOW_OPACITY, scale: 1, duration: 0.35, ease: 'sine.out', immediateRender: false }, touch - 0.15)
          // the still is the clip's last frame, so the swap is invisible; it frees the decoder
          .set(rest!, { opacity: 1 }, end)
          .set(landClip!, { opacity: 0 }, end)
        if (lifts) {
          alive(tl, touch + ALIVE.delay)
          // and the first notification arrives a second after the feet touch (startToasts, above)
          tl.call(startToasts, [], touch + 1)
        }
      }

      /**
       * The dashboard comes alive once the bee is down: app hexagons lift gently toward the viewer
       * and settle, now and then in a scattered order (flight.ts, liftOrder), each over a softening
       * shadow, while today's cell in the heat map lifts a little in a light glow. Transforms and
       * opacity only; then it rests.
       */
      function alive(tl: gsap.core.Timeline, at: number) {
        const A = ALIVE
        liftOrder(tiles.length, A.lifts).forEach((i, k) => {
          const face = tiles[i].querySelector('[data-live-tile-face]')
          const under = tiles[i].querySelector('[data-live-tile-shadow]')
          const t = at + k * A.gap + Math.random() * A.jitter
          const down = t + A.rise + A.hold
          tl.to(face, { scale: A.scale, yPercent: A.lift, duration: A.rise, ease: 'power2.out', overwrite: 'auto' }, t)
            .to(under, { opacity: 1, scale: 1.1, duration: A.rise, ease: 'power2.out', overwrite: 'auto' }, t)
            .to(face, { scale: 1, yPercent: 0, duration: A.fall, ease: 'power2.inOut' }, down)
            .to(under, { opacity: 0, scale: 1, duration: A.fall, ease: 'power2.inOut' }, down)
        })
        const beat = { duration: A.today.beat, ease: 'sine.inOut', yoyo: true, repeat: A.today.pulses * 2 - 1 }
        tl.fromTo(today!, { scale: 1, yPercent: 0 }, { scale: A.today.scale, yPercent: A.today.lift, ...beat }, at)
          .fromTo(glow!, { opacity: 0 }, { opacity: 1, ...beat }, at)
      }

      /** The tablet comes into focus: its sharp copy fades in over the blurred one (tablet.tsx). */
      function focus(tl: gsap.core.Timeline, [from, to]: readonly [number, number]) {
        tl.to(sharp!, { opacity: 1, duration: to - from, ease: 'sine.inOut' }, from)
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

        // the dotted tail follows the bee's body (a little above and behind its feet): one solid dash
        // in the trail's mask, a sixth of the route long, slides along just behind the bee, so the
        // dots appear behind it and disappear again as it moves on
        const frameH = box.frame / FRAME.aspect
        const behind = { x: -box.frame * 0.14, y: -(FRAME.feetY - 0.5) * frameH * 0.7 }
        const trailRaw = MotionPathPlugin.arrayToRawPath(marks.map((m) => ({ x: m.point.x + behind.x, y: m.point.y + behind.y })), { curviness: 1 })
        const trailPath = MotionPathPlugin.rawPathToString(trailRaw)
        // set directly, not through GSAP: a breakpoint change reverts GSAP's sets, and an empty viewBox is an error
        trail!.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`)
        gsap.set([trailDots!, trailReveal!], { attr: { d: trailPath } })
        const trailLength = trailReveal!.getTotalLength()
        const tail = trailLength / 6
        gsap.set(trailReveal!, { strokeDasharray: `${tail} ${trailLength * 2}`, strokeDashoffset: tail })
        const setTrail = gsap.quickSetter(trailReveal!, 'strokeDashoffset')

        const clock = { t: 0 }
        const draw = () => {
          const t = clock.t
          setTrail(tail - trailLength * progress(t))
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
          .fromTo(shadow!, { opacity: 0, scale: 0.5 }, { opacity: SHADOW_OPACITY * 0.5, scale: 0.8, duration: ARRIVE - DESCENT, ease: 'sine.in' }, DESCENT)
          // hand over: the landing clip continues the same footage where the flying bee is
          .to(air!, { opacity: 0, duration: HANDOFF, ease: 'none' }, ARRIVE)
          .call(() => airClip!.pause(), [], ARRIVE + HANDOFF)
          // what is left of the tail fades as the bee settles
          .fromTo(trail!, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'sine.in' }, ARRIVE - 0.3)
        landing(tl, ARRIVE)
      }

      return () => {
        untilt()
        beeTl?.kill()
        toastTl?.kill()
        mm.revert()
      }
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

/** The scene's size, the landed feet in it, the bee's frame width and the screen's left edge, measured untransformed. */
function measure(hero: HTMLElement, scene: HTMLElement, air: HTMLElement, target: HTMLElement): FlightBox {
  const s = scene.getBoundingClientRect()
  const t = target.getBoundingClientRect()
  return { width: s.width, height: s.height, feet: { x: t.left - s.left, y: t.top - s.top }, frame: air.offsetWidth, enter: hero.getBoundingClientRect().left - s.left }
}
