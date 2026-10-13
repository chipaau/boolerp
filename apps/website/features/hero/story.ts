import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { CAMERA, CHAPTERS, loadDemo } from './demo'
import { TABLET } from './scene'

gsap.registerPlugin(ScrollTrigger)

/**
 * How far the page scrolls while the hero is pinned, in viewport heights: the tablet's move, the
 * hold while the recording plays, and the close. The page glides between the resting points itself
 * (scrollStory), so the hold is short: only the slack before a scroll carries it on.
 */
export const STORY = { move: 1.1, hold: 0.16, close: 0.7 } as const

/** The tablet at the end of its move: centred, flat, as large as fits above the captions (viewport shares). */
const SETTLED = { width: 0.94, height: 0.85, top: 0.025 } as const

export type StoryParts = {
  hero: HTMLElement
  scene: HTMLElement
  tablet: HTMLElement // the sharp tablet's slab (.tablet)
  fade: Element[] // what steps back as the tablet comes forward: the copy, the glow, the ground shadow
  video: HTMLVideoElement
  camera: HTMLElement // the wrapper the recording zooms in
  captions: HTMLElement
  cta: HTMLElement // the call to action that comes in at the close
  tour?: HTMLElement | null // clicked, glides into the story's first chapter (the hero's scroll cue)
  /**
   * Where the bee belongs at this point of the story, told on every update: on the hero's tablet at
   * the top, away while the tablet moves and the first chapters play, and on the tablet's corner,
   * as the narrator, for the last chapter. `progress` and `velocity` (px/s) let it hurry.
   */
  onBee: (spot: BeeSpot, scroll: { progress: number; velocity: number; settledAt: number }) => void
  /** The tablet moved (while the bee may be standing on it). */
  onTabletMove: () => void
}

export type BeeSpot = 'hero' | 'away' | 'story'

/** Where the narrating bee stands on the tablet once it is at the centre: near its bottom-left corner, on the glass edge (viewport px). */
export function storyPerch(tablet: HTMLElement) {
  const r = tablet.getBoundingClientRect()
  return { x: r.left + r.width * 0.09, y: r.bottom - r.height * 0.008 }
}

/**
 * The scroll story (desktop only): the hero is pinned while the visitor scrolls; the tablet
 * unwinds from its lay-back to flat, moves to the centre and grows until the interface nearly fills
 * the screen (scrubbed, so it follows the scroll exactly, both ways), its shadow deepening as it
 * lifts off the page; then the recording fades in on its screen and plays on its own, start to end and
 * round again, the captions following its chapters. Scrolling on while it plays is a short hold; the
 * story does not wait for the recording. Transforms and opacity only.
 *
 * While the recording plays, the screen's camera eases in on what each moment is about (the shots
 * the recording script marked). When the visitor stops scrolling, the story settles on the nearest
 * resting point.
 *
 * Once the recording reaches its last chapter the bee comes to the tablet's corner to narrate, and
 * stays. At the end the tablet steps back into the hero, still playing, and settles lower, so the
 * pin lets go onto the next section cleanly.
 *
 * Scrolling back plays it all in reverse: the recording fades back to the dashboard, the tablet lays
 * back into place and the copy returns; once the visitor is back at the top, the bee flies in again.
 *
 * Returns a cleanup.
 */
