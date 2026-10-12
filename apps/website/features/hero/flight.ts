/**
 * The bee's flight, as data. Pure functions only (no DOM, no GSAP) so the path and timing can be
 * tuned or tested on their own; hero-motion.tsx measures the page and plays the result.
 *
 * Modelled on the reference: far away, the bee crosses left → right, turns, then swoops back
 * toward the camera (largest in the middle, looking at us) and drops onto the stone, where the
 * landing clip finishes the touchdown.
 *
 * Points are offsets from where the bee stands (home is 0,0) because the bee is laid out on the
 * landing target; GSAP starts an array path from the bee's current position, so each leg lists
 * only the points after it and `start` is where the bee is placed first.
 */

export type Point = { x: number; y: number }

export type FlightBox = {
  /** Scene size: the photo the bee flies over. */
  width: number
  height: number
  /** The bee's resting feet, relative to the scene's top-left. */
  home: Point
}

/** Timeline marks in seconds (desktop; tablet plays the same faster). */
export const TIMING = {
  crossEnd: 1.3, // left → right done
  bankEnd: 1.6, // turned to face left; the swoop clip starts
  closest: 2.25, // nearest the camera, mid-swoop
  land: 2.9, // the landing clip takes over just before the bee arrives
  arrive: 3.0, // over the target; the clip finishes the descent
  focus: [1.7, 3.4], // the scene comes into focus across the swoop and descent
} as const

/** Clip playback rates, chosen so the swoop's look at the camera falls at `closest`. */
export const RATE = { fly: 1, swoop: 1.6, land: 1.5 } as const

/** How long the landing clip runs at its rate (2.75s source). */
export const LAND_DURATION = 2.75 / RATE.land

/** Depth as scale: small and far, huge mid-swoop, natural size on the stone. */
export const DEPTH = { entry: 0.5, crossing: 0.65, bank: 0.7, closest: 2.2, landed: 1 } as const

export function buildFlight({ width: w, height: h, home }: FlightBox) {
  // a scene-relative point, converted to an offset from home
  const at = (fx: number, fy: number): Point => ({ x: fx * w - home.x, y: fy * h - home.y })

  return {
    // across the upper wall, below the header and above the laptop's top edge
    start: at(-0.08, 0.36),
    crossing: [at(0.25, 0.28), at(0.55, 0.2), at(0.8, 0.18)],
    bank: [at(0.87, 0.16), at(0.83, 0.21)],
    // back through the open wall between the copy and the laptop, toward the viewer
    swoop: [at(0.66, 0.24), at(0.47, 0.42)],
    // down onto the stone, arriving from above and to the right
    descent: [at(0.52, 0.6), { x: 0.02 * w, y: -0.04 * h }, { x: 0, y: 0 }],
  }
}
