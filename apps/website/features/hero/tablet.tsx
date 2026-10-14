import Image from 'next/image'
import type { CSSProperties } from 'react'
import { HEX_PATH, HEX_VIEWBOX } from '@workspace/ui/components/hexagon'
import { APP_TILES, DASHBOARD, TABLET, TODAY_CELL, onScreen } from './scene'

/**
 * A frosted-glass tablet floating in the light, laid back in space and showing the real Bool
 * dashboard, drawn in CSS (styles in app/globals.css) so the product stays sharp at any size.
 *
 * The opening brings it into focus by crossfading two copies rather than animating a blur: the
 * `soft` copy is blurred once and only exists while the opening is pending, and the `sharp` copy
 * fades in over it as the bee lands. Opacity is all that animates, so the browser never re-blurs.
 * The sharp copy also carries the parts of the dashboard that come alive after the landing, and the
 * product demo the scroll story plays on its screen.
 */
export function Tablet({ focus }: { focus: 'soft' | 'sharp' }) {
  return (
    <div data-tablet={focus} aria-hidden={focus === 'soft' || undefined} className="tablet-layer absolute inset-0">
      <div aria-hidden="true" className="tablet-shadow" />
      <div
        className="tablet"
        style={{
          left: TABLET.left,
          top: TABLET.top,
          width: `calc(${TABLET.width} * ${TABLET.raster})`,
          transform: `${TABLET.transform} scale(${1 / TABLET.raster})`,
          aspectRatio: TABLET.aspect,
          padding: `${TABLET.bezel * 100}%`,
        }}
      >
        {/* the scroll story's lift: its shadow on its own layer, faded by --lift (story.ts), never repainted */}
        <div aria-hidden="true" className="tablet-rest" />
        <div aria-hidden="true" className="tablet-lift" />
        <div className="tablet-screen">
          <Image
            src={DASHBOARD.src}
            alt={focus === 'sharp' ? 'The Bool workspace home' : ''}
            width={DASHBOARD.width}
            height={DASHBOARD.height}
            priority={focus === 'sharp'}
            unoptimized // the app tiles reuse this exact file, so it must be one URL
            className="size-full object-cover object-top"
          />
          {focus === 'sharp' && (
            <>
              <LiveParts />
              {/* the product demo, played here by the scroll story (story.ts); it and its poster load only when the story starts (demo.ts) */}
              <div data-demo-camera="" className="absolute inset-0 origin-top-left will-change-transform">
                <video data-demo-video="" muted playsInline preload="none" className="absolute inset-0 size-full object-cover object-top opacity-0" />
                {/* the spotlight: the part of the screen the caption is about, the rest gently dimmed */}
                <div data-demo-spot="" aria-hidden="true" className="demo-spot" />
              </div>
              {/* a soft reflection on the glass, sliding across as the tablet turns (story.ts sets --glare) */}
              <div aria-hidden="true" className="tablet-glare">
                <div className="tablet-glare-band" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const percent = (box: ReturnType<typeof onScreen>): CSSProperties => ({
  left: `${box.left}%`,
  top: `${box.top}%`,
  width: `${box.width}%`,
  height: `${box.height}%`,
})

// the brand hexagon as a mask, stretched to each tile's box
const HEX_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${HEX_VIEWBOX}' preserveAspectRatio='none'><path d='${HEX_PATH}'/></svg>`,
)}") center / 100% 100% no-repeat`

/**
 * The parts of the dashboard that come alive after the landing: the app hexagons, and today's cell
 * in the heat map over a light glow. Each is a copy of its own patch of the dashboard image, cut to
 * the brand hexagon and laid exactly over it, so at rest nothing shows and the opening can lift it.
 * Aligned without script; hero-motion.tsx animates them.
 */
function LiveParts() {
  const { w, h } = APP_TILES.size
  const [tx, ty] = TODAY_CELL.centre
  const today = onScreen(tx, ty, TODAY_CELL.size.w, TODAY_CELL.size.h)
  const glow = onScreen(tx, ty, TODAY_CELL.size.w * 2.4, TODAY_CELL.size.h * 2.4)
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div data-today-glow="" className="today-glow absolute" style={percent(glow)} />
      <LiveTile kind="today" box={today} />
      {APP_TILES.centres.map(([cx, cy]) => (
        <LiveTile key={`${cx},${cy}`} kind="app" box={onScreen(cx, cy, w, h)} />
      ))}
    </div>
  )
}

/** One patch of the dashboard, cut to a hexagon over its own soft shadow. */
function LiveTile({ kind, box }: { kind: 'app' | 'today'; box: ReturnType<typeof onScreen> }) {
  return (
    <div data-live-tile={kind} className="absolute" style={percent(box)}>
      {kind === 'app' && <div data-live-tile-shadow="" className="app-tile-shadow" />}
      <div data-live-tile-face="" className="absolute inset-0 overflow-hidden" style={{ mask: HEX_MASK }}>
        {/* the whole screen's image, offset so this tile's patch shows through */}
        <div
          className="absolute bg-cover bg-top"
          style={{
            backgroundImage: `url(${DASHBOARD.src})`,
            left: `${(-box.left / box.width) * 100}%`,
            top: `${(-box.top / box.height) * 100}%`,
            width: `${(100 / box.width) * 100}%`,
            height: `${(100 / box.height) * 100}%`,
          }}
        />
      </div>
    </div>
  )
}
