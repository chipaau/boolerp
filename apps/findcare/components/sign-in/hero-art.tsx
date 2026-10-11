'use client'

import { cn } from '@workspace/ui/lib/utils'
import { CareArt } from '@/components/care-art/care-art'

/**
 * The care diagram beside the sign-in form (Pathways, drawn in on load). It fills whatever box the
 * screen gives it (the drawing covers the box, centred), and the screen says where and how faint.
 */
export function HeroArt({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none', className)}>
      <CareArt kind="pathways" intro className="absolute inset-0" />
    </div>
  )
}
