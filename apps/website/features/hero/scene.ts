/**
 * Geometry of the hero scene: a 1527×881 stage holding the floating tablet and the bee's landing
 * spot. From lg the stage runs from the edge of the screen leftward, as wide as the space from the
 * content's left edge (the header's max-w-7xl less its padding) but never more than 88% of the
 * screen or 96rem, so the tablet breaks out past the content column on the right like the
 * reference, and on narrower screens steps back to keep clear of the copy. Below lg it is widened and cropped to the
 * tablet. Everything is a share of the stage's width (cqw on the stage container) or a percentage,
 * so it stays in proportion without script. The bee flies beyond the stage, in from the screen's edge.
 */
export const STAGE = { width: 1527, height: 881 } as const

/** The workspace Home, exported from the design, shown on the tablet (served as is, so its parts can reuse it). */
export const DASHBOARD = { src: '/hero/dashboard.webp', width: 2000, height: 1215 } as const

/**
 * The tablet: a 1.55:1 slab anchored at its top-left corner and laid back in space where the
 * reference has it: its top level with the eyebrow, its left side just past the copy, its right
 * corner near the screen's edge (corners at 622,190 · 1496,253 · 1394,843 · 494,714 on the stage). The
 * projective map is written as rotate3d + perspective + a linear matrix because those accept
 * lengths, and a perspective in cqw scales with the stage where a matrix3d would not.
 * `bezel` is the glass edge around the screen, as a share of the tablet's width.
 */
export const TABLET = {
  aspect: 1.55,
  bezel: 0.009,
  left: '40.733%',
  top: '21.566%',
  width: '56.974cqw',
  transform:
    'matrix(1.07191, 0.20106, -0.11455, 0.97878, 0, 0) perspective(303.497cqw) rotate3d(0.52102, -0.85354, 0, 40deg)',
} as const

/**
 * Where the bee lands: just in front of the tablet's bottom edge near its left corner, so the lower half
 * of the bee stands clear of the tablet and the upper half overlaps it.
 */
export const LANDING = { left: '42.093%', top: '86.443%' } as const

/**
 * Parts of the dashboard that come alive after the landing, measured on the image (px): the app
 * hexagons (centres; every tile 205×225) and the heat map's darkest cell, today.
 */
export const APP_TILES = {
  size: { w: 205, h: 225 },
  centres: [
    [1728, 254], // Control center
    [1619, 444], // Task
    [1840, 444], // Inventory
    [1728, 638], // Asset
    [1616, 826], // Notes
    [1836, 826], // App 4
    [1510, 1015], // Analytics
    [1729, 1015], // Procurement
  ],
} as const
export const TODAY_CELL = { centre: [919.5, 335.5], size: { w: 34, h: 36 } } as const

/**
 * Where a box on the dashboard image (px) falls on the tablet's screen, in percentages of the
 * screen. The image fills the screen's height and is centred across it (object-cover,
 * object-top), so a little is trimmed from each side.
 */
export function onScreen(cx: number, cy: number, w: number, h: number) {
  const screenAspect = (1 - 2 * TABLET.bezel) / (1 / TABLET.aspect - 2 * TABLET.bezel)
  const imageWidth = DASHBOARD.width / DASHBOARD.height / screenAspect // the image's width, in screen widths
  const x = (px: number) => ((px / DASHBOARD.width) * imageWidth - (imageWidth - 1) / 2) * 100
  const y = (px: number) => (px / DASHBOARD.height) * 100
  return {
    left: x(cx - w / 2),
    top: y(cy - h / 2),
    width: x(cx + w / 2) - x(cx - w / 2),
    height: y(cy + h / 2) - y(cy - h / 2),
  }
}
