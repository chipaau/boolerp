/**
 * Geometry of the hero scene: a 1398×820 stage holding the floating tablet and the bee's landing
 * spot. From lg the stage is the page's content column (the header's max-w-7xl less its padding),
 * so the tablet's right edge lines up with the header and the content below at every width; below
 * lg it is widened and cropped to the tablet. Everything is a share of the stage's width (cqw on
 * the stage container) or a percentage, so it stays in proportion without script. The bee flies
 * beyond the stage, in from the edge of the screen.
 */
export const STAGE = { width: 1398, height: 820 } as const

/** The workspace Home, exported from the design, shown on the tablet (served as is, so its parts can reuse it). */
export const DASHBOARD = { src: '/hero/dashboard.webp', width: 2000, height: 1215 } as const

/**
 * The tablet: a 1.55:1 slab anchored at its top-left corner and laid back in space at the
 * reference's angle, its top level with the eyebrow, its right corner on the content's right edge
 * and as large as fits beside the copy (corners at 662,190 · 1396,243 · 1310,739 · 554,630 on the
 * stage). The
 * projective map is written as rotate3d + perspective + a linear matrix because those accept
 * lengths, and a perspective in cqw scales with the stage where a matrix3d would not.
 * `bezel` is the glass edge around the screen, as a share of the tablet's width.
 *
 * `raster`: a tilted 3D element is painted at its layout size and then warped, which softens the
 * dashboard. The tablet is laid out `raster` times larger and scaled back down in the same
 * transform, so the browser paints it with that many times the pixels and stays sharp.
 */
export const TABLET = {
  aspect: 1.55,
  bezel: 0.0078,
  raster: 2,
  left: '47.342%',
  top: '23.171%',
  width: '62.232cqw',
  transform:
    'matrix(0.90041, 0.16889, -0.09622, 0.82217, 0, 0) perspective(331.502cqw) rotate3d(0.52102, -0.85354, 0, 40deg)',
} as const

/**
 * Where the bee lands: just in front of the tablet's bottom edge near its left corner, so the lower half
 * of the bee stands clear of the tablet and the upper half overlaps it.
 */
export const LANDING = { left: '48.589%', top: '81.735%' } as const

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
export const TODAY_CELL = { centre: [919.5, 335.5], size: { w: 40, h: 43 } } as const // with its outline

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
