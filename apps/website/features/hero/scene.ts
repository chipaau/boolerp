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

/** The workspace Home, exported from the design, shown on the tablet. */
export const DASHBOARD = { src: '/hero/dashboard.webp', width: 1600, height: 971 } as const

/**
 * The tablet: a 1.45:1 slab anchored at its top-left corner and laid back in space where the
 * reference has it: its top level with the eyebrow, its left side just past the copy, its right
 * corner near the screen's edge (corners at 622,190 · 1496,253 · 1394,843 · 494,714 on the stage). The
 * projective map is written as rotate3d + perspective + a linear matrix because those accept
 * lengths, and a perspective in cqw scales with the stage where a matrix3d would not.
 */
export const TABLET = {
  left: '40.733%',
  top: '21.566%',
  width: '56.974cqw',
  transform:
    'matrix(1.08175, 0.19011, -0.10154, 0.90938, 0, 0) perspective(308.775cqw) rotate3d(0.49588, -0.86839, 0, 40deg)',
} as const

/**
 * Where the bee lands: just in front of the tablet's bottom edge near its left corner, so the lower half
 * of the bee stands clear of the tablet and the upper half overlaps it.
 */
export const LANDING = { left: '42.093%', top: '86.443%' } as const
