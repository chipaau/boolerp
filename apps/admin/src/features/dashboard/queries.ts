// Dashboard figures, derived from the other features' hooks. No fixtures of its own, so nothing
// here changes at integration.
import { useMemo } from 'react'
import { useBillingSummary, useInvoices } from '@/features/billing/queries'
import { useGeographies } from '@/features/geographies/queries'
import { isNotLive, monthlyNet, planByName } from '@/features/tenants/logic'
import { usePlans, useTenantDirectory } from '@/features/tenants/queries'
import type { DirectoryTenant, PlanName } from '@/features/tenants/types'

/** The design's "today"; fixtures are dated against it. */
const TODAY = new Date(2026, 8, 16)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "25 Oct 2024" → Date; null for '—' or anything else unparseable. */
export function parseDisplayDate(s: string): Date | null {
  const m = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/.exec(s.trim())
  if (!m) return null
  const month = MONTHS.indexOf(m[2])
  return month < 0 ? null : new Date(Number(m[3]), month, Number(m[1]))
}

export type ActivityLine = { slug: string; abbr: string; what: string; who: string; when: string }

export type Dashboard = {
  counts: { total: number; active: number; notLive: number; suspended: number }
  seats: { used: number; sold: number; pct: number }
  /** Monthly net across active tenants at today's seats, and its value at each of the last 12 month-ends. */
  runRate: { now: number; series: number[]; yearAgo: number; paying: number }
  billing: ReturnType<typeof useBillingSummary> & { overdue: { no: string; tenantSlug: string; amount: number; due: string }[] }
  planMix: { plan: PlanName; tenants: number; monthly: number }[]
  newest: DirectoryTenant[]
  activity: ActivityLine[]
  geographies: { name: string; type: string; use: number }[]
  geographiesUsed: number
}

/** Everything the operator dashboard shows, in one memoised read. */
export function useDashboard(today: Date = TODAY): Dashboard {
  const { tenants } = useTenantDirectory()
  const plans = usePlans()
  const summary = useBillingSummary()
  const invoices = useInvoices()
  const geos = useGeographies()

  return useMemo(() => {
    const active = tenants.filter((t) => t.directoryStatus === 'active')
    const net = (t: DirectoryTenant) => monthlyNet(planByName(plans, t.plan), t.seatsUsed)
    const used = active.reduce((n, t) => n + t.seatsUsed, 0)
    const sold = active.reduce((n, t) => n + t.seatLimit, 0)

    const series: number[] = []
    for (let i = 11; i >= 0; i--) {
      const edge = new Date(today.getFullYear(), today.getMonth() - i + 1, 0)
      series.push(active.filter((t) => { const from = parseDisplayDate(t.activeFrom); return !from || from <= edge }).reduce((n, t) => n + net(t), 0))
    }

    const planMix = plans.map((p) => {
      const on = active.filter((t) => t.plan === p.name)
      return { plan: p.name, tenants: on.length, monthly: on.reduce((n, t) => n + net(t), 0) }
    })

    const started = (t: DirectoryTenant) => (t.createdAt ? new Date(t.createdAt) : parseDisplayDate(t.activeFrom))?.getTime() ?? -1
    const newest = [...tenants].sort((a, b) => started(b) - started(a)).slice(0, 5)

    const activity = tenants
      .flatMap((t) => t.activity.map((a) => ({ slug: t.slug, abbr: t.abbr, ...a })))
      .sort((a, b) => (parseDisplayDate(b.when)?.getTime() ?? 0) - (parseDisplayDate(a.when)?.getTime() ?? 0))
      .slice(0, 6)

    return {
      counts: { total: tenants.length, active: active.length, notLive: tenants.filter((t) => isNotLive(t.directoryStatus)).length, suspended: tenants.filter((t) => t.directoryStatus === 'suspended').length },
      seats: { used, sold, pct: sold ? Math.round((used / sold) * 100) : 0 },
      runRate: { now: summary.runRate, series, yearAgo: series[0], paying: active.length },
      billing: { ...summary, overdue: invoices.filter((i) => i.status === 'Overdue').map((i) => ({ no: i.no, tenantSlug: i.tenantSlug, amount: i.amount, due: i.due })) },
      planMix,
      newest,
      activity,
      geographies: geos.filter((g) => g.use > 0).sort((a, b) => b.use - a.use).map((g) => ({ name: g.name, type: g.type, use: g.use })),
      geographiesUsed: geos.filter((g) => g.use > 0).length,
    }
  }, [tenants, plans, summary, invoices, geos, today])
}
