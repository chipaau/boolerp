import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Field label: 13px bold ink (the design's Label style). `required` marks a field the form cannot
 * be sent without with a red asterisk (*) after the text; the asterisk is drawn by CSS, so it is
 * not part of the label's text, and the control itself carries `required` or `aria-required`.
 */
function Label({ className, required, ...props }: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label
      data-slot="label"
      data-required={required || undefined}
      className={cn(
        "flex items-center gap-2 text-label leading-none text-foreground select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-disabled-foreground peer-disabled:cursor-not-allowed peer-disabled:text-disabled-foreground",
        required && "after:-ml-1.5 after:text-destructive after:content-['*']",
        className
      )}
      {...props}
    />
  )
}

export { Label }
