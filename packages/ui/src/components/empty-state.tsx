import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"
import { HexGlyph } from "@workspace/ui/components/hex-glyph"

/**
 * Empty states are the one place inside an app where the honeycomb gets to be decorative:
 * five soft cells (one sage), a bold title, a quiet line of copy, and at most one action.
 */
function EmptyState({
  title,
  description,
  action,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn("flex flex-col items-center justify-center px-7 py-10 text-center", className)}
      {...props}
    >
      <div aria-hidden="true" className="mb-[22px] flex flex-col items-center">
        <div className="flex gap-1">
          <HexGlyph size={30} className="text-muted" />
          <HexGlyph size={30} className="text-sage-soft" />
        </div>
        <div className="-mt-[11px] flex gap-1">
          <HexGlyph size={30} className="text-muted" />
          <HexGlyph size={30} className="text-muted" />
          <HexGlyph size={30} className="text-muted" />
        </div>
      </div>
      <div className="text-title text-foreground">{title}</div>
      {description && (
        <div className="mt-2 max-w-[280px] text-sm leading-[1.6] text-muted-foreground">{description}</div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export { EmptyState }