export function scrollStory(p: StoryParts) {
  const { hero, scene, tablet, fade, video, camera, captions, cta } = p
  const html = document.documentElement
  const items = gsap.utils.toArray<HTMLElement>(captions.querySelectorAll('[data-story-caption]'))
  const dots = gsap.utils.toArray<HTMLElement>(captions.querySelectorAll('[data-story-dot]'))

  // the tablet's resting geometry, measured once with nothing moved
  let geo = measure()
  function measure() {
    const stage = scene.getBoundingClientRect()
    const cqw = stage.width / 100
    const left = (parseFloat(TABLET.left) / 100) * stage.width
    const top = (parseFloat(TABLET.top) / 100) * stage.height
    const width = parseFloat(TABLET.width) * cqw // on screen, flat
    return { stage, cqw, left, top, width }
  }

  /**
   * The tablet's transform at `e` (0 at rest, 1 settled): the lay-back unwinds as it moves and grows;
   * then `c` (0 to 1) steps it back to the close, sized to sit inside the hero, so that when the
   * pin lets go it scrolls away with the hero instead of over the next section.
   */
  const transformAt = (e: number, c: number) => {
    const { stage, cqw, left, top, width } = geo
    const vw = innerWidth
    const vh = innerHeight
    const heroH = hero.offsetHeight
    // a flat, centred rectangle of the given height share and top (px), as large as fits the width share
    const box = (wShare: number, h: number, y: number) => {
      const w = Math.min(wShare * vw, h * TABLET.aspect)
      return { w, x: (vw - w) / 2, y: y + (h - w / TABLET.aspect) / 2 }
    }
    const settled = box(SETTLED.width, SETTLED.height * vh, SETTLED.top * vh)
    const closed = box(0.74, heroH * 0.72, heroH * 0.14)
    const end = { w: settled.w + (closed.w - settled.w) * c, x: settled.x + (closed.x - settled.x) * c, y: settled.y + (closed.y - settled.y) * c }
    // where its top-left corner ends up, in the stage's coordinates (the stage does not move while pinned)
    const toX = end.x - stage.left - left
    const toY = end.y - stage.top - top
    const t = TABLET.tilt
    const m = t.matrix.map((v, i) => v + ((i === 0 || i === 3 ? 1 : 0) - v) * e)
    const grow = 1 + (end.w / width - 1) * e
    return (
      `translate(${toX * e}px, ${toY * e}px) ` +
      `matrix(${m[0]}, ${m[1]}, ${m[2]}, ${m[3]}, 0, 0) perspective(${t.perspective * cqw}px) ` +
      `rotate3d(${t.axis.join(', ')}, ${t.angle * (1 - e)}deg) scale(${grow / TABLET.raster})`
    )
  }

  const move = { e: 0, c: 0 }
  const place = () => {
    tablet.style.transform = transformAt(move.e, move.c)
    // the reflection slides across as it turns to face the viewer, and back a little as it steps back
    tablet.style.setProperty('--glare', String(move.e * (1 - 0.35 * move.c)))
    // and it lifts off the page as it comes forward: its shadow deepens (globals.css, .tablet)
    tablet.style.setProperty('--lift', String(move.e * (1 - 0.6 * move.c)))
    p.onTabletMove()
  }

  // the camera inside the screen: eases toward the shot the recording is at (CAMERA, from the
  // script), kept so the zoomed view never shows past the recording's edges
  const cam = { x: 0.5, y: 0.5, s: 1 }
  let camFrame = 0
  let camLast = 0
  const shotAt = (t: number) => CAMERA.reduce((shot, c) => (c.t <= t ? c : shot), CAMERA[0])
  const spot = camera.querySelector<HTMLElement>('[data-demo-spot]')
  let lastShot: (typeof CAMERA)[number] | undefined
  /** The spotlight follows the shot: placed while hidden, then faded in once the camera has moved. */
  const light = (shot: (typeof CAMERA)[number]) => {
    if (!spot || shot === lastShot) return
    lastShot = shot
    if (!shot.box) return void gsap.to(spot, { opacity: 0, duration: 0.35, ease: 'sine.out', overwrite: true })
    const [x, y, w, h] = shot.box
    // a little room round the part in focus, so the outline never runs over its content; kept on the screen
    const left = Math.max(0.004, x - 0.016)
    const top = Math.max(0.004, y - 0.022)
    const right = Math.min(0.996, x + w + 0.016)
    const bottom = Math.min(0.996, y + h + 0.022)
    gsap.set(spot, { opacity: 0, left: `${left * 100}%`, top: `${top * 100}%`, width: `${(right - left) * 100}%`, height: `${(bottom - top) * 100}%` })
    gsap.to(spot, { opacity: 1, duration: 0.6, delay: 0.45, ease: 'sine.inOut', overwrite: true })
  }
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - (camLast || now)) / 1000)
    camLast = now
    const want = shotAt(video.currentTime)
    light(want)
    // the current chapter's marker fills as the chapter plays
    const c = CHAPTERS[chapter]
    const fill = dots[chapter]?.firstElementChild as HTMLElement | null | undefined
    if (c && fill) fill.style.transform = `scaleX(${Math.min(1, Math.max(0, (video.currentTime - c.start) / (c.end - c.start)))})`
    const k = 1 - Math.exp(-dt / 0.55) // about half a second to settle on a new shot
    cam.x += (want.x - cam.x) * k
    cam.y += (want.y - cam.y) * k
    cam.s += (want.scale - cam.s) * k
    const half = 1 / (2 * cam.s)
    const cx = Math.min(1 - half, Math.max(half, cam.x))
    const cy = Math.min(1 - half, Math.max(half, cam.y))
    camera.style.transform = `translate(${(0.5 - cam.s * cx) * 100}%, ${(0.5 - cam.s * cy) * 100}%) scale(${cam.s})`
    camFrame = requestAnimationFrame(frame)
  }
  let camReset: gsap.core.Tween | undefined
  const filming = (on: boolean) => {
    cancelAnimationFrame(camFrame)
    camLast = 0
    camReset?.kill()
    if (on) camFrame = requestAnimationFrame(frame)
    else {
      if (spot) gsap.to(spot, { opacity: 0, duration: 0.15, overwrite: true })
      // the whole screen again, ready for next time, once the recording has faded out: resetting it
      // while it still shows would jump the shot
      camReset = gsap.delayedCall(0.35, () => {
        Object.assign(cam, { x: 0.5, y: 0.5, s: 1 })
        camera.style.transform = ''
        lastShot = undefined
      })
    }
  }

  // the recording: loaded once the story starts, then played on its own while the tablet is
  // settled; the captions follow its chapters
  let chapter = -1
  let live = false
  let narrated = false // the bee has come to narrate (from the last chapter until the tablet moves back)
  let last = { progress: 0, velocity: 0 }
  const chapterAt = (t: number) => CHAPTERS.reduce((at, c, k) => (t >= c.start ? k : at), 0)
  const show = (i: number) => {
    if (i === chapter) return
    chapter = i
    items.forEach((el, k) => gsap.to(el, { autoAlpha: k === i ? 1 : 0, y: k === i ? 0 : k < i ? -8 : 8, duration: 0.45, ease: 'power2.out', overwrite: true }))
    // the chapter markers are hairlines: the current one widens and fills with amber as it plays
    // (frame, above), the ones before stay softly lit, the ones to come are empty
    dots.forEach((el, k) => {
      const fill = el.firstElementChild as HTMLElement
      if (k !== i) gsap.set(fill, { scaleX: k < i ? 1 : 0 })
      gsap.to(fill, { opacity: k < i ? 0.4 : 1, duration: 0.45, ease: 'power2.out', overwrite: true })
      gsap.to(el, { width: k === i ? 36 : 16, duration: 0.5, ease: 'power3.out', overwrite: true })
    })
    if (i === CHAPTERS.length - 1) narrated = true
    tellBee()
  }
  const tellBee = () => {
    const spot: BeeSpot = last.progress <= 0.002 ? 'hero' : live && narrated ? 'story' : 'away'
    p.onBee(spot, { ...last, settledAt })
  }
  const follow = () => {
    if (live) show(chapterAt(video.currentTime))
  }
  video.addEventListener('timeupdate', follow)
  // the screen at its largest (the tablet settled), in device pixels, with room for the camera's zoom
  const wake = () => loadDemo(video, Math.min(innerWidth * SETTLED.width, innerHeight * SETTLED.height * TABLET.aspect) * devicePixelRatio * 1.2)
  /** Starts the recording (where it was, if it was stopped part way), or stops it. */
  const play = (on: boolean) => {
    if (!on) return video.pause()
    video.muted = true // autoplay needs it as a property, whatever the markup says
    video.loop = true
    void video.play().catch(() => {
      // not ready yet: start as soon as it is
      video.addEventListener('canplay', () => live && void video.play().catch(() => {}), { once: true })
    })
  }

  const total = STORY.move + STORY.hold + STORY.close
  const settledAt = STORY.move / total
  const closeAt = 1 - STORY.close / total
  // between the tablet settling and the close starting: both glides from here move something at once
  const holdAt = (settledAt + closeAt) / 2
  let stop = 0
  let gliding = false
  const stops = (st: ScrollTrigger) => [st.start, st.start + (st.end - st.start) * holdAt, st.end]
  /** Carries the page to a resting point (to and from the recording takes longest: the tablet's whole move). */
  const goTo = (i: number, st: ScrollTrigger) => {
    const from = stop
    stop = i
    gliding = true
    glideTo(stops(st)[i], Math.max(from, i) === 1 ? 2.1 : 1.7, () => (gliding = false))
  }

  const tl = gsap.timeline({ defaults: { ease: 'none' } })
  // linear: the page's glide between resting points does the easing (glideTo)
  tl.to(move, { e: 1, duration: settledAt, ease: 'none', onUpdate: place }, 0)
    .to(fade, { autoAlpha: 0, y: -24, duration: settledAt * 0.5, ease: 'power1.in' }, 0)
    .fromTo(captions, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.05 }, settledAt * 0.92)
    // the close: the tablet steps back into the hero and the captions go, the recording still playing
    .to(move, { c: 1, duration: 1 - closeAt, ease: 'none', onUpdate: place }, closeAt)
    .to(captions, { autoAlpha: 0, y: 12, duration: (1 - closeAt) * 0.5, ease: 'power1.in' }, closeAt)
    // and the next step comes in under it
    .fromTo(cta, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: (1 - closeAt) * 0.5, ease: 'power2.out' }, closeAt + (1 - closeAt) * 0.45)

  const trigger = ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: () => `+=${innerHeight * total}`,
    pin: true,
    // the page itself glides between resting points (eased), so the story follows it directly: no
    // catch-up lag to drift after the page has stopped or overshoot when the visitor turns back
    scrub: true,
    animation: tl,
    invalidateOnRefresh: true,
    onRefresh: (self) => {
      geo = measure()
      place()
      // the resting point the page is nearest to (after a reload part way down, say)
      const y = self.scroll()
      const ys = stops(self)
      stop = ys.reduce((best, at, i) => (Math.abs(at - y) < Math.abs(ys[best] - y) ? i : best), 0)
    },
    onUpdate: (self) => {
      // the story has three resting points: the hero, the tablet settled with the recording playing,
      // and the end. A scroll away from one carries the page on to the next in that direction, so
      // the visitor never has to find the right spot, and nothing is left half turned
      if (!gliding) {
        const y = self.scroll()
        const here = stops(self)[stop]
        if (self.direction > 0 && y > here + STEP_SLACK && stop < 2) goTo(stop + 1, self)
        else if (self.direction < 0 && y < here - STEP_SLACK && stop > 0) goTo(stop - 1, self)
      }
      const pr = self.progress
      last = { progress: pr, velocity: self.getVelocity() }
      if (pr > 0.002) wake()
      // the recording fades in on the screen as the tablet settles and plays; out (and paused) if it moves back
      // while the story is under way (pinned), the site's header keeps out of it (site-header.tsx)
      const inStory = pr > 0.002 && pr < 0.998
      if (inStory !== (html.dataset.story === 'on')) {
        if (inStory) html.dataset.story = 'on'
        else delete html.dataset.story
      }
      const settled = pr >= settledAt * 0.97
      if (settled !== live) {
        live = settled
        // in gently; out quickly, before the dashboard beneath (another screen) can show through it
        gsap.to(video, { opacity: settled ? 1 : 0, duration: settled ? 0.5 : 0.2, ease: 'sine.out', overwrite: true })
        play(settled)
        filming(settled)
        if (!settled) narrated = false
        chapter = -1
        show(settled ? chapterAt(video.currentTime) : -1)
      }
      tellBee()
    },
    onLeaveBack: () => p.onBee('hero', { progress: 0, velocity: 0, settledAt }),
  })

  // while the story runs the tablet grows past the hero's edges: let it
  gsap.set([hero, scene.parentElement!], { overflow: 'visible' })

  // the scroll cue, clicked: glide to where the tablet has settled and the recording plays
  const tour = () => goTo(1, trigger)
  p.tour?.addEventListener('click', tour)

  return () => {
    delete html.dataset.story
    p.tour?.removeEventListener('click', tour)
    trigger.kill()
    tl.kill()
    video.removeEventListener('timeupdate', follow)
    video.pause()
    filming(false)
    gsap.set([hero, scene.parentElement!], { clearProps: 'overflow' })
    move.e = 0
    move.c = 0
    place() // back to the lay-back it was rendered with
  }
}

