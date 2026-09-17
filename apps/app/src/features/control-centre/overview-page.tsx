import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import { isOnBooks, liveUnits, parseDate, siteStaff, unitKids, unitMembers } from '@/features/org/logic'
import { useAudit, usePeople, useRegions, useSiteTypes, useSites, useUnits, useCountries } from '@/features/org/queries'
import { useAttention } from './attention'
import { ControlTitle, Panel, Timeline } from './control-bits'

/** Headcount at each of the last twelve month-ends, read straight off start and end dates. */
function headcountSeries(people: { start: string; end: string; external?: boolean }[], today: Date) {
  const pts: number[] = []
  for (let i = 11; i >= 0; i--) {
    const edge = new Date(today.getFullYear(), today.getMonth() - i + 1, 0)
    pts.push(people.filter((p) => {
      if (p.external) return false
      const st = parseDate(p.start)
      if (!st || st > edge) return false
      const en = parseDate(p.end)
      return !en || en > edge
    }).length)
  }
  return pts
}

/** The record at a glance: four figures, what needs a look, the latest changes, and where people sit. */
export function ControlOverviewPage() {
  const units = useUnits(), people = usePeople(), sites = useSites(), types = useSiteTypes(), regions = useRegions(), countries = useCountries(), audit = useAudit()
  const attention = useAttention()
  const today = useMemo(() => new Date(), [])
  const active = people.filter((p) => isOnBooks(p) && p.status === 'Active')
  const divisions = unitKids(units, null)
  const joined = people.filter((p) => !p.external && parseDate(p.start)?.getFullYear() === today.getFullYear()).length
  const on = countries.filter((c) => c.on).map((c) => c.name)
  const regionsLive = regions.filter((r) => on.includes(r.country)).length
  const overrides = sites.filter((s) => s.cadence !== null).length
  const series = headcountSeries(people, today)
  const lo = Math.min(...series), hi = Math.max(...series)
  const spark = series.map((v, i) => `${i ? 'L' : 'M'}${((i / (series.length - 1)) * 120).toFixed(1)} ${(32 - (hi === lo ? 16 : ((v - lo) / (hi - lo)) * 28)).toFixed(1)}`).join(' ')
  const divMax = Math.max(1, ...divisions.map((u) => unitMembers(people, units, u.id, true).length))
  const uncovered = sites.filter((s) => !siteStaff(people, s.id).length)

  const figures = [
    { n: active.length, label: 'Employees', sub: `${joined} joined this year`, section: 'employees' },
    { n: liveUnits(units).length, label: 'Admin units', sub: `${divisions.length} top-level`, section: 'units' },
    { n: sites.length, label: 'Sites', sub: `${regionsLive} regions live`, section: 'sites' },
    { n: types.length, label: 'Site types', sub: overrides ? `${overrides} ${overrides === 1 ? 'site overrides' : 'sites override'} counting` : 'no counting overrides', section: 'site-types' },
  ]

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle overline="Control Centre" title="Overview" description="The record every other Bool app reads. Change it once here and it lands everywhere." />

        <div className="flex flex-wrap items-end gap-x-[54px] gap-y-5">
          {figures.map((f) => (
            <Link key={f.label} to="/$app/$section" params={{ app: 'control-centre', section: f.section }} className="-m-2 rounded-[10px] p-2 outline-none transition-colors duration-instant hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
              <div className="text-overline text-faint">{f.label}</div>
              <div className="mt-2 text-[34px] leading-[1.05] font-bold tracking-[-0.03em] text-foreground">{f.n}</div>
              <div className="mt-1 text-compact text-faint">{f.sub}</div>
            </Link>
          ))}
          <span className="flex-1 basis-10" />
          <div className="min-w-[160px] basis-[210px]">
            <svg viewBox="0 0 120 34" preserveAspectRatio="none" className="block h-9 w-full overflow-visible">
              <path d={spark} fill="none" className="stroke-sage" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="mt-1.5 text-caption text-faint">Headcount, last 12 months</div>
          </div>
        </div>
        <div className="my-6 h-px bg-border" />

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Panel heading="Needs attention" aside={<span className="text-caption text-faint">{attention.length ? `${attention.length} open` : 'all clear'}</span>}>
            {attention.length === 0 && <div className="text-compact text-body">Nothing needs a look right now.</div>}
            <ul>
              {attention.map((a) => (
                <li key={a.label}>
                  <Link to="/$app/$section" params={{ app: 'control-centre', section: a.to.section }} search={a.to.search} className="-mx-3 flex items-center gap-[11px] rounded-[9px] border-b border-divider px-3 py-[11px] outline-none last:border-b-0 hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                    <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', a.tone === 'warning' ? 'bg-brand-soft' : a.tone === 'risk' ? 'bg-tone-risk' : 'bg-tone-neutral')} />
                    <span className="min-w-0 flex-1 text-ui-sm text-body">{a.label}</span>
                    <span className="text-ui-sm font-bold text-foreground">{a.count}</span>
                    <ChevronRight className="size-3 text-faint" strokeWidth={1.8} />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel heading="Recent changes" aside={<Button variant="link" size="xs" render={<Link to="/$app/$section" params={{ app: 'control-centre', section: 'activity' }} />}>Full log</Button>}>
            <Timeline items={audit.slice(0, 5).map((a) => ({ text: a.text, when: `${a.scope} · ${a.who} · ${a.when}` }))} />
          </Panel>
        </div>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Panel heading="People by division" aside={<Button variant="link" size="xs" render={<Link to="/$app/$section" params={{ app: 'control-centre', section: 'units' }} />}>Open units</Button>}>
            <ul className="mt-1.5 flex flex-col gap-[13px]">
              {[...divisions].sort((a, b) => unitMembers(people, units, b.id, true).length - unitMembers(people, units, a.id, true).length).map((u) => {
                const n = unitMembers(people, units, u.id, true).length
                return (
                  <li key={u.id}>
                    <Link to="/$app/$section" params={{ app: 'control-centre', section: 'units' }} search={{ id: u.id }} className="block outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-ui-sm text-body">{u.name}</span>
                        <span className="text-caption text-faint">{n === 1 ? '1 person' : `${n} people`}</span>
                      </div>
                      <div className="mt-[7px] h-1 overflow-hidden rounded-full bg-muted">
                        <span className={cn('block h-full rounded-full transition-[width] duration-considered', n ? 'bg-sage' : 'bg-border')} style={{ width: `${Math.max(2, Math.round((n / divMax) * 100))}%` }} />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Panel>
          <Panel heading="Site coverage">
            <ul>
              {sites.map((s) => {
                const n = siteStaff(people, s.id).length
                return (
                  <li key={s.id}>
                    <Link to="/$app/$section" params={{ app: 'control-centre', section: 'sites' }} search={{ id: s.id }} className="-mx-2.5 flex items-center gap-2.5 rounded-lg border-b border-divider px-2.5 py-2 outline-none last:border-b-0 hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', s.status === 'Paused' ? 'bg-brand-soft' : n ? 'bg-sage' : 'bg-tone-tan')} />
                      <span className="min-w-0 flex-1 truncate text-ui-sm text-body">{s.name}</span>
                      <span className={cn('text-compact font-bold tabular-nums', n ? 'text-body' : 'text-tone-warning-foreground')}>{n}</span>
                    </Link>
                  </li>
                )
              })}
              <li>
                <Link to="/$app/$section" params={{ app: 'control-centre', section: 'employees' }} search={{ filter: 'no-site' }} className="-mx-2.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                  <span aria-hidden="true" className="size-1.5 shrink-0 rounded-[1px] bg-tone-neutral" />
                  <span className="min-w-0 flex-1 truncate text-ui-sm text-body">Office only, no site</span>
                  <span className="text-compact font-bold tabular-nums text-faint">{active.filter((p) => !p.primarySite).length}</span>
                </Link>
              </li>
            </ul>
            <div className="mt-3 text-caption leading-[1.5] text-pretty text-faint">
              {uncovered.length ? `${uncovered.length} ${uncovered.length === 1 ? 'site has' : 'sites have'} nobody assigned — ${uncovered.map((s) => s.code).join(', ')}. Inventory will refuse every action there.` : 'Every site has at least one person who can act on stock.'}
            </div>
          </Panel>
        </div>
        <p className="mt-[18px] max-w-[88ch] text-caption leading-[1.7] text-pretty text-faint">
          Inventory and Scan read sites, site types and each person's site access · Directory mirrors these admin units and employees, read-only · Calendar reads regions and public holidays so scheduled counts never land on a closed day.
        </p>
        <Badge variant="neutral" size="sm" className="mt-3 hidden">
          {audit.length}
        </Badge>
      </div>
    </div>
  )
}
