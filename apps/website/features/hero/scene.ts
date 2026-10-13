/**
 * Geometry of the hero scene: a stage the size of the hero (1672×941, the bee flies over all of it)
 * holding the floating tablet and the bee's landing spot. Everything is a share of the stage's width
 * (cqw on the stage container) or a percentage, so it stays in proportion at any size without script.
 */
export const STAGE = { width: 1672, height: 941 } as const

/** The workspace Home, exported from the design, shown on the tablet. */
export const DASHBOARD = { src: '/hero/dashboard.webp', width: 1600, height: 971 } as const

/**
 * The tablet: a 1.45:1 slab anchored at its top-left corner and laid back in space so its corners
 * fall where the reference has them (767,250 · 1641,313 · 1539,903 · 639,774 on the stage). The
 * projective map is written as rotate3d + perspective + a linear matrix because those accept
 * lengths, and a perspective in cqw scales with the stage where a matrix3d would not.
 */
export const TABLET = {
  left: '45.873%',
  top: '26.567%',
  width: '52.033cqw',
  transform:
    'matrix(1.08175, 0.19011, -0.10154, 0.90938, 0, 0) perspective(281.998cqw) rotate3d(0.49588, -0.86839, 0, 40deg)',
} as const

/** Where the bee lands: on the tablet's bottom edge, near its left corner (that point mapped through TABLET). */
export const LANDING = { left: '47.115%', top: '83.906%' } as const
