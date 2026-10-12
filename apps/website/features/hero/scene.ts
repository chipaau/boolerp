/**
 * Geometry of the hero photograph (public/hero/hero-scene.webp, 1672×941), measured once from the
 * image. Everything placed on the photo is expressed as a share of its width (cqw on the scene
 * container) or as percentages, so it stays registered to the photo at any size without script.
 */
export const SCENE = { width: 1672, height: 941, src: '/hero/hero-scene.webp' } as const

/** The workspace Home, exported from the design, shown on the laptop. */
export const DASHBOARD = { src: '/hero/dashboard.webp', width: 1600, height: 971 } as const

/**
 * The laptop's display. The dashboard sits in a 16:10 box anchored at the screen's top-left corner and
 * bent onto the other three corners (915,258 · 1575,214 · 1555,685 · 867,678). The projective map
 * is written as rotate3d + perspective + a linear matrix because those accept lengths, and a
 * perspective in cqw scales with the photo where a matrix3d would not.
 */
export const SCREEN = {
  left: '54.725%',
  top: '27.418%',
  width: '39.474cqw',
  transform:
    'matrix(1.06815, 0.06375, 0.00326, 1.05385, 0, 0) perspective(197.523cqw) rotate3d(0.54588, -0.83786, 0, 40deg)',
} as const

/** Where the bee stands: on the stone just in front of the laptop's left side (800,752), clear of the copy. */
export const LANDING = { left: '47.847%', top: '79.915%' } as const
