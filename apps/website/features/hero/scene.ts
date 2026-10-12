/**
 * Geometry of the hero scene: a stage the size of the hero (1672×941, the bee flies over all of it)
 * holding the platform, the tablet on it and the bee's landing spot. Everything is a share of the
 * stage's width (cqw on the stage container) or a percentage, so it stays in proportion at any size
 * without script.
 */
export const STAGE = { width: 1672, height: 941 } as const

/**
 * The terrazzo plinth (public/hero/platform.webp, 1416×380, cut out): a foreground ledge across the
 * right of the stage, running off its right and bottom edges like the reference photograph.
 */
export const PLATFORM = { src: '/hero/platform.webp', width: 1416, height: 380, left: '37%', top: '72%', size: '76cqw' } as const

/** The workspace Home, exported from the design, shown on the tablet. */
export const DASHBOARD = { src: '/hero/dashboard.webp', width: 1600, height: 971 } as const

/** The tablet, standing on the plinth's top and turned toward the copy. */
export const TABLET = { left: '52%', top: '22%', size: '44cqw' } as const

/** Where the bee lands: on the front of the plinth, left of the tablet and clear of the copy. */
export const LANDING = { left: '46%', top: '81.5%' } as const
