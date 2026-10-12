/**
 * The decorative bee, laid out landed on its target so the page is complete without JavaScript.
 * hero-motion.tsx flies it in: it moves [data-bee] (x, y, rotation, scale), flips
 * [data-bee-facing], and sets `data-pose`, which shows one clip (CSS in app/globals.css).
 *
 * The clips are the same bee on white with a locked camera, cropped identically, so one swaps for
 * the next in place. The layer they sit in multiplies onto the photo (hero.tsx), which makes the
 * white disappear and keeps the translucent wings and the landing shadow, with plain MP4s.
 * The still is the landing clip's last frame, so the hand-over to it is invisible.
 */
export const BEE_CLIPS = [
  { pose: 'fly', src: '/hero/bee/bee-fly.mp4', loop: true }, // side-on hover, ping-ponged so it loops
  { pose: 'swoop', src: '/hero/bee/bee-swoop.mp4', loop: false }, // turns to the camera and back
  { pose: 'land', src: '/hero/bee/bee-land.mp4', loop: false }, // descent, legs out, touchdown, settle
] as const

export type BeePose = (typeof BEE_CLIPS)[number]['pose'] | 'rest'

// In the 7:6 clip frame the standing bee's feet are at 48% across and 74% down; that point sits on
// the landing target.
const FEET = { x: 0.48, y: 0.74 }
const FRAME = 'absolute inset-0 size-full select-none'

export function Bee() {
  return (
    <div
      data-bee=""
      data-pose="rest"
      aria-hidden="true"
      className="pointer-events-none absolute aspect-[7/6] w-(--bee-w) will-change-transform"
      style={{
        left: `calc(var(--bee-w) * ${-FEET.x})`,
        top: `calc(var(--bee-w) * ${(-6 / 7) * FEET.y})`,
        transformOrigin: `${FEET.x * 100}% 50%`,
      }}
    >
      <div data-bee-facing="" className="relative size-full">
        {BEE_CLIPS.map((c) => (
          <video key={c.pose} data-clip={c.pose} src={c.src} muted playsInline loop={c.loop} preload="none" className={FRAME} />
        ))}
        <img data-clip="rest" src="/hero/bee/bee-rest.webp" alt="" width={560} height={480} decoding="async" className={FRAME} />
      </div>
    </div>
  )
}
