import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Fields sit on ivory with no border at rest; the tone change is the affordance. Focus draws a
 * 2px sage ring, invalid draws a rose one. Use `bg-surface-soft` when the field sits directly on
 * the page rather than in a card.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-[42px] w-full min-w-0 rounded-md border-0 bg-field px-3.5 py-1 text-[15px] text-foreground outline-none transition-[box-shadow,background-color] duration-instant ease-hexa selection:bg-primary file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-foreground placeholder:text-faint disabled:pointer-events-none disabled:text-disabled-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring",
        "aria-invalid:ring-2 aria-invalid:ring-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
