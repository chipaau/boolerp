'use client'

import { cn } from '@workspace/ui/lib/utils'
import { CareArt } from '@/components/care-art/care-art'
import { useShowArt } from '@/components/care-art/use-show-art'

// The care diagram behind Find care's search card, as the prototype places it: a 1440×900 drawing
// centred on a point, scaled. At rest it sits large and to the right; once a search runs it glides
// to the right edge and shrinks out of the way. Phones have none.
const EASE = 'ease-[cubic-bezier(.2,.8,.2,1)]'

export function HeroArt({ compact }: { compact: boolean }) {
  if (!useShowArt()) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className={cn(
          'absolute h-[900px] w-[1440px] -translate-x-1/2 -translate-y-1/2 transition-[left,top,scale,opacity] duration-[900ms]',
          EASE,
          compact ? 'top-[52%] left-[88%] scale-30 opacity-30' : 'top-1/2 left-[70%] scale-80 opacity-72',
        )}
      >
        <CareArt kind="pathways" className="size-full" />
      </div>
    </div>
  )
}
