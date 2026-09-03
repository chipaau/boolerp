import * as React from "react"
import { Search } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"
import { Kbd } from "@workspace/ui/components/kbd"

/**
 * The pill search: ivory fill, faint glyph and placeholder, optional shortcut hint. `size="sm"`
 * (36px) sits in table toolbars, default (38px) in the topbar. Renders a real input; pass
 * `asButton` when it only opens a command palette.
 */
function SearchField({
  className,
  size = "default",
  shortcut,
  asButton = false,
  placeholder = "Search…",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & {
  size?: "sm" | "default"
  /** Keyboard hint shown on the right, e.g. "⌘K". */
  shortcut?: string
  /** Render as a button (for command palettes) instead of an input. */
  asButton?: boolean
}) {
  const shell = cn(
    "flex w-full items-center gap-2.5 rounded-full bg-muted text-faint transition-[background-color,box-shadow] duration-instant ease-hexa focus-within:ring-2 focus-within:ring-ring hover:bg-secondary-hover/60",
    size === "sm" ? "h-9 px-3.5" : "h-[38px] px-[15px]",
    className
  )
  if (asButton) {
    const { onClick, disabled, ...rest } = props as React.ComponentProps<"button">
    return (
      <button
        type="button"
        data-slot="search-field"
        className={cn(shell, "text-left outline-none focus-visible:ring-2 focus-visible:ring-ring")}
        onClick={onClick}
        disabled={disabled}
        aria-label={typeof placeholder === "string" ? placeholder : undefined}
        {...(rest as Record<string, unknown>)}
      >
        <Search className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="flex-1 truncate text-sm">{placeholder}</span>
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </button>
    )
  }
  return (
    <label data-slot="search-field" className={shell}>
      <Search className="size-4 shrink-0" strokeWidth={1.75} />
      <input
        type="search"
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </label>
  )
}

export { SearchField }
