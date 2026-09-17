import { useEffect, useMemo, useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { PageTitle } from '@/components/layout/page'
import { childrenOf } from '@/features/tenants/logic'
import { useTenantDirectory } from '@/features/tenants/queries'
import { BillingDrawers } from './billing-drawers'
import type { BillingDrawer } from './billing-drawers'
import { DunningPanel } from './dunning-panel'
import { downloadLedgerCsv } from './ledger-bits'
import type { BillingStatusFilter } from './ledger-bits'
import { LedgerTable } from './ledger-table'
import { LedgerToolbar } from './ledger-toolbar'
import { PaymentsToVerifyPanel } from './payment-review'
import { formatMvr } from './logic'
import { useBillingOptions, useBillingSummary, useInvoices, useLedger } from './queries'

export { BILLING_STATUS_FILTERS } from './ledger-bits'
export type { BillingStatusFilter } from './ledger-bits'

/** Operator billing: summary, dunning policy, and the invoice + credit ledger with its actions. */
export function BillingPage({ status, onStatusChange, view }: { status: BillingStatusFilter; onStatusChange: (s: BillingStatusFilter) => void; view?: 'payments' }) {
  const summary = useBillingSummary()
  const ledger = useLedger()
  const invoices = useInvoices()
  const { currentPeriod } = useBillingOptions()
  const { tenants } = useTenantDirectory()
  const toast = useToast()

  const [q, setQ] = useState('')
  const [period, setPeriod] = useState('Any period')
  const [tenantSlug, setTenantSlug] = useState<string | null>(null)
  const [rollUp, setRollUp] = useState(true)
  const [showDunning, setShowDunning] = useState(false)
  const [drawer, setDrawer] = useState<BillingDrawer>(null)

  useEffect(() => {
    if (view === 'payments') document.getElementById('payments-to-verify')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [view])

  const bySlug = useMemo(() => new Map(tenants.map((t) => [t.slug, t])), [tenants])
  const picked = tenantSlug ? bySlug.get(tenantSlug) : undefined
  const kids = picked ? childrenOf(tenants, picked.slug) : []
  const parent = picked?.parentSlug ? bySlug.get(picked.parentSlug) : undefined

  const rows = useMemo(() => {
    const needle = picked ? '' : q.trim().toLowerCase()
    const scope = picked ? new Set([picked.slug, ...(rollUp ? kids.map((k) => k.slug) : [])]) : null
    return ledger.filter((e) => {
      const t = bySlug.get(e.tenantSlug)
      if (needle && !`${e.no} ${t?.name ?? ''} ${t?.abbr ?? ''} ${e.period} ${e.method} ${e.kind}`.toLowerCase().includes(needle)) return false
      if (status !== 'All' && (status === 'Credits' ? e.kind === 'Invoice' : e.status !== status)) return false
      if (period !== 'Any period' && e.period !== period) return false
      return !scope || scope.has(e.tenantSlug)
    })
  }, [ledger, bySlug, q, status, period, picked, rollUp, kids])

  const filtersOn = Boolean(q) || status !== 'All' || period !== 'Any period' || Boolean(picked)
  const clearFilters = () => {
    setQ('')
    onStatusChange('All')
    setPeriod('Any period')
    setTenantSlug(null)
    setRollUp(true)
  }

  const exportCsv = () => {
    const n = downloadLedgerCsv(rows, (slug) => bySlug.get(slug)?.name ?? slug)
    toast(`${n} ledger lines exported as CSV for your accounting system.`)
  }
  const chaseAll = () => {
    if (!summary.openCount) toast('No open invoices to chase.')
    else setDrawer({ kind: 'chase' })
  }
  const runBilling = () => toast(`September run prepared — ${invoices.filter((i) => i.period === currentPeriod).length} invoices ready to issue.`)

  const stats = [
    { label: 'Outstanding', value: formatMvr(summary.outstanding), note: `${summary.openCount} invoice(s) issued and unpaid.` },
    { label: 'Overdue', value: formatMvr(summary.overdueTotal), note: summary.overdueCount ? `${summary.overdueCount} past due — dunning is running on these.` : 'Nothing past its due date.', warn: summary.overdueTotal > 0 },
    { label: 'Collected in Sep', value: formatMvr(summary.collected), note: summary.creditedTotal ? `${formatMvr(summary.creditedTotal)} issued as credits this quarter.` : 'Receipts sent automatically on payment.' },
    { label: 'Monthly run rate', value: formatMvr(summary.runRate), note: 'Across every active tenant at today’s seat counts.' },
  ]

  const invoicedInView = rows.filter((e) => e.kind === 'Invoice')

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <PageTitle
          overline="Admin"
          title="Billing"
          className="mb-[18px]"
          meta={`${formatMvr(summary.outstanding)} outstanding · ${formatMvr(summary.overdueTotal)} of that overdue · ${formatMvr(summary.collected)} collected in September`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" aria-expanded={showDunning} onClick={() => setShowDunning((v) => !v)}>
                {showDunning ? 'Hide dunning policy' : 'Dunning policy'}
              </Button>
              <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
              <Button variant="outline" onClick={chaseAll}>Chase open invoices</Button>
              <Button onClick={runBilling}>Prepare monthly run</Button>
            </div>
          }
        />

        {/* the same figures row as the dashboard and the Control Centre overview */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-x-10 gap-y-5">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <div className="text-overline text-faint">{s.label}</div>
              <div className={cn('mt-2 text-[28px] leading-[1.05] font-bold tracking-[-0.03em] tabular-nums', s.warn ? 'text-tone-warning-foreground' : 'text-foreground')}>{s.value}</div>
              <div className="mt-1 text-compact leading-[1.45] text-faint">{s.note}</div>
            </div>
          ))}
        </div>
        <div className="my-6 h-px bg-border" />

        <PaymentsToVerifyPanel tenants={bySlug} focused={view === 'payments'} />

        {showDunning && <DunningPanel />}

        <LedgerToolbar
          q={q}
          onQ={setQ}
          picked={picked}
          rollUp={rollUp}
          hasKids={kids.length > 0}
          onPick={(slug) => { setTenantSlug(slug); setQ('') }}
          status={status}
          onStatus={onStatusChange}
          period={period}
          onPeriod={setPeriod}
          count={`${rows.length} of ${ledger.length} ${ledger.length === 1 ? 'ledger line' : 'ledger lines'}`}
          filtersOn={filtersOn}
          onClear={clearFilters}
        />

        {picked && (
          <div className="mb-3.5 flex flex-wrap items-center gap-3 rounded-lg bg-surface-band px-4 py-3">
            <span className="min-w-0 text-caption leading-normal text-body">
              {kids.length
                ? `${picked.name} has ${kids.length} child tenant${kids.length > 1 ? 's' : ''} — ${kids.map((k) => k.abbr).join(', ')}`
                : parent
                  ? `${picked.name} is a child of ${parent.name}`
                  : `${picked.name} is a standalone tenant`}
            </span>
            {kids.length > 0 && (
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-[9px] text-caption font-bold text-body">
                <Checkbox checked={rollUp} onCheckedChange={(on) => setRollUp(on === true)} />
                Include child tenants
              </label>
            )}
            {parent && (
              <Button variant="link" size="sm" onClick={() => { setTenantSlug(parent.slug); setRollUp(true) }}>
                View {parent.abbr} group
              </Button>
            )}
            <span className="flex-1" />
            <span className="text-caption font-bold whitespace-nowrap text-muted-foreground">
              {formatMvr(invoicedInView.reduce((n, e) => n + e.total, 0))} invoiced in view · {formatMvr(invoicedInView.filter((e) => e.status !== 'Paid').reduce((n, e) => n + e.total, 0))} still open
            </span>
          </div>
        )}

        <LedgerTable rows={rows} tenants={bySlug} onDrawer={setDrawer} onClear={clearFilters} />
      </div>

      <BillingDrawers drawer={drawer} onChange={setDrawer} />
    </div>
  )
}
