'use client'

import { cn } from '@workspace/ui/lib/utils'
import { CareArt } from '@/components/care-art/care-art'

// The care diagram behind Find care's search card, as the prototype places it: a 1440×900 drawing
// centred on a point, scaled. At rest it sits large and to the right; once a search runs it glides
// to the right edge and shrinks out of the way. On phones it stays centred and faint.
const EASE = 'ease-[cubic-bezier(.2,.8,.2,1)]'

export function HeroArt({ compact }: { compact: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className={cn(
          'absolute h-[900px] w-[1440px] -translate-x-1/2 -translate-y-1/2 transition-[left,top,scale,opacity] duration-[900ms]',
          EASE,
          'left-1/2 opacity-30',
          compact ? 'top-[40%] scale-30' : 'top-1/2 scale-55',
          compact ? 'min-[760px]:top-[52%] min-[760px]:left-[88%] min-[760px]:scale-30 min-[760px]:opacity-30' : 'min-[760px]:left-[70%] min-[760px]:scale-80 min-[760px]:opacity-72',
        )}
      >
        <CareArt kind="pathways" intro className="size-full" />
      </div>
    </div>
  )
}
