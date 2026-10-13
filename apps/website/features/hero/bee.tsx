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
 *   opening plays. It also carries the take-off, for when the scroll story sends it away.
 * - `BeeTrail` is a short dotted tail behind the flying bee, like the bee in the app icons: it
 *   follows the bee and disappears behind it, during the opening only, and is empty otherwise.
 */
const BOX = 'pointer-events-none absolute aspect-[640/520] w-(--bee-w)'
const FILL = 'absolute inset-0 size-full select-none'

export function BeeLanded() {
  return (
    <>
      <div
        data-bee-shadow=""
        aria-hidden="true"
        className="pointer-events-none absolute h-[calc(var(--bee-w)*0.075)] w-[calc(var(--bee-w)*0.56)] -translate-x-1/2 -translate-y-[40%] rounded-[50%] opacity-[0.34] [background:radial-gradient(closest-side,rgb(52_36_16),rgb(52_36_16/0.45)_45%,rgb(52_36_16/0))]"
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
      {/* the take-off, for the scroll story (the landing run backwards into the flight run backwards) */}
      <video data-bee-clip="takeoff" muted playsInline preload="none" className={`${FILL} opacity-0`} />
    </div>
  )
}

export function BeeTrail() {
  return (
    <svg data-bee-trail="" aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
      <defs>
        {/* the stretch just behind the bee (hero-motion.tsx slides this one dash along as it flies) */}
        <mask id="bee-trail-flown" maskUnits="userSpaceOnUse">
          <path data-bee-trail-reveal="" fill="none" stroke="white" strokeWidth="16" />
        </mask>
      </defs>
      <path
        data-bee-trail-dots=""
        fill="none"
        stroke="var(--brand-soft)"
        strokeOpacity="0.75"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="0 10"
        mask="url(#bee-trail-flown)"
      />
    </svg>
  )
}
