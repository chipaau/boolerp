import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowCircle } from '@workspace/ui/components/arrow-button'
import { Hexagon } from '@workspace/ui/components/hexagon'
import { Honeycomb, HoneycombItem  } from '@workspace/ui/components/honeycomb'
import type {HexCell} from '@workspace/ui/components/honeycomb';
import { SectionTitle } from '@workspace/ui/components/section-title'
import { cn } from '@workspace/ui/lib/utils'
import { AppIcon } from '@/components/app-icon'
import { getApp  } from '@/lib/apps'
import type {AppDef} from '@/lib/apps';

// Which apps get a tile, in reading order (the Figma frame); everything else lives in the switcher.
const TILE_ORDER = [
  'control-centre',
  'tasks',
  'inventory',
  'asset',
  'notes',
  'directory',
  'analytics',
  'procurement',
] as const
const TILES = TILE_ORDER.map((slug) => getApp(slug)).filter((a): a is AppDef => Boolean(a))

// Slots on a 2-column pointy-top grid, matching the design: 1 / 2 / 1 / 2 / 2 tiles per row.
const SLOTS: HexCell[] = [
  { col: 1, row: 0 },
  { col: 0, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: 2 },
  { col: 0, row: 3 },
  { col: 1, row: 3 },
  { col: 0, row: 4 },
  { col: 1, row: 4 },
]

/**
 * The faded gradient hexes: they fill the empty slots of the same tessellation, so they lock to
 * the tiles (left of Control Centre, right of Inventory, both sides of Asset with the darkest on
 * the right, left of Notes, right of Directory, and under the bottom row). Each turns its gradient
 * so the light end faces top-left, the way the shadows fall.
 */
const DECOR: (HexCell & { opacity: number; angle: number })[] = [
  { col: 1, row: -1, opacity: 0.3, angle: 200 }, // up-right of Control Centre
  { col: 0, row: 0, opacity: 0.55, angle: 150 },
  { col: 2, row: 0, opacity: 0.3, angle: 210 },
  { col: 2, row: 1, opacity: 0.3, angle: 210 },
  { col: 0, row: 2, opacity: 0.6, angle: 150 },
  { col: 2, row: 2, opacity: 0.95, angle: 265 }, // darkest on the side that faces Asset
  { col: -1, row: 3, opacity: 0.5, angle: 140 },
  { col: 2, row: 3, opacity: 0.4, angle: 210 },
  { col: 0, row: 5, opacity: 0.45, angle: 150 },
  { col: 1, row: 5, opacity: 0.9, angle: 15 }, // under "Browse All Apps": dark end at the top, where the button sits
]

function itemLeft(cell: HexCell) {
  return `calc(var(--hc-x) * ${cell.col + (cell.row % 2 ? 0.5 : 0)})`
}
function itemTop(cell: HexCell) {
  return `calc(var(--hc-y) * ${cell.row})`
}
/**
 * The caption leader for the hovered tile: a line grows out from beneath the tile to a dot, and
 * the app's one-line description fades in beyond it. It sits under the tiles, so right-column
 * tiles run a longer line that passes under the neighbour and re-emerges on its far side, while
 * left-column tiles use a short one. Timing is identical for every tile.
 */
// How far each leader reaches, in tile widths, beyond the column pitch a right-column line must
// cross. Lower tiles get a little more so their names clear the rows above.
const LEADER_REACH: Record<string, number> = { inventory: 0.75, notes: 0.8, directory: 1.0, procurement: 0.75 }

