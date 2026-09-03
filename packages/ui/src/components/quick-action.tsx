import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * A shortcut tile: icon plate + label on the inset tone. On hover the plate fills amber and the
 * glyph turns cream. Renders a button; pass `onClick` or wrap in a link.
 */
function QuickAction({
  icon,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { icon: React.ReactNode }) {
  return (
    <button
      type="button"
      data-slot="quick-action"
      className={cn(
        "group flex items-center gap-[11px] rounded-[10px] bg-muted px-3.5 py-[13px] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      <span className="grid size-[34px] shrink-0 place-items-center rounded-[11px] bg-surface-soft text-brand-soft shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--faint)_16%,transparent)] transition-[background-color,color,box-shadow] duration-[150ms] ease-hexa group-hover:bg-brand-soft group-hover:text-card group-hover:shadow-none [&>svg]:size-[18px] [&>svg]:transition-colors [&>svg]:duration-[150ms]">
        {icon}
      </span>
      <span className="text-ui-sm font-bold text-foreground">{children}</span>
    </button>
  )
}

export { QuickAction }
