import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

/**
 * The brand hexagon, taken verbatim from the design export (a pointy-top hexagon with softly
 * rounded corners in a 23.38 x 24.20 box). Every hex in the product (tiles, heat map, decor)
 * draws this one path so the silhouette is identical everywhere.
 */
const W = 23.3827
const H = 24.1963
export const HEX_ASPECT = W / H // width / height ≈ 0.966
export const HEX_VIEWBOX = `0 0 ${W} ${H}`
export const HEX_PATH =
  "M10.2771 0.354226C11.1608 -0.118195 12.222 -0.118194 13.1057 0.354227L21.7971 5.00048C22.7732 5.52232 23.3827 6.53927 23.3827 7.64616V16.5501C23.3827 17.657 22.7732 18.674 21.7971 19.1958L13.1057 23.8421C12.222 24.3145 11.1608 24.3145 10.2771 23.8421L1.58572 19.1958C0.609563 18.674 6.29425e-05 17.657 6.29425e-05 16.5501V7.64616C6.29425e-05 6.53927 0.609565 5.52232 1.58572 5.00048L10.2771 0.354226Z"

const hexagonVariants = cva(
  "group/hex relative inline-grid shrink-0 place-items-center select-none [&>svg:first-child]:absolute [&>svg:first-child]:inset-0 [&>svg:first-child]:size-full [&>svg:first-child]:overflow-visible [&>svg:first-child>path]:transition-[fill,stroke] [&>svg:first-child>path]:duration-quick [&>svg:first-child>path]:ease-hexa",
  {
    variants: {
      // fill lives on the SVG via currentColor, so a single text-* class recolours the tile
      tone: {
        surface: "text-surface-soft",
        primary: "text-primary",
        soft: "text-primary/25",
        muted: "text-muted",
        ghost: "text-transparent",
      },
      interactive: {
        true: "cursor-pointer transition-transform duration-instant ease-hexa hover:-translate-y-[3px] hover:[&>svg:first-child]:drop-shadow-hex-hover active:translate-y-0 focus-visible:outline-none focus-visible:[&>svg:first-child>path]:[stroke:var(--ring)] focus-visible:[&>svg:first-child>path]:[stroke-width:1.5px]",
        false: "",
      },
    },
    defaultVariants: { tone: "surface", interactive: false },
  }
)

/** Gradient vector for an angle in degrees (0 = left→right, 90 = top→bottom), like CSS. */
function gradientVector(deg: number) {
  const a = ((deg - 90) * Math.PI) / 180
  const dx = Math.cos(a) / 2
  const dy = Math.sin(a) / 2
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy }
}

type HexagonProps = React.ComponentProps<"div"> &
  VariantProps<typeof hexagonVariants> & {
    /** Height of the hexagon (CSS length or px number); width follows `aspect`. */
    size?: string | number
    /** width / height. Defaults to the brand shape; the heat map uses a slightly wider 26:25. */
    aspect?: number
    /** Two-colour gradient fill. Overrides the currentColor fill. */
    gradient?: readonly [string, string]
    /** Gradient direction in degrees, CSS convention (180 = top→bottom, the default). */
    gradientAngle?: number
    /** Gradient fill applied while hovered (or focused) instead of the resting fill. */
    hoverGradient?: readonly [string, string]
    /** Outline colour applied while hovered (or focused). */
    hoverStroke?: string
    /** Optional outline colour drawn on the shape, e.g. "var(--marker-outline)". */
    stroke?: string
    /** Outline width in CSS px (non-scaling). */
    strokeWidth?: number
  }

/**
 * A rounded hexagon tile with centred content. Colour it with `tone` (or any text-* class) or a
 * `gradient`; size it with `size`. Renders a plain div; pass role/tabIndex/onClick to make it
 * interactive, or wrap it in a Link/button.
 */
function Hexagon({
  className,
  tone,
  interactive,
  size = "6rem",
  aspect = HEX_ASPECT,
  gradient,
  gradientAngle = 180,
  hoverGradient,
  hoverStroke,
  stroke,
  strokeWidth = 1.3,
  style,
  children,
  ...props
}: HexagonProps) {
  const id = React.useId()
  const gradientId = `${id}g`
  const hoverId = `${id}h`
  const height = typeof size === "number" ? `${size}px` : size
  const v = gradientVector(gradientAngle)
  const hasHover = Boolean(hoverGradient || hoverStroke)
  return (
    <div
      data-slot="hexagon"
      className={cn(
        hexagonVariants({ tone, interactive }),
        // hover/focus swap the fill and outline through CSS variables set below
        hasHover &&
          "[&:hover>svg:first-child>path]:[fill:var(--hex-hover-fill)] [&:hover>svg:first-child>path]:[stroke:var(--hex-hover-stroke)] [&:hover>svg:first-child>path]:[stroke-width:var(--hex-hover-stroke-width)] [.group:focus-visible>&>svg:first-child>path]:[fill:var(--hex-hover-fill)] [.group:hover>&>svg:first-child>path]:[fill:var(--hex-hover-fill)] [.group:hover>&>svg:first-child>path]:[stroke:var(--hex-hover-stroke)] [.group:hover>&>svg:first-child>path]:[stroke-width:var(--hex-hover-stroke-width)]",
        className
      )}
      style={
        {
          height,
          aspectRatio: `${aspect}`,
          "--hex-hover-fill": hoverGradient ? `url(#${hoverId})` : "currentColor",
          "--hex-hover-stroke": hoverStroke ?? stroke ?? "none",
          "--hex-hover-stroke-width": `${hoverStroke ? strokeWidth : stroke ? strokeWidth : 0}px`,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      <svg
        viewBox={HEX_VIEWBOX}
        preserveAspectRatio={aspect === HEX_ASPECT ? undefined : "none"}
        aria-hidden="true"
        focusable="false"
      >
        {(gradient || hoverGradient) && (
          <defs>
            {gradient && (
              <linearGradient id={gradientId} x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}>
                <stop offset="0" stopColor={gradient[0]} />
                <stop offset="1" stopColor={gradient[1]} />
              </linearGradient>
            )}
            {hoverGradient && (
              <linearGradient id={hoverId} x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}>
                <stop offset="0" stopColor={hoverGradient[0]} />
                <stop offset="1" stopColor={hoverGradient[1]} />
              </linearGradient>
            )}
          </defs>
        )}
        <path
          d={HEX_PATH}
          fill={gradient ? `url(#${gradientId})` : "currentColor"}
          stroke={stroke}
          strokeWidth={stroke ? strokeWidth : 0}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div data-slot="hexagon-content" className="relative z-10 grid place-items-center">
        {children}
      </div>
    </div>
  )
}

export { Hexagon, hexagonVariants }
