'use client'

import { cn } from '@workspace/ui/lib/utils'
import { CareArt } from '@/components/care-art/care-art'
import { useShowArt } from '@/components/care-art/use-show-art'

/**
 * The care diagram beside the sign-in form (Pathways, drawn in on load). It fills whatever box the
 * screen gives it (the drawing covers the box, centred), and the screen says where and how faint.
 * Phones have none.
 */
export function HeroArt({ className }: { className?: string }) {
  if (!useShowArt()) return null
  return (
    <div aria-hidden className={cn('pointer-events-none', className)}>
      <CareArt kind="pathways" className="absolute inset-0" />
    </div>
  )
}
