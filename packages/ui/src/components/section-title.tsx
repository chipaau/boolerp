import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Section heading (Heading 3) with the short amber dash before the text, plus an optional
 * trailing action (a "View all" link, a button).
 */
function SectionTitle({
  className,
  children,
  action,
  as: Comp = "h2",
  ...props
}: React.ComponentProps<"div"> & {
  action?: React.ReactNode
  as?: "h1" | "h2" | "h3"
}) {
  return (
    <div
      data-slot="section-title"
      className={cn("flex items-center justify-between gap-4", className)}
      {...props}
    >
      <Comp className="flex items-center gap-2.5 text-[18px] leading-[1.3] font-bold text-foreground">
        <span aria-hidden="true" className="inline-block h-1 w-2 rounded-full bg-brand" />
        {children}
      </Comp>
      {action}
    </div>
  )
}

export { SectionTitle }