function Leader({ app, cell }: { app: AppDef; cell: HexCell }) {
  const reach = LEADER_REACH[app.slug] ?? 0.45
  const length = cell.col === 1 ? `calc(var(--hc-x) + var(--hc-w) * ${reach})` : `calc(var(--hc-w) * ${reach})`
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute z-0 flex w-max items-center gap-2.5"
      style={{
        left: `calc(${itemLeft(cell)} + var(--hc-w) * 0.12)`,
        top: `calc(${itemTop(cell)} + var(--hc-h) / 2)`,
        transform: 'translate(-100%, -50%)',
      }}
    >
      <span className="max-w-[5.5rem] animate-rise text-right text-micro leading-[1.35] font-bold tracking-[0.06em] text-muted-foreground uppercase [animation-delay:240ms]">
        {app.description}
      </span>
      <span className="relative h-px origin-right animate-grow-x bg-faint/80" style={{ width: length }}>
        <span className="absolute top-1/2 left-0 size-1.5 -translate-y-1/2 rounded-full bg-faint" />
      </span>
    </span>
  )
}

/**
 * The app grid's signature element: Soft Cream tiles (card tone with a hairline in dark mode),
 * tessellated with a half-width offset and a 24% vertical overlap, over a field of faded gradient
 * hexagons. Hovering a tile fades it to Sand and draws its leader line beneath the grid.
 */
export function AppsHoneycomb() {
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <section className="space-y-4">
      <SectionTitle className="ps-10">Apps</SectionTitle>
      {/* the grid rides up so the top tile's apex sits level with the title; its left column starts a row lower, so nothing collides */}
      <Honeycomb cellSize="10rem" cols={2} rows={5} gap={0.1} rowPitch={0.76} className="relative z-0 -mt-6 ml-auto">
        {DECOR.map((d, i) => (
          <HoneycombItem key={`d${i}`} col={d.col} row={d.row} aria-hidden="true" className="pointer-events-none -z-10">
            <Hexagon
              size="100%"
              gradient={['var(--hex-decor-from)', 'var(--hex-decor-to)']}
              gradientAngle={d.angle}
              style={{ opacity: d.opacity }}
            />
          </HoneycombItem>
        ))}
        {/* keyed by tile so moving between tiles remounts the leader and replays its entrance */}
        {hovered !== null && TILES[hovered] && <Leader key={hovered} app={TILES[hovered]} cell={SLOTS[hovered]} />}
        {TILES.slice(0, SLOTS.length).map((app, i) => {
          const active = hovered === i
          return (
            <HoneycombItem
              key={app.slug}
              col={SLOTS[i].col}
              row={SLOTS[i].row}
              data-tile=""
              className="z-10 animate-rise"
              style={{ animationDelay: `${240 + i * 40}ms` }}
            >
              <Link
                to="/$app"
                params={{ app: app.slug }}
                className="block size-full outline-none"
                aria-label={`Open ${app.name}`}
                title={app.description}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered((h) => (h === i ? null : h))}
              >
                <Hexagon
                  size="100%"
                  interactive
                  stroke={active ? 'var(--tile-hover-stroke)' : 'var(--tile-stroke)'}
                  strokeWidth={1}
                  className={cn(
                    'transition-[color,transform] duration-quick ease-hexa',
                    active ? 'text-tile-hover-fill' : 'text-tile-fill'
                  )}
                >
                  <div className="flex flex-col items-center gap-2.5">
                    {/* the logo lifts and grows a touch while the tile is hovered: instant, never bouncy */}
                    <AppIcon
                      slug={app.slug}
                      variant="art"
                      size={50}
                      className={cn(
                        'transition-transform duration-instant ease-hexa',
                        active && 'scale-[1.08] -translate-y-0.5'
                      )}
                    />
                    <span className="text-ui-lg font-bold text-foreground">{app.name}</span>
                  </div>
                </Hexagon>
              </Link>
            </HoneycombItem>
          )
        })}
      </Honeycomb>
      {/* the grid is a positioned layer, so the button needs its own to sit on top of the decor */}
      <div className="relative z-10 flex justify-end pt-2">
        <button
          type="button"
          className="group inline-flex items-center gap-3 rounded-full text-ui-sm font-bold text-body outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Browse All Apps
          <ArrowCircle small />
        </button>
      </div>
    </section>
  )
}
