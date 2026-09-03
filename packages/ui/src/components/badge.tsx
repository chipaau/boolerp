import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Status pills and category tags. Status pills carry meaning through the categorical hues
 * (amber only on warnings); category tags stay neutral so a dense table does not turn into a
 * rainbow. `size="sm"` is the 12px pill used inside tables; pass `dot` to prefix the strong hue.
 * Render as a button or link with `render={<button … />}`.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-[7px] overflow-hidden border-0 font-bold whitespace-nowrap transition-[color,background-color] duration-instant ease-hexa focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        // filled: only Admin-style badges get a solid fill
        default: "rounded-sm bg-sage text-sage-foreground",
        // category chips (square-ish) and toolbar filter pills (round; `filter-active` = sage)
        secondary: "rounded-[7px] bg-muted text-body",
        filter: "rounded-full bg-muted text-body [a&]:hover:bg-secondary-hover [button&]:hover:bg-secondary-hover",
        "filter-active": "rounded-full bg-sage-soft text-sage-soft-foreground",
        outline: "rounded-full text-foreground shadow-[inset_0_0_0_1px_var(--input)]",
        // status pills
        success: "rounded-full bg-tone-success-soft text-tone-success-foreground",
        warning: "rounded-full bg-tone-warning-soft text-tone-warning-foreground",
        danger: "rounded-full bg-tone-danger-soft text-tone-danger-foreground",
        plum: "rounded-full bg-tone-plum-soft text-tone-plum-foreground",
        slate: "rounded-full bg-tone-slate-soft text-tone-slate-foreground",
        neutral: "rounded-full bg-tone-neutral-soft text-tone-neutral-foreground",
        rose: "rounded-full bg-tone-rose-soft text-tone-rose-foreground",
        risk: "rounded-full bg-tone-risk-soft text-tone-risk-foreground",
      },
      size: {
        default: "px-[13px] py-[5px] text-[13px] leading-[1.4]",
        sm: "px-[11px] py-1 text-xs leading-[1.35]",
      },
    },
    compoundVariants: [
      { variant: "default", size: "default", class: "px-[11px] py-1 text-xs" },
      { variant: "secondary", size: "default", class: "py-1.5" },
      { variant: "filter", size: "default", class: "py-[7px]" },
      { variant: "filter-active", size: "default", class: "py-[7px]" },
    ],
    defaultVariants: { variant: "neutral", size: "default" },
  }
)

type Variant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>
const dotColor: Partial<Record<Variant, string>> = {
  success: "bg-tone-success",
  warning: "bg-tone-warning",
  danger: "bg-tone-danger",
  plum: "bg-tone-plum",
  slate: "bg-tone-slate",
  neutral: "bg-tone-neutral",
  rose: "bg-tone-rose",
  risk: "bg-tone-risk",
}

function Badge({
  className,
  variant = "neutral",
  size = "default",
  dot = false,
  render,
  children,
  ...props
}: useRender.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  const dotClass = dot && variant ? dotColor[variant] : undefined
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size }), className),
        children: (
          <>
            {dotClass && <span aria-hidden="true" className={cn("size-1.5 rounded-full", dotClass)} />}
            {children}
          </>
        ),
      },
      props
    ),
    render,
    state: { slot: "badge", variant },
  })
}

export { Badge, badgeVariants }
