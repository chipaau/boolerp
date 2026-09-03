import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { ArrowRight } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * The round "go there" arrow: a white-71% circle with a dark arrow that turns Graphite with a
 * white arrow (rotated toward the top-right) on hover. Used beside the heat-map month, inside
 * the day card, and after "Browse all apps", so one component keeps them identical.
 *
 * `ArrowCircle` is the visual alone, for embedding in another control that owns the hover
 * (`group`); `ArrowButton` is the standalone button (or a link via `render={<Link … />}`).
 */
const circleClasses = {
  base: "grid shrink-0 place-items-center rounded-full bg-primary-circle text-foreground transition-[background-color,color] duration-instant ease-hexa [&>svg]:transition-transform [&>svg]:duration-instant [&>svg]:ease-hexa",
  hover: "group-hover:bg-primary-circle-hover group-hover:text-primary-circle-hover-foreground group-hover:[&>svg]:-rotate-45 group-focus-visible:bg-primary-circle-hover group-focus-visible:text-primary-circle-hover-foreground",
  default: "size-8 [&>svg]:size-3.5",
  small: "size-7 [&>svg]:size-3",
}

function ArrowCircle({
  small = false,
  className,
  ...props
}: React.ComponentProps<"span"> & { small?: boolean }) {
  return (
    <span
      data-slot="arrow-circle"
      aria-hidden="true"
      className={cn(circleClasses.base, circleClasses.hover, small ? circleClasses.small : circleClasses.default, className)}
      {...props}
    >
      <ArrowRight strokeWidth={2} />
    </span>
  )
}

function ArrowButton({
  small = false,
  className,
  render,
  ...props
}: useRender.ComponentProps<"button"> & { small?: boolean }) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: render ? undefined : "button",
        className: cn(
          "group inline-flex shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
          className
        ),
        children: <ArrowCircle small={small} />,
      },
      props
    ),
    render,
    state: { slot: "arrow-button" },
  })
}

export { ArrowButton, ArrowCircle }
