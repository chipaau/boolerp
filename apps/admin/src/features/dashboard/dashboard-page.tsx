import { useNavigate } from '@tanstack/react-router'
import { ArrowButton } from '@workspace/ui/components/arrow-button'
import { Badge } from '@workspace/ui/components/badge'
import type { BadgeTone } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Sparkline } from '@workspace/ui/components/sparkline'
import { cn } from '@workspace/ui/lib/utils'
import { PageTitle } from '@/components/layout/page'
import { Panel, Timeline } from '@/components/panel'
import { useAttention } from '@/features/attention/queries'
import type { AttentionTone } from '@/features/attention/queries'
import { formatMvr } from '@/features/billing/logic'
import { statusLabel } from '@/features/tenants/logic'
import type { DirectoryStatus } from '@/features/tenants/types'
import { routeLink } from '@/lib/route-link'
import { useDashboard } from './queries'

const RAMP = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']
const DOT: Record<AttentionTone, string> = { warning: 'bg-brand-soft', danger: 'bg-tone-risk', caution: 'bg-tone-tan', muted: 'bg-tone-neutral' }
const STATUS_TONE: Record<DirectoryStatus, BadgeTone> = { active: 'success', suspended: 'warning', pending: 'slate', provisioning: 'slate', draft: 'neutral', archived: 'danger' }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * The console's landing page, in the Control Centre overview's language: a row of figures (hover
 * turns them amber) with the run-rate trend, then panels — what needs a look, what changed, where
 * the money is, the plan mix, the newest tenants and the geographies in use. Everything navigates
 * with buttons, so the rail keeps the only link named "Tenants".
 */
