import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Check, TriangleAlert } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@workspace/ui/components/sheet'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { planByName } from '@/features/tenants/logic'
import { useDirectoryTenant, usePlans } from '@/features/tenants/queries'
import { formatMvr } from './logic'
import { KeyValueRows, LedgerStatusBadge, Overline, signedMvr } from './ledger-bits'
import { useBillingActions, useBillingOptions, useBillingProfiles, useDunningPolicy, useLedger, useTenantBilling } from './queries'
import type { ChaseTemplate, CreditKind, LedgerLine } from './types'

/** Which billing drawer is open. */
export type BillingDrawer =
  | { kind: 'invoice'; no: string }
  | { kind: 'credit'; against: string; tenantSlug: string; creditKind: CreditKind }
  | { kind: 'chase' }
  | null

/** Opens the credit drawer for a ledger line: refunds for paid invoices, credit notes otherwise. */
export const creditDrawerFor = (e: LedgerLine): BillingDrawer => ({ kind: 'credit', against: e.no, tenantSlug: e.tenantSlug, creditKind: e.status === 'Paid' ? 'Refund' : 'Credit note' })

/** Mark paid / issue a ledger invoice, with the design's toast and an undo. */
export function useInvoiceActions() {
  const { markPaid, issue } = useBillingActions()
  const profiles = useBillingProfiles()
  const toast = useToast()
  return {
    markPaid: (e: LedgerLine) => toast(`${e.no} marked paid. A receipt goes to ${profiles[e.tenantSlug]?.email ?? 'the billing contact'}.`, { undo: markPaid(e.no) }),
    issue: (e: LedgerLine, to: string) => toast(`${e.no} issued to ${to}.`, { undo: issue(e.no) }),
  }
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="mt-[22px] flex items-start gap-2.5 rounded-md bg-surface-band px-[15px] py-[13px] text-caption text-body">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-tone-warning-foreground" />
      <span>{children}</span>
    </div>
  )
}

