"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@workspace/ui/lib/utils"

/** 38 x 22 pill: sage when on, Sand when off, a cream 16px knob. */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-instant ease-hexa outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-disabled:opacity-50 data-checked:bg-sage data-unchecked:bg-border",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-full bg-card shadow-[0_1px_3px_rgba(0,0,0,0.22)] transition-transform duration-instant ease-hexa data-checked:translate-x-4 data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
