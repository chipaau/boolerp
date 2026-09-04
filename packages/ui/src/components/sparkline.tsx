import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"
import { smoothPath } from "@workspace/ui/lib/charts"

/**
 * A 120 x 34 trend line that draws itself in. Colour it with a text-* class (the stroke is
 * currentColor); it stretches to its container's width.
 */
function Sparkline({
  values,
  className,
  ...props
}: Omit<React.ComponentProps<"svg">, "values"> & { values: number[] }) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const points = values.map(
    (v, i) => [(i * 120) / Math.max(values.length - 1, 1), 31 - ((v - min) / range) * 28] as const
  )
  return (
    <svg
      data-slot="sparkline"
      viewBox="0 0 120 34"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("block h-[34px] w-full overflow-visible", className)}
      {...props}
    >
      <path
        d={smoothPath(points)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="animate-draw [stroke-dasharray:1600]"
      />
    </svg>
  )
}

export { Sparkline }
