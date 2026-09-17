import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { CalendarDays, Check, ChevronRight, MapPin, Network, Shield, Users } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { daysUntil } from '@/lib/dates'
import { isOnBooks, liveUnits, parseDate, siteStaff, unitKids, unitMembers, upcomingHolidays } from '@/features/org/logic'
import { useAudit, useHolidays, usePeople, useRegions, useSiteTypes, useSites, useUnits, useCountries } from '@/features/org/queries'
import { useAttentionReport } from './attention'
import type { AttentionFix } from './attention'
import { ControlTitle, Panel, Timeline, useCanEdit } from './control-bits'

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
  const units = useUnits(), people = usePeople(), sites = useSites(), types = useSiteTypes(), regions = useRegions(), countries = useCountries(), audit = useAudit(), holidays = useHolidays()
  const { open: attention, clear } = useAttentionReport()
  const canEdit = useCanEdit()
  const toast = useToast()
  const runFix = (fix: AttentionFix) => {
    if (!canEdit) return toast('Read only as Staff — ask an Admin to change setup', { ok: false })
    const undo = fix.apply()
    toast(fix.done, { undo })
  }
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

  const nextHoliday = upcomingHolidays(holidays.filter((h) => !h.region), today).at(0)
  const figures = [
    { n: active.length, label: 'Employees', sub: `${joined} joined this year`, section: 'employees', icon: Users },
    { n: liveUnits(units).length, label: 'Admin units', sub: `${divisions.length} top-level`, section: 'units', icon: Network },
    { n: sites.length, label: 'Sites', sub: `${regionsLive} regions live`, section: 'sites', icon: MapPin },
    { n: types.length, label: 'Site types', sub: overrides ? `${overrides} ${overrides === 1 ? 'site overrides' : 'sites override'} counting` : 'no counting overrides', section: 'site-types', icon: Shield },
    ...(nextHoliday ? [{ n: daysUntil(nextHoliday.date, today), label: 'Days to a holiday', sub: nextHoliday.name, section: 'holidays', icon: CalendarDays }] : []),
  ]
  // the figures and the attention list tell one story: each figure says how much of it needs a look
  const flagged = (section: string) => attention.filter((a) => a.to.section === section).reduce((n, a) => n + a.count, 0)

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle overline="Control Centre" title="Overview" description="The record every other Hexa app reads. Change it once here and it lands everywhere." />

        <div className="flex flex-wrap items-end gap-x-[54px] gap-y-5">
          {figures.map((f) => (
            <Link key={f.label} to="/$app/$section" params={{ app: 'control-centre', section: f.section }} className="group rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background">
              <div className="text-overline text-faint">{f.label}</div>
              <div className="mt-2 flex items-center gap-2.5 text-foreground transition-colors duration-instant group-hover:text-brand">
                <span className="text-[34px] leading-[1.05] font-bold tracking-[-0.03em] tabular-nums">{f.n}</span>
                <f.icon aria-hidden="true" className="size-[18px] text-faint transition-colors duration-instant group-hover:text-brand" strokeWidth={1.6} />
                {f.section === 'employees' && (
                  // headcount over the last twelve months, sitting with the number it explains
                  <svg viewBox="0 0 120 34" preserveAspectRatio="none" role="img" aria-label="Headcount, last 12 months" className="ms-1 block h-7 w-[84px] overflow-visible">
                    <title>Headcount, last 12 months</title>
                    <path d={spark} fill="none" className="stroke-sage" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                )}
              </div>
              <div className="mt-1 text-compact text-faint">
                {f.sub}
                {flagged(f.section) > 0 && <span className="text-tone-warning-foreground"> · {flagged(f.section)} to look at</span>}
              </div>
            </Link>
          ))}
        </div>
        <div className="my-6 h-px bg-border" />

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel heading="Needs attention" aside={<span className="text-caption text-faint">{attention.length ? `${attention.reduce((n, a) => n + a.count, 0)} open` : 'all clear'}</span>}>
            {attention.length === 0 && <div className="text-compact text-body">Nothing needs a look right now.</div>}
            <ul>
              {attention.map((a) => (
                <li key={a.label} className="flex items-start gap-[11px] border-b border-divider py-[11px] last:border-b-0">
                  <span aria-hidden="true" className={cn('mt-[7px] size-1.5 shrink-0 rounded-full', a.tone === 'warning' ? 'bg-brand-soft' : a.tone === 'risk' ? 'bg-tone-risk' : 'bg-tone-neutral')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 text-ui-sm font-bold text-foreground">{a.label}</span>
                      <span className="text-ui-sm font-bold text-foreground tabular-nums">{a.count}</span>
                    </div>
                    <div className="mt-0.5 text-compact leading-[1.45] text-faint">
                      {a.items.slice(0, 3).map((i) => i.name).join(', ')}
                      {a.items.length > 3 && ` +${a.items.length - 3} more`}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {a.fix && (
                      <Button variant="outline" size="xs" className="rounded-full font-bold" onClick={() => a.fix && runFix(a.fix)}>
                        {a.fix.label}
                      </Button>
                    )}
                    <Button variant="ghost" size="xs" className="rounded-full font-bold" render={<Link to="/$app/$section" params={{ app: 'control-centre', section: a.to.section }} search={a.to.search} />}>
                      Review
                      <ChevronRight className="size-3 text-faint" strokeWidth={1.8} />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
            {clear.length > 0 && (
              <details className="group mt-2 border-t border-divider pt-2.5">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md text-caption text-faint outline-none hover:text-body focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="size-3 transition-transform duration-instant group-open:rotate-90" strokeWidth={1.8} />
                  All clear · {clear.length} {clear.length === 1 ? 'check passes' : 'checks pass'}
                </summary>
                <ul className="mt-2 flex flex-col gap-1.5 pl-[18px]">
                  {clear.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-compact text-body">
                      <Check aria-hidden="true" className="size-3.5 text-sage" strokeWidth={2} />
                      {c}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Panel>
          <Panel heading="Recent changes" aside={<Button variant="link" size="xs" render={<Link to="/$app/$section" params={{ app: 'control-centre', section: 'activity' }} />}>Full log</Button>}>
            <Timeline items={audit.slice(0, 5).map((a) => ({ text: a.text, when: `${a.scope} · ${a.who} · ${a.when}` }))} />
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
      </div>
    </div>
  )
}