export type CompactParts = {
  scene: HTMLElement
  tablet: HTMLElement
  video: HTMLVideoElement
  caption: HTMLElement // one line under the scene, following the chapter
  bee: Element[] // the landed bee and its shadow: they step aside while the tablet turns
}

/**
 * The scroll story on phones and tablets: nothing is pinned. As the scene scrolls into view the
 * tablet unwinds from its lay-back to flat where it is (scrubbed, both ways); once it faces the
 * viewer the recording plays straight through on its screen, looping, with the current chapter's
 * caption under it. The bee steps aside while the tablet turns and is back when it lays back.
 *
 * Returns a cleanup.
 */
export function compactStory(p: CompactParts) {
  const { scene, tablet, video, caption, bee } = p
  const t = TABLET.tilt
  const turn = { e: 0 }
  const place = () => {
    const e = turn.e
    const cqw = scene.getBoundingClientRect().width / 100
    const m = t.matrix.map((v, i) => v + ((i === 0 || i === 3 ? 1 : 0) - v) * e)
    tablet.style.transform =
      `matrix(${m[0]}, ${m[1]}, ${m[2]}, ${m[3]}, 0, 0) perspective(${t.perspective * cqw}px) ` +
      `rotate3d(${t.axis.join(', ')}, ${t.angle * (1 - e)}deg) scale(${1 / TABLET.raster})`
    tablet.style.setProperty('--glare', String(e))
  }
  let playing = false
  const play = (on: boolean) => {
    if (on === playing) return
    playing = on
    if (on) {
      loadDemo(video, tablet.getBoundingClientRect().width * devicePixelRatio) // no zoom here
      video.loop = true
    }
    gsap.to(video, { opacity: on ? 1 : 0, duration: 0.5, ease: 'sine.out', overwrite: true })
    gsap.to(caption, { autoAlpha: on ? 1 : 0, duration: 0.4, overwrite: true })
    if (on) void video.play().catch(() => {})
    else video.pause()
  }
  // the caption follows the chapter the recording is in
  const words = caption.querySelectorAll<HTMLElement>('[data-compact-caption]')
  const follow = () => {
    const i = CHAPTERS.reduce((k, c, n) => (video.currentTime >= c.start ? n : k), 0)
    words.forEach((w, n) => (w.hidden = n !== i))
  }
  video.addEventListener('timeupdate', follow)

  const trigger = ScrollTrigger.create({
    trigger: scene,
    start: 'top 85%',
    end: 'center 55%',
    scrub: 0.5,
    animation: gsap.to(turn, { e: 1, ease: 'power2.inOut', onUpdate: place }),
    onUpdate: (self) => {
      gsap.to(bee, { opacity: self.progress > 0.05 ? 0 : 1, duration: 0.3, overwrite: 'auto' })
      play(self.progress > 0.96)
    },
  })
  return () => {
    trigger.kill()
    video.removeEventListener('timeupdate', follow)
    video.pause()
    turn.e = 0
    place()
  }
}

