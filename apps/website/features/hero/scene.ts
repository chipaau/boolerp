/**
 * Geometry of the hero scene: a 1672×880 stage holding the floating tablet and the bee's landing
 * spot. From lg the stage is the page's content column (the header's max-w-7xl less its padding),
 * so the tablet's right edge lines up with the header and the content below at every width; below
 * lg it is widened and cropped to the tablet. Everything is a share of the stage's width (cqw on
 * the stage container) or a percentage, so it stays in proportion without script. The bee flies
 * beyond the stage, in from the edge of the screen.
 */
export const STAGE = { width: 1672, height: 880 } as const

/** The workspace Home, exported from the design, shown on the tablet. */
export const DASHBOARD = { src: '/hero/dashboard.webp', width: 1600, height: 971 } as const

/**
 * The tablet: a 1.45:1 slab anchored at its top-left corner and laid back in space at the
 * reference's angle, at 92% of its size, its right edge on the stage's right edge (corners at
 * 866,205 · 1670,263 · 1576,805 · 748,687 on the stage). The
 * projective map is written as rotate3d + perspective + a linear matrix because those accept
 * lengths, and a perspective in cqw scales with the stage where a matrix3d would not.
 */
export const TABLET = {
  left: '51.789%',
  top: '23.252%',
  width: '52.033cqw',
  transform:
    'matrix(0.99521, 0.17490, -0.09342, 0.83663, 0, 0) perspective(281.998cqw) rotate3d(0.49588, -0.86839, 0, 40deg)',
} as const

/** Where the bee lands: on the tablet's bottom edge, near its left corner (that point mapped through TABLET). */
export const LANDING = { left: '52.931%', top: '79.661%' } as const