function DrawerShell({ open, onClose, title, note, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; note: ReactNode; children: ReactNode; footer: ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto sm:max-w-[460px]">
        <SheetHeader className="pr-14">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{note}</SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-2">{children}</div>
        <SheetFooter className="flex-row flex-wrap">{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/** The billing screen's drawers (invoice document, credit/refund, chase open invoices). */
export function BillingDrawers({ drawer, onChange }: { drawer: BillingDrawer; onChange: (d: BillingDrawer) => void }) {
  const close = () => onChange(null)
  return (
    <>
      {drawer?.kind === 'invoice' && <InvoiceDrawer no={drawer.no} onClose={close} onCredit={(e) => onChange(creditDrawerFor(e))} />}
      {drawer?.kind === 'credit' && <CreditDrawer key={drawer.against} drawer={drawer} onClose={close} />}
      {drawer?.kind === 'chase' && <ChaseDrawer onClose={close} />}
    </>
  )
}

function InvoiceDrawer({ no, onClose, onCredit }: { no: string; onClose: () => void; onCredit: (e: LedgerLine) => void }) {
  const ledger = useLedger()
  const e = ledger.find((x) => x.no === no) ?? ledger[0]
  const tenant = useDirectoryTenant(e.tenantSlug)
  const plans = usePlans()
  const { profile: pf, dunningMode } = useTenantBilling(e.tenantSlug)
  const policy = useDunningPolicy()
  const actions = useInvoiceActions()
  const toast = useToast()
  const navigate = useNavigate()

  const credit = e.kind !== 'Invoice'
  const plan = planByName(plans, tenant?.plan ?? 'Starter')
  const seats = tenant?.seatsUsed ?? 0
  const against = ledger.filter((c) => c.against === e.no)
  const lines = credit
    ? [{ label: e.reason ?? 'Adjustment', qty: 'Against ' + e.against, value: '− ' + formatMvr(Math.abs(e.net)) }]
    : [
        { label: `${plan.name} plan, monthly base`, qty: '1 × ' + formatMvr(plan.base), value: formatMvr(plan.base) },
        { label: 'Seats in use', qty: `${seats} × ${formatMvr(plan.perSeat)}`, value: formatMvr(plan.perSeat * seats) },
        ...against.map((c) => ({ label: `${c.kind} ${c.no}`, qty: c.reason ?? '', value: '− ' + formatMvr(Math.abs(c.total)) })),
      ]
  const timeline = credit
    ? [{ when: e.due, what: `${e.kind} issued`, who: 'Mariyam Ahmed' }]
    : [
        { when: e.issued, what: 'Invoice issued to ' + pf.email, who: e.status === 'Draft' ? 'Not sent yet' : 'Sent automatically' },
        { when: e.due, what: 'Payment due', who: e.status === 'Overdue' ? 'Missed — reminders running' : e.status === 'Paid' ? 'Settled' : 'Not yet due' },
        ...against.map((c) => ({ when: c.due, what: `${c.kind} ${c.no} for ${formatMvr(Math.abs(c.total))}`, who: c.reason ?? '' })),
        ...(e.status === 'Paid' ? [{ when: '—', what: 'Paid in full', who: pf.method }] : []),
      ]
  const warn =
    e.status === 'Overdue'
      ? 'Past due. ' + (dunningMode === 'Platform policy' ? `Platform dunning is running — suspension warning at day +${policy.warn}.` : `${dunningMode} applies to this tenant.`)
      : ''

  return (
    <DrawerShell
      open
      onClose={onClose}
      title={<span className="font-mono">{e.no}</span>}
      note={`${tenant?.name ?? e.tenantSlug} · ${e.kind} for ${e.period} · ${e.status}`}
      footer={
        <>
          <Button onClick={() => { toast(`${e.no} downloaded as PDF.`); onClose() }}>Download PDF</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </>
      }
    >
      <div className="rounded-lg bg-surface-band px-[22px] py-5">
        <div className="mb-1.5 flex items-center justify-between gap-3.5">
          <Overline>Lines</Overline>
          <LedgerStatusBadge status={e.status} />
        </div>
        {lines.map((l) => (
          <div key={l.label} className="flex items-center justify-between gap-3.5 border-b border-divider py-3">
            <div className="min-w-0">
              <div className="text-ui-sm font-bold text-foreground">{l.label}</div>
              <div className="mt-0.5 text-meta text-muted-foreground">{l.qty}</div>
            </div>
            <span className="text-ui-sm font-bold whitespace-nowrap text-body">{l.value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3.5 border-b border-divider py-3">
          <span className="text-compact text-body">{e.tax ? `GST at ${pf.taxRate}%` : 'GST — exempt'}</span>
          <span className="text-ui-sm font-bold text-body">{e.tax ? formatMvr(e.tax) : '—'}</span>
        </div>
        <div className="flex items-center justify-between gap-3.5 pt-3.5">
          <span className="text-caption text-muted-foreground">Total</span>
          <span className="text-h3 tracking-[-0.02em] text-foreground">{signedMvr(e)}</span>
        </div>
      </div>

      <Overline className="mt-[22px] mb-1">Billed to</Overline>
      <KeyValueRows
        rows={[
          { label: 'Tenant', value: tenant?.name ?? e.tenantSlug },
          { label: 'Billing contact', value: pf.contact },
          { label: 'E-mail', value: pf.email },
          { label: 'PO reference', value: pf.po },
          { label: 'Tax registration', value: pf.taxId },
          { label: 'Payment method', value: pf.method },
        ]}
      />

      <Overline className="mt-[22px] mb-1">History</Overline>
      {timeline.map((ev, i) => (
        <div key={i} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3.5 border-b border-divider py-3">
          <span className="text-caption text-muted-foreground">{ev.when}</span>
          <div className="min-w-0">
            <div className="text-ui-sm leading-[1.45] text-foreground">{ev.what}</div>
            <div className="mt-0.5 text-meta text-muted-foreground">{ev.who}</div>
          </div>
        </div>
      ))}

      <div className="mt-5 flex flex-wrap gap-2.5">
        {!credit && e.status !== 'Paid' && (
          <Button variant="outline" size="sm" onClick={() => (e.status === 'Draft' ? actions.issue(e, pf.email) : actions.markPaid(e))}>
            {e.status === 'Draft' ? 'Issue invoice' : 'Mark paid'}
          </Button>
        )}
        {!credit && e.status !== 'Draft' && (
          <Button variant="outline" size="sm" onClick={() => onCredit(e)}>
            {e.status === 'Paid' ? 'Refund' : 'Credit note'}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => { onClose(); navigate({ to: '/tenants/$slug', params: { slug: e.tenantSlug }, search: { tab: 'billing' } }) }}>
          Open tenant
        </Button>
      </div>
      {warn && <Warn>{warn}</Warn>}
    </DrawerShell>
  )
}

function CreditDrawer({ drawer, onClose }: { drawer: Extract<BillingDrawer, { kind: 'credit' }>; onClose: () => void }) {
  const ledger = useLedger()
  const invoice = ledger.find((x) => x.no === drawer.against)
  const tenant = useDirectoryTenant(drawer.tenantSlug)
  const { issueCredit } = useBillingActions()
  const toast = useToast()
  const [kind, setKind] = useState<CreditKind>(drawer.creditKind)
  const [amount, setAmount] = useState(String(invoice?.total ?? ''))
  const [reason, setReason] = useState('')

  const isRefund = kind === 'Refund'
  const amt = Math.round(Number(amount || 0))
  const cap = invoice?.total ?? 0
  const over = amt > cap

  const save = () => {
    if (!(amt > 0)) {
      toast('Put an amount on the credit before issuing it.', { ok: false })
      return
    }
    if (over) return
    const { no, undo } = issueCredit({ tenantSlug: drawer.tenantSlug, against: drawer.against, kind, amount: amt, reason })
    onClose()
    toast(`${no} issued for ${formatMvr(amt)} against ${drawer.against}.`, { undo })
  }

  return (
    <DrawerShell
      open
      onClose={onClose}
      title={isRefund ? 'Refund a payment' : 'Issue a credit note'}
      note={`${isRefund ? 'Money goes back to ' : 'Credit is applied against '}${drawer.against} for ${tenant?.name ?? 'this tenant'}.`}
      footer={
        <>
          <Button onClick={save} disabled={over}>{isRefund ? 'Issue refund' : 'Issue credit note'}</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-[18px]">
        <div className="grid gap-2">
          <Label htmlFor="credit-kind">Type</Label>
          <NativeSelect id="credit-kind" value={kind} onChange={(ev) => setKind(ev.target.value as CreditKind)}>
            <option>Credit note</option>
            <option>Refund</option>
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="credit-amount">Amount (MVR)</Label>
          <Input id="credit-amount" inputMode="numeric" placeholder="0" value={amount} aria-invalid={over || undefined} onChange={(ev) => setAmount(ev.target.value.replace(/[^\d.]/g, ''))} />
        </div>
        <p className="col-span-2 -mt-2.5 text-meta text-muted-foreground">A credit note reduces what they owe. A refund returns money already paid.</p>
        <div className="col-span-2 grid gap-2">
          <Label htmlFor="credit-reason">Reason shown on the document</Label>
          <Input id="credit-reason" placeholder="Seat count corrected after a mid-month leaver" value={reason} onChange={(ev) => setReason(ev.target.value)} />
        </div>
      </div>
      {over && <Warn>That is more than the {formatMvr(cap)} on {drawer.against}. Credits cannot exceed the original document.</Warn>}
    </DrawerShell>
  )
}

function ChaseDrawer({ onClose }: { onClose: () => void }) {
  const ledger = useLedger()
  const profiles = useBillingProfiles()
  const policy = useDunningPolicy()
  const { chaseTemplates } = useBillingOptions()
  const toast = useToast()
  const [tpl, setTpl] = useState<ChaseTemplate>('Polite nudge')
  const [skip, setSkip] = useState<Set<string>>(new Set())

  const open = ledger.filter((e) => e.kind === 'Invoice' && (e.status === 'Due' || e.status === 'Overdue'))
  const picks = open.filter((e) => !skip.has(e.no))
  const owed = (e: LedgerLine) => e.total - e.credited

  const toggle = (no: string) =>
    setSkip((s) => {
      const next = new Set(s)
      if (next.has(no)) next.delete(no)
      else next.add(no)
      return next
    })

  const send = () => {
    if (!picks.length) {
      toast('Pick at least one invoice to chase.', { ok: false })
      return
    }
    onClose()
    toast(`${tpl} sent for ${picks.length} invoice(s) — ${formatMvr(picks.reduce((n, e) => n + e.total, 0))} chased.`)
  }

  return (
    <DrawerShell
      open
      onClose={onClose}
      title="Chase open invoices"
      note={`${open.length} invoice(s) are issued and unpaid. Pick who gets a reminder and what it says.`}
      footer={
        <>
          <Button onClick={send}>{picks.length ? `Send ${picks.length} reminder${picks.length === 1 ? '' : 's'}` : 'Nothing selected'}</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </>
      }
    >
      <div className="mb-5 grid gap-2">
        <Label htmlFor="chase-tpl">Message</Label>
        <NativeSelect id="chase-tpl" value={tpl} onChange={(ev) => setTpl(ev.target.value as ChaseTemplate)}>
          {chaseTemplates.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </NativeSelect>
        <p className="text-meta text-muted-foreground">Sent to each tenant’s billing contact, copied to their tenant admins on a final notice.</p>
      </div>
      <ChaseRows open={open} skip={skip} toggle={toggle} profiles={profiles} warnDay={policy.warn} />
      <div className="mt-1.5 text-caption font-bold text-muted-foreground">{formatMvr(picks.reduce((n, e) => n + owed(e), 0))} chased in total</div>
      {tpl === 'Final notice before suspension' && <Warn>A final notice states the date access stops. It should not be the first thing a tenant hears.</Warn>}
    </DrawerShell>
  )
}

function ChaseRows({ open, skip, toggle, profiles, warnDay }: { open: LedgerLine[]; skip: Set<string>; toggle: (no: string) => void; profiles: ReturnType<typeof useBillingProfiles>; warnDay: number }) {
  return (
    <div className="grid gap-2">
      {open.map((e) => (
        <ChaseRow key={e.no} line={e} on={!skip.has(e.no)} toggle={() => toggle(e.no)} contact={`${profiles[e.tenantSlug]?.contact ?? 'Not set'} · ${profiles[e.tenantSlug]?.email ?? '—'}`} warnDay={warnDay} />
      ))}
    </div>
  )
}

function ChaseRow({ line: e, on, toggle, contact, warnDay }: { line: LedgerLine; on: boolean; toggle: () => void; contact: string; warnDay: number }) {
  const tenant = useDirectoryTenant(e.tenantSlug)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={toggle}
      className={cn('lift flex w-full items-center gap-[11px] rounded-lg px-3.5 py-[13px] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring', on ? 'bg-sage-soft' : 'shadow-[inset_0_0_0_1px_var(--divider)]')}
    >
      <span aria-hidden="true" className={cn('grid size-[17px] shrink-0 place-items-center rounded-[5px]', on ? 'bg-sage text-sage-foreground' : 'shadow-[inset_0_0_0_1.5px_var(--border)]')}>
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-ui-sm font-bold text-foreground">{tenant?.name ?? e.tenantSlug}</div>
        <div className="mt-0.5 truncate text-meta text-muted-foreground">
          {e.no} · {contact}
        </div>
        <div className={cn('mt-0.5 text-meta font-bold', e.status === 'Overdue' ? 'text-tone-warning-foreground' : 'text-muted-foreground')}>
          {e.status === 'Overdue' ? `Overdue · next step at day +${warnDay}` : `Due ${e.due}`}
        </div>
      </div>
      <span className="shrink-0 text-ui-sm font-bold text-foreground">{formatMvr(e.total - e.credited)}</span>
    </button>
  )
}
