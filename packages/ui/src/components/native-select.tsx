import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * The browser's own <select>, dressed as one of our filled fields: Soft Cream plate, bold value,
 * a small chevron. For short, fixed option lists (times, recurrences) where a native menu is the
 * right tool; use Popover-built pickers when the options need structure.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span data-slot="native-select" className={cn("relative block", className)}>
      <select
        className="h-[34px] w-full appearance-none rounded-[9px] bg-surface-band pr-8 pl-[11px] text-sm font-bold tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-faint" />
    </span>
  )
}

export { NativeSelect }
