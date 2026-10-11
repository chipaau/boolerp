import type { ReactNode } from 'react'
import { cn } from '@workspace/ui/lib/utils'

/**
 * A page's content column, the same on every screen: max 1240px, the design's fluid side padding
 * (16px on phones to 28px), 22px between sections, one top gap under the header, and room above the
 * mobile tab bar. Screens don't override these, so spacing stays consistent.
 */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn('page flex flex-col gap-[22px] pt-5 pb-28 min-[760px]:pt-7 min-[760px]:pb-16', className)}>{children}</main>
}

/** The two soft glows behind every page: lilac top-left, rose right. */
export function Glows() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-[18vh] -left-[12vw] size-[62vw] max-w-[820px] rounded-full [background:var(--glow-lilac)]" />
      <div className="absolute top-[22vh] -right-[16vw] size-[56vw] max-w-[760px] rounded-full [background:var(--glow-rose)]" />
    </div>
  )
}
