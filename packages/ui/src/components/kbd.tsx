import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/** Keyboard-shortcut hint (e.g. ⌘K) as used inside the search field and menus. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded-[5px] bg-card px-[7px] font-sans text-micro font-bold text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