export function DashboardPage() {
  const navigate = useNavigate()
  const d = useDashboard()
  const attention = useAttention()
  const go = (to: string, search?: Record<string, string>, params?: Record<string, string>) => void navigate(routeLink(to, search, params) as never)

  const growth = d.runRate.yearAgo ? Math.round(((d.runRate.now - d.runRate.yearAgo) / d.runRate.yearAgo) * 100) : null
  const figures = [
    { label: 'Live tenants', n: String(d.counts.active), sub: `${d.counts.notLive} not yet live · ${d.counts.suspended} suspended`, flag: d.counts.notLive > 0, run: () => go('/tenants') },
    { label: 'Seats in use', n: String(d.seats.used), sub: `of ${d.seats.sold} sold · ${d.seats.pct}% full`, flag: d.seats.pct > 90, run: () => go('/tenants', { status: 'active' }) },
    { label: 'Monthly run rate', n: formatMvr(d.runRate.now), sub: `${plural(d.runRate.paying, 'paying tenant', 'paying tenants')}`, run: () => go('/billing') },
    { label: 'Outstanding', n: formatMvr(d.billing.outstanding), sub: d.billing.overdueCount ? `${formatMvr(d.billing.overdueTotal)} overdue` : 'nothing overdue', flag: d.billing.overdueCount > 0, run: () => go('/billing', d.billing.overdueCount ? { status: 'Overdue' } : undefined) },
  ]
  const mixTotal = d.planMix.reduce((n, p) => n + p.tenants, 0)
  const geoMax = Math.max(1, ...d.geographies.map((g) => g.use))

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <PageTitle overline="Admin" title="Dashboard" meta="Every tenant on the platform at a glance: who is live, what they pay, and what needs you next." />

        <div className="flex flex-wrap items-start gap-x-12 gap-y-5">
          {figures.map((f) => (
            <button key={f.label} type="button" onClick={f.run} className="group rounded-[10px] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background">
              <div className="text-overline text-faint">{f.label}</div>
              <div className="mt-2 text-[34px] leading-[1.05] font-bold tracking-[-0.03em] text-foreground tabular-nums transition-colors duration-instant group-hover:text-brand">{f.n}</div>
              <div className={cn('mt-1 text-compact', f.flag ? 'text-tone-warning-foreground' : 'text-faint')}>{f.sub}</div>
            </button>
          ))}
          <div className="ml-auto w-[180px] pl-8">
            <Sparkline values={d.runRate.series} className="h-9 text-sage" role="img" aria-hidden={false} aria-label="Monthly run rate, last 12 months" />
            <div className="mt-1.5 text-caption text-faint">
              Run rate, last 12 months{growth !== null && <span className="text-link"> · {growth >= 0 ? '+' : ''}{growth}%</span>}
            </div>
          </div>
        </div>
        <div className="my-6 h-px bg-border" />

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel heading="Needs attention" aside={<span className="text-caption text-faint">{attention.length ? `${attention.reduce((n, a) => n + a.count, 0)} open` : 'all clear'}</span>}>
            {attention.length === 0 && <div className="text-compact text-body">Nothing needs a look right now.</div>}
            <ul>
              {attention.map((a) => (
                <li key={a.key} className="flex items-center gap-[11px] border-b border-divider py-[11px] last:border-b-0">
                  <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', DOT[a.tone])} />
                  <span className="min-w-0 flex-1 text-ui-sm font-bold text-foreground">{a.label}</span>
                  <span className="w-8 shrink-0 text-center text-ui-sm font-bold text-foreground tabular-nums">{a.count}</span>
                  <ArrowButton small className="shrink-0" aria-label={`Review ${a.label.toLowerCase()}`} onClick={() => go(a.target.to, a.target.search)} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel heading="Recent activity" aside={<span className="text-caption text-faint">across every tenant</span>}>
            <Timeline items={d.activity.map((a) => ({ text: <><span className="font-bold text-foreground">{a.abbr}</span> · {a.what}</>, when: `${a.who} · ${a.when}` }))} />
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel heading="Billing" aside={<Button variant="link" size="xs" onClick={() => go('/billing')}>Open billing</Button>}>
            <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
              {[
                { k: 'Outstanding', v: formatMvr(d.billing.outstanding), note: plural(d.billing.openCount, 'invoice', 'invoices') },
                { k: 'Overdue', v: formatMvr(d.billing.overdueTotal), note: plural(d.billing.overdueCount, 'invoice', 'invoices'), warn: d.billing.overdueCount > 0 },
                { k: `Collected · ${d.billing.collectedPeriod}`, v: formatMvr(d.billing.collected), note: 'receipts sent' },
                { k: 'Credited', v: formatMvr(d.billing.creditedTotal), note: 'notes and refunds' },
              ].map((s) => (
                <div key={s.k} className="min-w-0 py-1.5">
                  <dt className="truncate text-caption text-faint">{s.k}</dt>
                  <dd className={cn('mt-1 text-ui-lg font-bold tabular-nums', s.warn ? 'text-tone-warning-foreground' : 'text-foreground')}>{s.v}</dd>
                  <dd className="text-caption text-faint">{s.note}</dd>
                </div>
              ))}
            </dl>
            {d.billing.overdue.length > 0 && (
              <ul className="mt-3 border-t border-divider">
                {d.billing.overdue.slice(0, 3).map((i) => (
                  <li key={i.no} className="flex items-center gap-3 border-b border-divider py-2.5 last:border-b-0">
                    <span className="font-mono text-compact font-bold text-foreground">{i.no}</span>
                    <span className="min-w-0 flex-1 truncate text-caption text-faint">due {i.due}</span>
                    <span className="text-ui-sm font-bold text-tone-warning-foreground tabular-nums">{formatMvr(i.amount)}</span>
                    <ArrowButton small aria-label={`Open ${i.no}`} onClick={() => go('/billing', { status: 'Overdue' })} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel heading="Plan mix" aside={<span className="text-caption text-faint">{plural(mixTotal, 'live tenant', 'live tenants')}</span>}>
            <div className="mt-1 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={d.planMix.map((p) => `${p.plan} ${p.tenants}`).join(', ')}>
              {d.planMix.filter((p) => p.tenants).map((p) => (
                <span key={p.plan} className={cn('block h-full transition-[width] duration-considered', RAMP[d.planMix.indexOf(p) % RAMP.length])} style={{ width: `${(p.tenants / Math.max(1, mixTotal)) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-4">
              {d.planMix.map((p, i) => (
                <li key={p.plan} className="flex items-center gap-2.5 border-b border-divider py-2.5 last:border-b-0">
                  <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-[2px]', RAMP[i % RAMP.length])} />
                  <span className="min-w-0 flex-1 text-ui-sm text-body">{p.plan}</span>
                  <span className="text-caption text-faint">{plural(p.tenants, 'tenant', 'tenants')}</span>
                  <span className="w-[104px] text-right text-ui-sm font-bold text-foreground tabular-nums">{formatMvr(p.monthly)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel heading="Newest tenants" aside={<span className="text-caption text-faint">{plural(d.counts.total, 'tenant', 'tenants')} in all</span>}>
            <ul>
              {d.newest.map((t) => (
                <li key={t.slug}>
                  <button
                    type="button"
                    onClick={() => go('/tenants/$slug', undefined, { slug: t.slug })}
                    className="-mx-2.5 flex w-[calc(100%+20px)] items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-none transition-colors duration-instant hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="grid h-8 min-w-10 shrink-0 place-items-center rounded-[9px] bg-sage-soft px-1.5 font-mono text-micro font-bold text-sage-soft-foreground">{t.abbr}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ui-sm font-bold text-foreground">{t.name}</span>
                      <span className="block truncate text-caption text-faint">
                        {t.plan} · {t.activeFrom !== '—' ? `from ${t.activeFrom}` : t.district}
                      </span>
                    </span>
                    <Badge variant={STATUS_TONE[t.directoryStatus]} size="sm">
                      {statusLabel(t.directoryStatus)}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel heading="Geographies in use" aside={<Button variant="link" size="xs" onClick={() => go('/geographies')}>Open geographies</Button>}>
            {d.geographies.length === 0 && <div className="text-compact text-body">No tenant sits in a registered geography yet.</div>}
            <ul className="mt-1.5 flex flex-col gap-[13px]">
              {d.geographies.slice(0, 6).map((g, i) => (
                <li key={g.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-ui-sm text-body">
                      {g.name} <span className="text-caption text-faint">· {g.type}</span>
                    </span>
                    <span className="text-caption text-faint">{plural(g.use, 'tenant', 'tenants')}</span>
                  </div>
                  <div className="mt-[7px] h-1 overflow-hidden rounded-full bg-muted">
                    <span className={cn('block h-full rounded-full', RAMP[i % RAMP.length])} style={{ width: `${Math.max(2, Math.round((g.use / geoMax) * 100))}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {d.geographies.length > 6 && <div className="mt-3 text-caption text-faint">+{d.geographies.length - 6} more in use</div>}
          </Panel>
        </div>
      </div>
    </div>
  )
}
