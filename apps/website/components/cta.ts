/**
 * The site's main call to action: the design system's amber `brand` button, muted on the website
 * (a softer apricot, same dark text and warm-white arrow circle). Set on the website's buttons
 * rather than changing the shared variant, which the sign-in screens use as is.
 */
export const CTA = 'bg-[#e8a96f] hover:bg-[#de9c5e]'
/** Its arrow: on hover the circle turns charcoal and the arrow swings up a quarter, toward where it goes. */
export const CTA_ARROW =
  'transition-[background-color,color] duration-300 group-hover/btn:bg-[#3a3632]! group-hover/btn:text-[#fff7ea]! [&>svg]:transition-transform [&>svg]:duration-300 [&>svg]:ease-out group-hover/btn:[&>svg]:-rotate-45'
