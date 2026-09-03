import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

/**
 * KPI tile: overline label, a large figure, and a footer row (delta, hint, sparkline). Whole tile
 * is a click target when rendered as a link (`render={<Link … />}`); `inverted` is the one dark
 * tile a row may carry for its headline total. Consumers add `animate-rise` + a delay to stagger.
 */
const statCardVariants = cva(
  "block rounded-lg p-6 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "lift bg-card text-foreground",
        inverted: "bg-surface-inverted text-surface-inverted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function StatCard({
  label,
  value,
  valueClassName,
  className,
  variant = "default",
  render,
  children,
  ...props
}: useRender.ComponentProps<"div"> &
  VariantProps<typeof statCardVariants> & {
    label: React.ReactNode
    value: React.ReactNode
    valueClassName?: string
  }) {
  const inverted = variant === "inverted"
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(statCardVariants({ variant }), className),
        children: (
          <>
            <div
              className={cn(
                "text-[11.5px] font-bold tracking-[0.1em] uppercase",
                inverted ? "text-surface-inverted-foreground/65" : "text-muted-foreground"
              )}
            >
              {label}
            </div>
            <div className={cn("mt-2 text-[34px] leading-[1.1] font-bold", valueClassName)}>{value}</div>
            {children && <div className="mt-[7px] flex flex-wrap items-center gap-[7px]">{children}</div>}
          </>
        ),
      },
      props
    ),
    render,
    state: { slot: "stat-card", variant },
  })
}

/** A KPI delta: sage when up, terracotta when down. */
function StatDelta({ up = true, className, ...props }: React.ComponentProps<"span"> & { up?: boolean }) {
  return (
    <span
      data-slot="stat-delta"
      className={cn("text-caption font-bold", up ? "text-link" : "text-tone-risk-foreground", className)}
      {...props}
    />
  )
}

export { StatCard, StatDelta, statCardVariants }
