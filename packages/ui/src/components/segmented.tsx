import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * A pill group on the inset tone with one raised, sand-filled active segment (Today · ‹ · ›,
 * Day / Week, Going / Maybe / Can't make it). Items are buttons; pass `active` to the current one.
 */
function Segmented({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="segmented"
      className={cn("inline-flex items-center gap-0.5 rounded-full bg-muted p-[3px]", className)}
      {...props}
    />
  )
}

function SegmentedItem({
  active = false,
  className,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-slot="segmented-item"
      data-active={active || undefined}
      className={cn(
        "inline-flex h-[30px] items-center justify-center gap-1.5 rounded-full px-3.5 text-compact whitespace-nowrap outline-none transition-[background-color,color] duration-instant ease-hexa focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-primary font-bold text-primary-foreground shadow-[0_1px_3px_rgba(64,44,20,0.10)]" : "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Segmented, SegmentedItem }
