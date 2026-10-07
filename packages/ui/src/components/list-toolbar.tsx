import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { SearchField } from "@workspace/ui/components/search-field"
import { TableToolbar } from "@workspace/ui/components/table"

/** How long typing settles before the search is applied (C174). */
export const SEARCH_DEBOUNCE_MS = 300

/** A filter declared as data (C174): one choice among options, shown as chips. */
export type ListFilter = {
  key: string
  label: string
  type: "select"
  options: { value: string; label: string }[]
  value: string | undefined
  onChange: (value: string | undefined) => void
}

/**
 * A list's toolbar (C174): a search applied 300 ms after typing stops, filters declared as data
 * and shown as chips ("All" plus each option), a summary, and "Clear filters" when anything is on.
 * The values live in the caller's URL state; this component only reports changes.
 */
export function ListToolbar({
  search,
  filters = [],
  onClear,
  summary,
  actions,
  className,
}: {
  search?: { value: string | undefined; onChange: (value: string | undefined) => void; placeholder: string }
  filters?: ListFilter[]
  onClear?: () => void
  summary?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  const on = Boolean(search?.value) || filters.some((f) => f.value !== undefined)
  return (
    <TableToolbar className={cn("gap-2.5", className)}>
      {search && <DebouncedSearch {...search} />}
      {filters.map((f) => (
        <div key={f.key} role="group" aria-label={f.label} className="flex flex-wrap items-center gap-1.5">
          <Chip active={f.value === undefined} onClick={() => f.onChange(undefined)}>
            All
          </Chip>
          {f.options.map((o) => (
            <Chip key={o.value} active={f.value === o.value} onClick={() => f.onChange(o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
      ))}
      <span className="flex-1" />
      {summary && <span className="text-meta whitespace-nowrap text-faint">{summary}</span>}
      {on && onClear && (
        <Button variant="link" size="xs" className="text-meta font-bold no-underline hover:underline" onClick={onClear}>
          Clear filters
        </Button>
      )}
      {actions}
    </TableToolbar>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Badge variant={active ? "filter-active" : "filter"} render={<button type="button" aria-pressed={active} onClick={onClick} />}>
      {children}
    </Badge>
  )
}

/** The search box: local while typing, reported once typing settles; follows outside changes. */
function DebouncedSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
  placeholder: string
}) {
  const [text, setText] = React.useState(value ?? "")
  const reported = React.useRef(value ?? "")
  // The URL changed from outside (back button, Clear filters): show it.
  React.useEffect(() => {
    if ((value ?? "") !== reported.current) {
      reported.current = value ?? ""
      setText(value ?? "")
    }
  }, [value])
  React.useEffect(() => {
    if (text.trim() === reported.current) return
    const t = setTimeout(() => {
      reported.current = text.trim()
      onChange(text.trim() || undefined)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [text, onChange])
  return (
    <SearchField
      size="sm"
      className="h-8 max-w-[300px] min-w-[210px] flex-[1_1_210px]"
      placeholder={placeholder}
      aria-label={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  )
}
