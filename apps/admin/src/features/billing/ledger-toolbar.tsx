import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { SelectField } from '@workspace/ui/components/select'
import { cn } from '@workspace/ui/lib/utils'
import { orderByHierarchy } from '@/features/tenants/logic'
import { useTenantDirectory } from '@/features/tenants/queries'
import type { DirectoryTenant } from '@/features/tenants/types'
import { BILLING_STATUS_FILTERS } from './ledger-bits'
import type { BillingStatusFilter } from './ledger-bits'
import { useBillingOptions, useInvoices } from './queries'

type Props = {
  q: string
  onQ: (q: string) => void
  picked: DirectoryTenant | undefined
  rollUp: boolean
  hasKids: boolean
  onPick: (slug: string | null) => void
  status: BillingStatusFilter
  onStatus: (s: BillingStatusFilter) => void
  period: string
  onPeriod: (p: string) => void
  count: string
  filtersOn: boolean
  onClear: () => void
}

/** One search that also suggests tenants to scope by, status pills, period, count and clear. */
export function LedgerToolbar({ q, onQ, picked, rollUp, hasKids, onPick, status, onStatus, period, onPeriod, count, filtersOn, onClear }: Props) {
  const { tenants } = useTenantDirectory()
  const invoices = useInvoices()
  const { periods } = useBillingOptions()
  const [menu, setMenu] = useState(false)

  const needle = q.trim().toLowerCase()
  const picks = orderByHierarchy(tenants).filter(({ tenant: t }) => !needle || `${t.name} ${t.abbr} ${t.regNo}`.toLowerCase().includes(needle))
  const showMenu = menu && Boolean(needle)

  return (
    <Card className="mb-3.5 flex-row flex-wrap items-center gap-2.5 px-3.5 py-3">
      <div className="relative max-w-[420px] min-w-0 flex-[1_1_300px]">
        <div className="flex h-9 items-center gap-2 rounded-full bg-muted pr-1.5 pl-3 focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
          {picked && (
            <Badge variant="filter-active" size="sm" className="gap-1.5 pr-1">
              {picked.abbr}
              {rollUp && hasKids ? ' + children' : ''}
              <button type="button" aria-label="Clear tenant" className="grid size-4 place-items-center rounded-full hover:bg-card/60" onClick={() => onPick(null)}>
                <X className="size-3" />
              </button>
            </Badge>
          )}
          <input
            type="search"
            value={q}
            aria-label="Search billing"
            placeholder={picked ? `Filter within ${picked.abbr}` : 'Search invoices, credits or a tenant name'}
            className="min-w-[60px] flex-1 bg-transparent text-ui-sm text-foreground outline-none placeholder:text-placeholder [&::-webkit-search-cancel-button]:hidden"
            onChange={(e) => { onQ(e.target.value); setMenu(Boolean(e.target.value.trim())) }}
            onFocus={() => setMenu(true)}
            onBlur={() => setTimeout(() => setMenu(false), 120)}
            onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}
          />
          {(q || picked) && (
            <button type="button" aria-label="Clear search" className="px-1.5 text-muted-foreground hover:text-foreground" onClick={() => { onQ(''); onPick(null) }}>
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {showMenu && (
          <div className="absolute top-10 left-0 z-60 max-h-[290px] w-[340px] max-w-[80vw] animate-rise overflow-y-auto rounded-lg bg-popover p-[7px] shadow-floating">
            {picks.length ? (
              <>
                <div className="px-[11px] pt-1.5 pb-2 text-overline text-muted-foreground">Scope to a tenant</div>
                {picks.map(({ tenant: t, isChild }) => {
                  const n = invoices.filter((i) => i.tenantSlug === t.slug).length
                  const kids = tenants.filter((x) => x.parentSlug === t.slug).length
                  return (
                    <button
                      key={t.slug}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { onPick(t.slug); setMenu(false) }}
                      className={cn('flex w-full items-center gap-2.5 rounded-md px-[11px] py-[9px] text-left hover:bg-surface-soft', picked?.slug === t.slug && 'bg-sage-soft')}
                    >
                      {isChild && <span aria-hidden="true" className="h-px w-3.5 shrink-0 bg-border" />}
                      <div className="min-w-0">
                        <div className="truncate text-compact font-bold text-foreground">{t.name}</div>
                        <div className="mt-0.5 text-meta text-muted-foreground">
                          {t.abbr} · {n} invoice{n === 1 ? '' : 's'}
                          {kids ? ` · ${kids} child tenant${kids > 1 ? 's' : ''}` : ''}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </>
            ) : (
              <div className="p-3 text-caption text-muted-foreground">No tenant matches — searching invoices and credits instead.</div>
            )}
          </div>
        )}
      </div>

      {BILLING_STATUS_FILTERS.map((s) => (
        <Badge key={s} variant={status === s ? 'filter-active' : 'filter'} render={<button type="button" aria-pressed={status === s} onClick={() => onStatus(s)} />}>
          {s}
        </Badge>
      ))}

      <SelectField aria-label="Period" value={period} onValueChange={onPeriod} className="w-[136px]" options={['Any period', ...periods]} />

      <span className="flex-1" />
      <span className="text-caption whitespace-nowrap text-muted-foreground">{count}</span>
      {filtersOn && (
        <Button variant="link" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </Card>
  )
}
