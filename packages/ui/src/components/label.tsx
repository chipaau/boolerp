import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/** Field label: 13px bold ink (the design's Label style). */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-label leading-none text-foreground select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-disabled-foreground peer-disabled:cursor-not-allowed peer-disabled:text-disabled-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Label }