/**
 * Smooth scrolling for the story on desktop (Lenis): wheel and trackpad steps are eased into one
 * continuous motion, so the scrubbed tablet and the pinned hero glide rather than jump. It drives
 * ScrollTrigger from GSAP's own clock, so the two never disagree about where the page is.
 * Desktop pointers only; reduced motion never gets here. Returns a cleanup.
 */
let lenis: Lenis | undefined

export function smoothScroll() {
  const smooth = new Lenis({ lerp: 0.11, wheelMultiplier: 0.9 })
  lenis = smooth
  smooth.on('scroll', ScrollTrigger.update)
  const tick = (time: number) => smooth.raf(time * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)
  return () => {
    gsap.ticker.remove(tick)
    smooth.destroy()
    if (lenis === smooth) lenis = undefined
  }
}

/** How far (px) the visitor scrolls away from a resting point of the story before it carries them on. */
const STEP_SLACK = 12

/** When the visitor last turned the wheel or swiped the trackpad (ms, performance.now). */
let lastWheel = 0
if (typeof window !== 'undefined') addEventListener('wheel', () => (lastWheel = performance.now()), { passive: true })

/**
 * Scrolls the page to `y` gently over `duration` seconds, easing softly in and out, then calls `done`.
 * With Lenis the visitor's own scrolling waits until it is there (lock), and then a moment longer:
 * the page holds still until the wheel has been quiet for a beat, so the rest of the swipe that
 * started the glide (a trackpad's momentum runs on for a second or more) cannot carry it on to the
 * next resting point. One gesture, one step. Without Lenis, the browser's smooth scrolling.
 */
function glideTo(y: number, duration: number, done: () => void) {
  if (lenis) {
    const smooth = lenis
    smooth.scrollTo(y, {
      duration,
      lock: true,
      force: true,
      easing: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
      onComplete: () => {
        smooth.stop()
        const arrived = performance.now()
        const settle = () => {
          if (lenis !== smooth) return // the story was taken down meanwhile (a breakpoint change)
          const now = performance.now()
          if (now - arrived < 250 || now - lastWheel < 260) return void gsap.delayedCall(0.08, settle)
          smooth.scrollTo(y, { immediate: true, force: true }) // exactly on the resting point
          smooth.start()
          done()
        }
        settle()
      },
    })
    return
  }
  window.scrollTo({ top: y, behavior: 'smooth' })
  let finished = false
  const end = () => {
    if (finished) return
    finished = true
    done()
  }
  addEventListener('scrollend', end, { once: true })
  setTimeout(end, duration * 1000 + 400) // where scrollend is not supported, or nothing scrolled
}
