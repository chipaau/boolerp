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
import { useCountries, useGeographies, useGeographyActions, useGeographySummary } from './queries'
import type { CountryStatus, GeographyStatus, GuardedResult } from './types'
import { AddCountryDrawer, AddGeographyDrawer } from './geography-drawers'

export type GeographiesTab = 'places' | 'countries'

const GEO_TONE: Record<GeographyStatus, BadgeTone> = { Active: 'success', Inactive: 'warning', Draft: 'neutral' }
const COUNTRY_TONE: Record<CountryStatus, BadgeTone> = { Active: 'success', Inactive: 'neutral' }
const GEO_STATUSES = ['All', 'Active', 'Inactive', 'Draft'] as const
const COUNTRY_STATUSES = ['All', 'Active', 'Inactive'] as const
const TYPE_FILTERS = ['Any type', 'Atoll', 'State', 'City', 'Island'] as const

const matches = (text: string, q: string) => !q.trim() || text.toLowerCase().includes(q.trim().toLowerCase())
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Geographies screen: shared places (atolls, islands, cities) and the countries they sit in. */
export function GeographiesPage({ tab, onTabChange }: { tab: GeographiesTab; onTabChange: (tab: GeographiesTab) => void }) {
  const summary = useGeographySummary()
  const [drawer, setDrawer] = useState<GeographiesTab | null>(null)

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <PageTitle
          overline="Admin"
          title="Geographies"
          meta={`${summary.total} geographies across ${summary.activeCountries} active countries · ${summary.unused} ${summary.unused === 1 ? 'is not used by any tenant' : 'not used by any tenant'}`}
          actions={<Button onClick={() => setDrawer(tab)}>{tab === 'places' ? 'Add a geography' : 'Add a country'}</Button>}
          className="mb-[18px]"
        />

        <Tabs value={tab} onValueChange={(v) => onTabChange(v as GeographiesTab)} className="mb-4 gap-0">
          <TabsList>
            <TabsTrigger value="places">Geographies</TabsTrigger>
            <TabsTrigger value="countries">Countries</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'places' ? <PlacesTable /> : <CountriesTable />}
      </div>

      <AddGeographyDrawer open={drawer === 'places'} onClose={() => setDrawer(null)} />
      <AddCountryDrawer open={drawer === 'countries'} onClose={() => setDrawer(null)} />
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

function CountriesTable() {
  const countries = useCountries()
  const { setCountryStatus } = useGeographyActions()
  const report = useGuardedToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<(typeof COUNTRY_STATUSES)[number]>('All')

  const rows = countries.filter((c) => matches(`${c.name} ${c.code} ${c.dial}`, q) && (status === 'All' || c.status === status))
  const clear = () => (setQ(''), setStatus('All'))

  return (
    <>
      <FilterToolbar query={q} onQuery={setQ} placeholder="Filter countries" count={`${rows.length} of ${countries.length} countries`} filtersOn={!!q || status !== 'All'} onClear={clear}>
        {COUNTRY_STATUSES.map((s) => (
          <FilterPill key={s} active={status === s} onClick={() => setStatus(s)}>
            {s}
          </FilterPill>
        ))}
      </FilterToolbar>

      <Card className="gap-0 overflow-clip py-0">
        <Table>
          <TableHeader>
            <TableRow className="h-auto hover:bg-transparent">
              <TableHead>Country</TableHead>
              <TableHead className="hidden md:table-cell">Code</TableHead>
              <TableHead className="hidden md:table-cell">Dialing</TableHead>
              <TableHead className="hidden lg:table-cell">Added</TableHead>
              <TableHead className="hidden md:table-cell">Geographies</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.code}>
                <TableCell>
                  <div className="font-bold text-foreground">{c.name}</div>
                  <div className="text-fine text-muted-foreground md:hidden">
                    {c.code} · {c.dial}
                  </div>
                </TableCell>
                <TableCell className="hidden font-mono text-caption text-body md:table-cell">{c.code}</TableCell>
                <TableCell className="hidden font-mono text-caption text-body md:table-cell">{c.dial}</TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{c.added}</TableCell>
                <TableCell className={cn('hidden md:table-cell', c.geographyCount ? 'text-body' : 'text-muted-foreground')}>{c.geographyCount || 'None yet'}</TableCell>
                <TableCell align="right">
                  <Badge
                    variant={COUNTRY_TONE[c.status]}
                    size="sm"
                    render={
                      <button
                        type="button"
                        title={c.status === 'Active' ? 'Deactivate' : 'Activate'}
                        onClick={() => {
                          const next = c.status === 'Active' ? 'Inactive' : 'Active'
                          report(setCountryStatus(c.code, next), `${c.name} is now ${next.toLowerCase()}.`)
                        }}
                      />
                    }
                  >
                    {c.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow colSpan={6} text="No country matches those filters." onClear={clear} />}
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
