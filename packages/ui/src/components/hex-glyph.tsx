import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * The small solid hexagon glyph (logo mark, app icons, list markers). Drawn the way the design
 * does it: a pointy-top polygon with a thick round-joined stroke, so corners round without a
 * hand-tuned path. Colour with any text-* class; `size` is the rendered width in px.
 */
function HexGlyph({
  size = 26,
  className,
  ...props
}: Omit<React.ComponentProps<"svg">, "width" | "height"> & { size?: number }) {
  return (
    <svg
      data-slot="hex-glyph"
      width={size}
      height={size * 1.1547}
      viewBox="0 0 26 30.02"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
      {...props}
    >
      <polygon
        points="13,3.46 23,9.24 23,20.78 13,26.56 3,20.78 3,9.24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={6}
        strokeLinejoin="round"
      />
    </svg>
  )
}

export { HexGlyph }
