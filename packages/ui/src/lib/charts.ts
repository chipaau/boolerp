/**
 * Small SVG path helpers shared by the charts. Series are plotted on a fixed viewBox and drawn
 * with `preserveAspectRatio="none"`, so the strokes use `vector-effect="non-scaling-stroke"`.
 */
export type Point = readonly [number, number]

/** A gently smoothed line through the points (Catmull-Rom style, tension 0.19 like the design). */
export function smoothPath(points: Point[], tension = 0.19): string {
  if (points.length === 0) return ""
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    d +=
      ` C${(p1[0] + (p2[0] - p0[0]) * tension).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) * tension).toFixed(1)}` +
      ` ${(p2[0] - (p3[0] - p1[0]) * tension).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) * tension).toFixed(1)}` +
      ` ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

/** The same line closed down to the baseline, for a gradient wash under it. */
export function areaPath(points: Point[], width: number, baseline: number, tension = 0.19): string {
  if (points.length === 0) return ""
  return `${smoothPath(points, tension)} L${width},${baseline.toFixed(1)} L0,${baseline.toFixed(1)} Z`
}

/** Places values evenly across `width`, scaling them between `top` and `bottom` for `max`. */
export function plot(values: number[], width: number, top: number, bottom: number, max: number): Point[] {
  const n = Math.max(values.length - 1, 1)
  return values.map((v, i) => [(i * width) / n, bottom - (v / max) * (bottom - top)] as const)
}

/** A rounded axis maximum: about 8% headroom, snapped to a friendly step. */
export function niceMax(values: number[]): number {
  const raw = Math.max(...values, 1)
  const step = Math.pow(10, Math.floor(Math.log10(raw))) / 2
  return Math.ceil((raw * 1.08) / (step * 4)) * step * 4
}
