import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"
import { HEX_ASPECT } from "@workspace/ui/components/hexagon"

/** Position on a pointy-top hex grid: odd rows are shifted right by half a cell. */
export type HexCell = { col: number; row: number }

type HoneycombProps = React.ComponentProps<"div"> & {
  /** Height of one hexagon (CSS length). Width is derived from `aspect`. */
  cellSize: string
  /** width / height of a cell; defaults to the brand hexagon. */
  aspect?: number
  /** Columns the grid must fit (sizes the container). */
  cols: number
  /** Rows the grid must fit (sizes the container). */
  rows: number
  /** Horizontal gap between hexes as a fraction of cell width (0 = touching). */
  gap?: number
  /**
   * Vertical distance between row tops as a fraction of cell height. 0.75 interlocks rows like a
   * true honeycomb (app tiles); 1 stacks rows with only the gap between them (heat map).
   */
  rowPitch?: number
}

/**
 * Lays children out on a honeycomb. Each child is a `<HoneycombItem col row>`; the container
 * sizes itself from cols/rows so the layout is stable regardless of content. Used by the month
 * heat map and the apps grid.
 */
function Honeycomb({
  cellSize,
  aspect = HEX_ASPECT,
  cols,
  rows,
  gap = 0.06,
  rowPitch = 0.75,
  className,
  style,
  children,
  ...props
}: HoneycombProps) {
  const vars = {
    "--hc-h": cellSize,
    "--hc-w": `calc(${cellSize} * ${aspect})`,
    "--hc-gap": `calc(var(--hc-w) * ${gap})`,
    "--hc-x": "calc(var(--hc-w) + var(--hc-gap))", // column pitch
    "--hc-y": `calc(var(--hc-h) * ${rowPitch} + var(--hc-gap))`, // row pitch
    width: `calc(var(--hc-x) * ${cols} + var(--hc-w) / 2)`,
    height: `calc(var(--hc-y) * ${rows - 1} + var(--hc-h))`,
  } as React.CSSProperties
  return (
    <div
      data-slot="honeycomb"
      className={cn("relative", className)}
      style={{ ...vars, ...style }}
      {...props}
    >
      {children}
    </div>
  )
}

function HoneycombItem({
  col,
  row,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & HexCell) {
  return (
    <div
      data-slot="honeycomb-item"
      className={cn("absolute", className)}
      style={{
        left: `calc(var(--hc-x) * ${col + (row % 2 ? 0.5 : 0)})`,
        top: `calc(var(--hc-y) * ${row})`,
        width: "var(--hc-w)",
        height: "var(--hc-h)",
        ...style,
      }}
      {...props}
    />
  )
}

export { Honeycomb, HoneycombItem }
