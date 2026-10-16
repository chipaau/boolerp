import { Fragment, useMemo, useState } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import type { BadgeTone } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workspace/ui/components/table'
import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { PageTitle } from '@/components/layout/page'
import { FilterPill, FilterSelect, FilterToolbar } from '@/components/filter-toolbar'
import { useNavigate } from '@tanstack/react-router'
import { useCountries, useGeographies, useGeographyActions, useGeographySummary } from './queries'
import type { GeographiesTab } from './schemas'
import type { GeographyStatus, GuardedResult } from './types'
import { AddGeographyModal } from './geography-modals'

const GEO_TONE: Record<GeographyStatus, BadgeTone> = { Active: 'success', Inactive: 'warning', Draft: 'neutral' }
const GEO_STATUSES = ['All', 'Active', 'Inactive', 'Draft'] as const
const TYPE_FILTERS = ['Any type', 'Atoll', 'State', 'City', 'Island'] as const

const matches = (text: string, q: string) => !q.trim() || text.toLowerCase().includes(q.trim().toLowerCase())
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Where each tab lives: the tab is the path, so it can be linked to and survives a reload (C218). */
const TAB_PATHS = { geographies: '/geographies/geographies', countries: '/geographies/countries' } as const

/**
 * The geographies screen's title and tabs, which each tab's page renders above its own list: the
 * tab is the path (C218), and each list keeps its own search in the URL (C174).
 */
export function GeographiesHeader({ tab, meta, actions }: { tab: GeographiesTab; meta: string; actions?: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <>
      <PageTitle overline="Admin" title="Geographies" meta={meta} actions={actions} className="mb-[18px]" />
      <Tabs value={tab} onValueChange={(v) => void navigate({ to: TAB_PATHS[v as GeographiesTab] })} className="mb-4 gap-0">
        <TabsList>
          <TabsTrigger value="geographies">Geographies</TabsTrigger>
          <TabsTrigger value="countries">Countries</TabsTrigger>
        </TabsList>
      </Tabs>
    </>
  )
}

/** The geographies tab: shared places (atolls, islands, cities), still the design prototype's fixtures. */
export function GeographiesPlacesPage() {
  const summary = useGeographySummary()
  const [adding, setAdding] = useState(false)
  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-4 sm:px-8 pt-7 pb-24">
        <GeographiesHeader
          tab="geographies"
          meta={`${summary.total} geographies across ${summary.activeCountries} active countries · ${summary.unused} ${summary.unused === 1 ? 'is not used by any tenant' : 'not used by any tenant'}`}
          actions={<Button onClick={() => setAdding(true)}>Add a geography</Button>}
        />
        <PlacesTable />
      </div>
      <AddGeographyModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

/** Toasts a guarded result: the refusal reason, or the success line with Undo. */
function useGuardedToast() {
  const toast = useToast()
  return (result: GuardedResult, success: string) => {
    if (result.ok) toast(success, { undo: result.undo })
    else toast(result.reason, { ok: false })
  }
}

function PlacesTable() {
  const countries = useCountries()
  const places = useGeographies()
  const { setGeographyStatus } = useGeographyActions()
  const report = useGuardedToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<(typeof GEO_STATUSES)[number]>('All')
  const [country, setCountry] = useState('Any country')
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]>('Any type')

  const groups = useMemo(
    () =>
      countries
        .filter((c) => country === 'Any country' || c.name === country)
        .map((c) => ({
          country: c.name,
          rows: places.filter(
            (g) =>
              g.country === c.name &&
              matches(`${g.name} ${g.type} ${g.parent}`, q) &&
              (type === 'Any type' || g.type === type) &&
              (status === 'All' || g.status === status)
          ),
        }))
        .filter((g) => g.rows.length),
    [countries, places, country, q, type, status]
  )
  const shown = groups.reduce((n, g) => n + g.rows.length, 0)
  const filtersOn = !!q || status !== 'All' || country !== 'Any country' || type !== 'Any type'
  const clear = () => (setQ(''), setStatus('All'), setCountry('Any country'), setType('Any type'))

  return (
    <>
      <FilterToolbar query={q} onQuery={setQ} placeholder="Filter geographies" count={`${shown} of ${places.length} geographies`} filtersOn={filtersOn} onClear={clear}>
        {GEO_STATUSES.map((s) => (
          <FilterPill key={s} active={status === s} onClick={() => setStatus(s)}>
            {s}
          </FilterPill>
        ))}
        <FilterSelect label="Country" value={country} options={['Any country', ...countries.map((c) => c.name)]} onChange={setCountry} />
        <FilterSelect label="Type" value={type} options={TYPE_FILTERS} onChange={setType} />
      </FilterToolbar>

      <Card className="gap-0 overflow-clip py-0">
        <Table>
          <TableHeader>
            <TableRow className="h-auto hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden md:table-cell">Sits under</TableHead>
              <TableHead className="hidden lg:table-cell">Postal</TableHead>
              <TableHead className="hidden lg:table-cell">In use by</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((grp) => (
              <Fragment key={grp.country}>
                <TableRow className="h-auto bg-surface-band hover:bg-surface-band">
                  <TableCell colSpan={6} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-caption font-bold tracking-[0.04em] text-body">{grp.country}</span>
                      <span className="text-fine text-muted-foreground">{plural(grp.rows.length, 'geography', 'geographies')}</span>
                    </div>
                  </TableCell>
                </TableRow>
                {grp.rows.map((g) => (
                  <TableRow key={g.name}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2.5">
                        {g.depth === 1 && <span aria-hidden="true" className="h-px w-3.5 shrink-0 bg-divider" />}
                        <div className="min-w-0">
                          <div className="font-bold text-foreground">{g.name}</div>
                          <div className="text-fine text-muted-foreground md:hidden">
                            {g.type} · under {g.parent}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary" size="sm">
                        {g.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-[220px] truncate text-body md:table-cell">{g.parent}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{g.postal}</TableCell>
                    <TableCell className={cn('hidden lg:table-cell', g.use ? 'text-body' : 'text-muted-foreground')}>{g.use ? plural(g.use, 'tenant', 'tenants') : 'Not used'}</TableCell>
                    <TableCell align="right">
                      <Badge
                        variant={GEO_TONE[g.status]}
                        size="sm"
                        render={
                          <button
                            type="button"
                            title={g.status === 'Active' ? 'Deactivate' : 'Activate'}
                            onClick={() => {
                              const next = g.status === 'Active' ? 'Inactive' : 'Active'
                              report(setGeographyStatus(g.name, next), `${g.name} is now ${next.toLowerCase()}.`)
                            }}
                          />
                        }
                      >
                        {g.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
            {!shown && <EmptyRow colSpan={6} text="No geography matches those filters." onClear={clear} />}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

function EmptyRow({ colSpan, text, onClear }: { colSpan: number; text: string; onClear: () => void }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-[30px] text-center">
        <div className="text-ui-sm text-body">{text}</div>
        <button type="button" onClick={onClear} className="mt-2 text-compact font-bold text-link hover:underline">
          Clear filters
        </button>
      </TableCell>
    </TableRow>
  )
}
