/**
 * The bee's flight, as data and pure functions (no DOM, no GSAP) so the route can be tuned or
 * tested on its own; hero-motion.tsx measures the page and plays it.
 *
 * One gentle arc: in from the left above the headline, facing right the whole way, coming closer
 * and slowing onto the tablet's top edge, where the landing clip finishes the touchdown. Its speed
 * only eases off, reaching zero as it lands.
 *
 * Both clips come from one take, mirrored so the bee faces right: its own forward flight (the
 * airborne clip, 3.04 s, lengthened by playing part of it back and forward again; centred, its own
 * travel removed) and then its landing, which continues the same footage. GSAP owns position,
 * scale and timing; the clips own wings, body and orientation.
 */

export type Point = { x: number; y: number }

/** The scene the bee flies over, the landed bee's feet in it (px from its top-left), and the bee's frame width. */
export type FlightBox = { width: number; height: number; feet: Point; frame: number }

/** The bee's frame (every clip and the still): 640×520, the landed body centred, feet 70.6% down. */
export const FRAME = { aspect: 640 / 520, feetY: 0.7058 } as const

/** Footage speed: the airborne clip's frames were cut at it (so it plays at 1×); the landing clip plays at it. */
export const RATE = 1

/** The landing clip: 60 frames at 24fps played at RATE; the feet touch down at its frame 20. */
export const LAND = { duration: 60 / 24 / RATE, touchdown: 20 / 24 / RATE } as const

/**
 * The landing clip's first frame, relative to the landed bee: its body a little above where it
 * settles (fractions of the frame; the clip is mirrored so the bee faces right). The flight ends exactly there, so the crossfade from
 * the flying bee does not jump.
 */
export const LAND_START = { x: 0.0031, y: -0.0808 } as const

/**
 * In the landing clip the bee grows about 4% as it comes down (it moved toward that camera), which
 * on the page would read as the bee swelling. The landed bee is held at one size instead: scaled up by
 * 1/from about its feet, easing back to 1 as the clip's bee grows (seconds into the landing).
 */
export const LAND_GROWTH = { from: 0.958, start: 0, end: 37 / 24 / RATE } as const

type Mark = {
  /** Seconds on the timeline (set by the footage; see above). */
  t: number
  /** Where the bee's feet are, as fractions of the scene; 'land' is where the landing clip begins. */
  at: [number, number] | 'land'
  /** Depth: 1 is the landed bee's size. */
  scale: number
  /** How much it drifts here: 0 still, 1 the full hovering drift. */
  life: number
}

export const MARKS: Mark[] = [
  { t: 0, at: [-0.1, 0.25], scale: 0.5, life: 0 }, // off-screen left, in the band between the navigation and the headline
  { t: 1.4, at: [0.3, 0.21], scale: 0.62, life: 0 }, // gliding in above the copy, facing right
  { t: 2.3, at: [0.47, 0.23], scale: 0.85, life: 0 }, // past the copy, dipping toward the tablet
  { t: 73 / 24, at: 'land', scale: 1, life: 0 }, // where the landing clip begins, just above the tablet's edge
]

/** When the flying bee hands over to the landing clip. */
export const ARRIVE = MARKS[MARKS.length - 1].t
/** When the descent starts (the contact shadow fades in from here). */
export const DESCENT = 2.2

/** The marks in scene pixels (the bee's feet). */
export function buildFlight({ width: w, height: h, feet, frame }: FlightBox) {
  const frameH = frame / FRAME.aspect
  // where the landing clip's bee first appears: its offset from the landed bee, enlarged about the
  // feet like the landed bee is (LAND_GROWTH), and placed by the feet like the flying bee
  const k = 1 / LAND_GROWTH.from
  const centreToFeet = (FRAME.feetY - 0.5) * frameH
  const land: Point = { x: feet.x + k * LAND_START.x * frame, y: feet.y + k * LAND_START.y * frameH - (k - 1) * centreToFeet }
  return MARKS.map((m) => ({ ...m, point: m.at === 'land' ? land : { x: m.at[0] * w, y: m.at[1] * h } }))
}

/**
 * A smooth curve through (x, y) points that never overshoots between them (Fritsch–Carlson
 * monotone cubic). It turns the marks into smooth progress, scale and liveliness over time: speed
 * changes gradually and only reaches zero where the curve is flat, at the end (endSlope 0).
 * GSAP eases run between two values; this needs one curve through many, timed points.
 */
export function smoothThrough(xs: number[], ys: number[], endSlope?: number) {
  const n = xs.length
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]))
  const m = xs.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? (endSlope ?? d[n - 2]) : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2))
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const k = 3 / Math.sqrt(s)
      m[i] = k * a * d[i]
      m[i + 1] = k * b * d[i]
    }
  }
  return (x: number) => {
    const i = Math.max(0, Math.min(n - 2, xs.findIndex((_, j) => j < n - 1 && x <= xs[j + 1])))
    const h = xs[i + 1] - xs[i]
    const t = Math.max(0, Math.min(1, (x - xs[i]) / h))
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
  }
}

/** The tablet comes into focus as the bee comes in and settles on it (seconds on the flight's timeline). */
export const SCENE_TIMING = { focus: [2.2, 3.6] as const }
