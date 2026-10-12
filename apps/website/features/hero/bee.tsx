import { FRAME } from './flight'

/**
 * The decorative bee, server-rendered landed on its target so the page is complete without
 * JavaScript, with reduced motion, or before the opening runs. The clips are transparent (the bee
 * keyed off its background, centred, its own travel removed), so they sit straight on the scene.
 *
 * - `BeeLanded` stands on the landing target: the still, the landing clip over it during the
 *   opening, and a soft contact shadow under the feet.
 * - `BeeAirborne` is the flying bee, in scene coordinates; hero-motion.tsx moves it and gives the
 *   clips their source (WebM with alpha, or HEVC with alpha on Safari), so nothing loads until the
 *   opening plays.
 */
const BOX = 'pointer-events-none absolute aspect-[640/520] w-(--bee-w)'
const FILL = 'absolute inset-0 size-full select-none'

export function BeeLanded() {
  return (
    <>
      <div
        data-bee-shadow=""
        aria-hidden="true"
        className="pointer-events-none absolute h-[calc(var(--bee-w)*0.07)] w-[calc(var(--bee-w)*0.5)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] opacity-[0.18] [background:radial-gradient(closest-side,rgb(48_34_16),rgb(48_34_16/0))]"
      />
      <div
        data-bee-landed=""
        aria-hidden="true"
        className={BOX}
        style={{ left: 'calc(var(--bee-w) * -0.5)', top: `calc(var(--bee-w) / ${FRAME.aspect} * ${-FRAME.feetY})` }}
      >
        <img data-bee-rest="" src="/hero/bee/bee-rest.webp" alt="" width={640} height={520} decoding="async" className={FILL} />
        <video data-bee-clip="land" muted playsInline preload="none" className={`${FILL} opacity-0`} />
      </div>
    </>
  )
}

export function BeeAirborne() {
  return (
    <div data-bee-air="" aria-hidden="true" className={`${BOX} left-0 top-0 opacity-0 will-change-transform`}>
      <video data-bee-clip="air" muted playsInline preload="none" className={FILL} />
    </div>
  )
}
