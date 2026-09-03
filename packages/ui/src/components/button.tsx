import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowRight } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * One button. The primary action is a fully-rounded pill in Sand Light with a Charcoal label and
 * a circle carrying the arrow (`<ButtonArrow />` as the last child). Everything that is not the
 * primary action loses the circle and the fill: secondary (ivory), ghost, outline (inset ring),
 * destructive (soft rose), link (sage underline). There is never more than one arrow button in a view.
 * To render as something else (a router Link), pass `render={<Link … />}`.
 */
const buttonVariants = cva(
  // every button lifts 1px on hover and settles on press: immediate, never bouncy
  "group/btn inline-flex shrink-0 items-center justify-center rounded-full font-bold whitespace-nowrap outline-none transition-[background-color,color,box-shadow,transform] duration-instant ease-hexa hover:-translate-y-px active:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:bg-muted disabled:text-disabled-foreground aria-invalid:ring-2 aria-invalid:ring-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        // the one place amber fills a button: the sign-in / onboarding call to action
        brand:
          "bg-brand-soft text-brand-cta-foreground hover:bg-brand-cta-hover active:translate-y-px",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        // a bare white-71% circle/pill with no fill behind it
        plain: "bg-primary-circle text-primary-circle-foreground hover:bg-card",
        ghost: "bg-transparent text-body hover:bg-accent hover:text-foreground",
        outline:
          "bg-transparent text-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-accent",
        destructive: "bg-destructive-soft text-destructive hover:bg-destructive-soft-hover",
        link: "h-auto rounded-none px-0! font-medium text-link underline decoration-link/40 decoration-1 underline-offset-[3px] hover:translate-y-0 hover:text-link-hover hover:decoration-link",
      },
      size: {
        // circle diameter is always height minus 10 (a 5px inset all round); see ButtonArrow
        xs: "h-6 gap-1.5 px-2.5 text-xs has-[>[data-slot=button-arrow]]:pr-0.5",
        sm: "h-8 gap-2.5 px-3.5 text-[13px] has-[>[data-slot=button-arrow]]:pr-1",
        default: "h-[38px] gap-3.5 px-[18px] text-sm has-[>[data-slot=button-arrow]]:pr-[5px]",
        lg: "h-[46px] gap-4 px-[22px] text-[15px] has-[>[data-slot=button-arrow]]:pr-1.5",
        xl: "h-14 gap-4 px-[26px] text-[15.5px] has-[>[data-slot=button-arrow]]:pr-2.5",
        icon: "size-[38px] p-[5px]",
        "icon-xs": "size-6 p-0.5 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 p-1",
        "icon-lg": "size-[46px] p-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      render={render}
      // a rendered Link/anchor is not a native button; keep the a11y wiring honest
      nativeButton={nativeButton ?? !render}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

/**
 * The circle at the end of a primary button. Translucent white at rest, Graphite on hover; the
 * icon itself never moves. Sized from the parent button's `data-size`. Pass a different icon as
 * children (e.g. a plus) for create actions.
 */
function ButtonArrow({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="button-arrow"
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary-circle text-primary-circle-foreground transition-[background-color,color] duration-instant ease-hexa group-hover/btn:bg-primary-circle-hover group-hover/btn:text-primary-circle-hover-foreground",
        "size-7 [&>svg]:size-3.5",
        "group-data-[size=xs]/btn:size-4 group-data-[size=xs]/btn:[&>svg]:size-2.5",
        "group-data-[size=sm]/btn:size-6 group-data-[size=icon-sm]/btn:size-6 group-data-[size=sm]/btn:[&>svg]:size-3 group-data-[size=icon-sm]/btn:[&>svg]:size-3",
        "group-data-[size=lg]/btn:size-[34px] group-data-[size=icon-lg]/btn:size-[34px] group-data-[size=lg]/btn:[&>svg]:size-4 group-data-[size=icon-lg]/btn:[&>svg]:size-4",
        "group-data-[size=xl]/btn:size-9 group-data-[size=xl]/btn:[&>svg]:size-4",
        // on the amber CTA the circle is warm white and stays put
        "group-data-[variant=brand]/btn:bg-brand-cta-circle group-data-[variant=brand]/btn:text-brand-cta-hover group-data-[variant=brand]/btn:group-hover/btn:bg-brand-cta-circle group-data-[variant=brand]/btn:group-hover/btn:text-brand-cta-hover",
        className
      )}
      {...props}
    >
      {children ?? <ArrowRight strokeWidth={2} />}
    </span>
  )
}

export { Button, ButtonArrow, buttonVariants }
