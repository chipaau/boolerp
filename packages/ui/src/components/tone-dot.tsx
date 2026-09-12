import { cn } from "@workspace/ui/lib/utils"

export type DotTone = "success" | "warning" | "danger" | "plum" | "slate" | "neutral" | "rose" | "risk" | "tan"
const FILL: Record<DotTone, string> = {
  success: "bg-tone-success",
  warning: "bg-tone-warning",
  danger: "bg-tone-danger",
  plum: "bg-tone-plum",
  slate: "bg-tone-slate",
  neutral: "bg-tone-neutral",
  rose: "bg-tone-rose",
  risk: "bg-tone-risk",
  tan: "bg-tone-tan",
}

/**
 * A small marker in one of the status-pill hues: a hexagon (the design's category mark), a round
 * dot, or a rounded square. Used wherever a list keys its rows by colour — calendars, org units.
 */
function ToneDot({ tone, shape = "hex", size = 8, className }: { tone: DotTone; shape?: "hex" | "round" | "square"; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block shrink-0",
        shape === "hex" && "[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]",
        shape === "round" && "rounded-full",
        shape === "square" && "rounded-[2px]",
        FILL[tone],
        className
      )}
      style={{ width: size, height: shape === "hex" ? Math.round(size * 1.15) : size }}
    />
  )
}

export { ToneDot }
