import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import { cn } from "@workspace/ui/lib/utils"

/**
 * One row of a card list: a leading plate/avatar, a heading line (with an optional `aside` at its
 * right edge), a meta line beneath, and trailing actions. Rows divide with the hairline and the
 * last one drops it. `interactive` adds the soft hover fill. Renders an `li`; override with `render`.
 */
function ListRow({
  leading,
  heading,
  aside,
  meta,
  trailing,
  interactive = false,
  className,
  render,
  ...props
}: useRender.ComponentProps<"li"> & {
  leading?: React.ReactNode
  /** The main line (named `heading` so it never collides with the HTML `title` tooltip). */
  heading: React.ReactNode
  aside?: React.ReactNode
  meta?: React.ReactNode
  trailing?: React.ReactNode
  interactive?: boolean
}) {
  return useRender({
    defaultTagName: "li",
    props: mergeProps<"li">(
      {
        className: cn(
          "flex items-center gap-[13px] border-b border-divider px-6 py-[15px] last:border-b-0",
          interactive && "group cursor-pointer transition-colors duration-instant ease-hexa hover:bg-surface-soft",
          className
        ),
        children: (
          <>
            {leading}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2.5">
                {heading}
                {aside}
              </div>
              {meta && <div className="mt-[3px] truncate text-caption text-muted-foreground">{meta}</div>}
            </div>
            {trailing}
          </>
        ),
      },
      props
    ),
    render,
    state: { slot: "list-row" },
  })
}

export { ListRow }
