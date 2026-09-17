import type { ReactNode } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Card } from '@workspace/ui/components/card'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { SearchField } from '@workspace/ui/components/search-field'

// The design's list toolbar: a search pill, filter pills, small selects, then a right-aligned
// "n of m" count and a Clear filters link while any filter is on.

/** List toolbar card: search, pills, selects, count, clear. */
export function FilterToolbar({
  query,
  onQuery,
  placeholder,
  children,
  count,
  filtersOn,
  onClear,
}: {
  query: string
  onQuery: (q: string) => void
  placeholder: string
  children?: ReactNode
  count: string
  filtersOn?: boolean
  onClear?: () => void
}) {
  return (
    <Card className="mb-3.5 flex-row flex-wrap items-center gap-2.5 px-3.5 py-3">
      <SearchField size="sm" className="max-w-[280px] min-w-[200px] flex-[1_1_200px]" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {children}
      <span className="flex-1" />
      <span className="text-meta whitespace-nowrap text-muted-foreground">{count}</span>
      {filtersOn && onClear && <ClearFilters onClick={onClear} />}
    </Card>
  )
}

/** Sage "Clear filters" text button. */
export function ClearFilters({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-meta font-bold whitespace-nowrap text-link hover:underline">
      Clear filters
    </button>
  )
}

/** One filter pill in a single-choice group. */
export function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Badge variant={active ? 'filter-active' : 'filter'} size="sm" render={<button type="button" aria-pressed={active} onClick={onClick} />}>
      {children}
    </Badge>
  )
}

/** Compact select for toolbar filters. */
export function FilterSelect<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string }) {
  return (
    <NativeSelect className="w-auto" aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </NativeSelect>
  )
}
