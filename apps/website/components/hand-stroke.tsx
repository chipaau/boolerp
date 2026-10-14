import type { SVGProps } from 'react'
import { cn } from '@workspace/ui/lib/utils'

/**
 * The site's hand-drawn amber stroke: under "everything" in the hero, and under a menu item on
 * hover. Laid along the bottom of its (relative) parent and stretched to its width; it is revealed
 * by its parent with a clip-path wipe (left to right), never by a dash, which Chromium breaks into
 * pieces on a stretched SVG.
 */
export function HandStroke({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 20"
      preserveAspectRatio="none"
      className={cn('absolute -bottom-[0.14em] left-0 h-[0.28em] w-full overflow-visible', className)}
      {...props}
    >
      <path d="M3 13 C 52 5, 118 3, 197 9" fill="none" stroke="var(--brand-soft)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
