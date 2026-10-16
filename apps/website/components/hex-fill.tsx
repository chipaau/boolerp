/**
 * A honeycomb that fills its box tile by tile: a pointy-top hexagon grid laid over the box (sliced
 * to cover it), each tile carrying where it sits across the box (--x, 0 to 1) and a little scatter
 * of its own (--r), so on its cell's hover the fill sweeps in from left to right, loosely, and
 * dissolves the same way (globals.css, .hex-fill). The scatter is a hash of the tile's index, so the
 * server and the browser draw the same.
 */
const BOX = { w: 176, h: 72 }
const R = 6 // a tile's radius, in the box
const W = Math.sqrt(3) * R

const TILES = (() => {
  const tiles: { points: string; x: number; r: number }[] = []
  let i = 0
  for (let row = 0; row * R * 1.5 <= BOX.h + R; row++) {
    for (let col = -1; col * W <= BOX.w + W; col++) {
      const cx = col * W + (row % 2 ? W / 2 : 0)
      const cy = row * R * 1.5
      const r = R * 1.02 // a hair over, so the filled tiles leave no gaps
      const w = (W / 2) * 1.02
      const points = [
        [cx, cy - r],
        [cx + w, cy - r / 2],
        [cx + w, cy + r / 2],
        [cx, cy + r],
        [cx - w, cy + r / 2],
        [cx - w, cy - r / 2],
      ]
        .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(' ')
      const hash = Math.sin(++i * 12.9898) * 43758.5453
      tiles.push({ points, x: Math.min(1, Math.max(0, cx / BOX.w)), r: hash - Math.floor(hash) })
    }
  }
  return tiles
})()

export function HexFill({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${BOX.w} ${BOX.h}`} preserveAspectRatio="xMidYMid slice" className={`hex-fill pointer-events-none absolute inset-0 size-full ${className}`}>
      {TILES.map((t, i) => (
        <polygon key={i} points={t.points} style={{ '--x': t.x.toFixed(3), '--r': t.r.toFixed(3) } as React.CSSProperties} />
      ))}
    </svg>
  )
}
