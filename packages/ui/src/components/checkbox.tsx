"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon, MinusIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/** 19px box, 5px radius: Sand when off, amber with a cream check (or dash) when on. */
function Checkbox({ className, indicatorClassName, ...props }: CheckboxPrimitive.Root.Props & { indicatorClassName?: string }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer grid size-[19px] shrink-0 place-items-center rounded-[5px] bg-border transition-colors duration-instant ease-hexa outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-brand-soft data-indeterminate:bg-brand-soft aria-invalid:ring-2 aria-invalid:ring-destructive",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className={cn(
          "grid place-items-center text-brand-foreground [&>svg]:size-3 data-indeterminate:[&>svg:first-child]:hidden not-data-indeterminate:[&>svg:last-child]:hidden",
          indicatorClassName
        )}
      >
        <CheckIcon strokeWidth={3} />
        <MinusIcon strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
