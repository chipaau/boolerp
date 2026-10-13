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
 * The sharp copy also carries the parts of the dashboard that come alive after the landing.
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
          width: TABLET.width,
          transform: TABLET.transform,
          aspectRatio: TABLET.aspect,
          padding: `${TABLET.bezel * 100}%`,
        }}
      >
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
          {focus === 'sharp' && <LiveParts />}
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
 * The app hexagons, each a copy of its own patch of the dashboard image cut to the hexagon and laid
 * exactly over it (invisible at rest), so the opening can lift them one by one; and a warm glow
 * under the heat map's darkest cell. Static and aligned without script; hero-motion.tsx animates them.
 */
function LiveParts() {
  const { w, h } = APP_TILES.size
  const glow = onScreen(TODAY_CELL.centre[0], TODAY_CELL.centre[1], TODAY_CELL.size.w * 2.6, TODAY_CELL.size.h * 2.6)
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div data-today-glow="" className="today-glow absolute" style={percent(glow)} />
      {APP_TILES.centres.map(([cx, cy]) => {
        const box = onScreen(cx, cy, w, h)
        return (
          <div key={`${cx},${cy}`} data-app-tile="" className="absolute" style={percent(box)}>
            <div data-app-tile-shadow="" className="app-tile-shadow" />
            <div data-app-tile-face="" className="absolute inset-0 overflow-hidden" style={{ mask: HEX_MASK }}>
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
      })}
    </div>
  )
}
