import { useEffect, useState } from 'react'
import { ChevronRight, Download, Landmark } from 'lucide-react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { SelectField } from '@workspace/ui/components/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workspace/ui/components/table'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { ALWAYS_ON_APPS, billingPeriods, defaultPayInvoice, DISPLAY_TONE, draftInvoice, invoiceDisplayStatus, INVOICE_TERMS_DAYS, isUnderReview, payableInvoices, paymentsFor, PLANS, PLAN_SEAT_PRICE, REQUEST_TONE, fmtIso, formatMoney, isOpenInvoice, lineTotal, seatState } from '@/features/billing/logic'
import { useAutoIssuedNumbers, useBillingActions, useBillingContact, useGstRate, useInvoices, usePayments, usePlanRequests, useSubscription } from '@/features/billing/queries'
import { isoDate } from '@/lib/dates'
import type { BillingContact, PaymentSubmission, PlanName, TenantInvoice } from '@/features/billing/types'
import { personById } from '@/features/org/logic'
import { usePeople } from '@/features/org/queries'
import { PayDialog, PaymentList } from './billing-pay'
import { ControlTitle, FieldLabel, KeyValue, Panel, RuleStrip, fieldClass, useIsAdmin } from './control-bits'

const READ_ONLY = 'Only an Admin can change billing'
const DISMISS_PREFIX = 'bool.billing.dismissed.'

/** Notices this viewer closed, remembered in this browser only. Storage failures just forget. */
function useDismissedNotices(): [(key: string) => boolean, (key: string) => void] {
  const [keys, setKeys] = useState<Set<string>>(() => new Set())
  const read = (key: string) => {
    try {
      return localStorage.getItem(DISMISS_PREFIX + key) === '1'
    } catch {
      return false
    }
  }
  const dismiss = (key: string) => {
    try {
      localStorage.setItem(DISMISS_PREFIX + key, '1')
    } catch {
      // private window or blocked storage: dismiss for this visit only
    }
    setKeys((s) => new Set(s).add(key))
  }
  const isDismissed = (key: string) => keys.has(key) || read(key)
  return [isDismissed, dismiss]
}

/**
 * The organisation's plan, seats, invoices and billing contact. Payment is by invoice and bank
 * transfer; plan changes are requests the operator approves. Admins edit, everyone else reads.
 */
export function BillingPage() {
  const sub = useSubscription()
  const invoices = useInvoices()
  const contact = useBillingContact()
  const requests = usePlanRequests()
  const people = usePeople()
  const actions = useBillingActions()
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const [invoice, setInvoice] = useState<TenantInvoice | null>(null)
  const [editContact, setEditContact] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [payFor, setPayFor] = useState<string[] | null>(null)
  const payments = usePayments()
  const guard = (fn: () => void) => () => (isAdmin ? fn() : toast(READ_ONLY, { ok: false }))

  const state = seatState(sub.seatsUsed, sub.seatsIncluded)
  const pct = Math.min(100, Math.round((sub.seatsUsed / Math.max(1, sub.seatsIncluded)) * 100))
  const open = invoices.filter((i) => isOpenInvoice(i.status))
  // an overdue invoice with a slip awaiting verification is no longer chased
  const overdue = invoices.filter((i) => i.status === 'Overdue' && !isUnderReview(i, payments))
  const payable = payableInvoices(invoices, payments)
  const payableIds = new Set(payable.map((i) => i.id))
  const pay = (ids: string[]) => guard(() => setPayFor(ids))()
  const recent = [...payments].sort((a, b) => b.submittedOn.localeCompare(a.submittedOn) || b.id.localeCompare(a.id)).slice(0, 4)
  const numberOf = (id: string) => invoices.find((i) => i.id === id)?.number ?? id
  const owed = open.reduce((n, i) => n + i.total, 0)
  const pending = requests.find((r) => r.status === 'Pending')
  const monthly = sub.seatsIncluded * sub.pricePerSeat
  const auto = useAutoIssuedNumbers()
  const gstRate = useGstRate()
  const today = isoDate(new Date())
  const current = billingPeriods(sub, today, 0, 0)[0]
  const next = draftInvoice(sub, current, sub.seatsUsed, gstRate, invoices)
  // notice keys carry what they are about, so a new overdue invoice or plan change shows again
  const overdueKey = `overdue:${overdue.map((i) => i.number).join(',')}`
  const pendingKey = sub.pendingChange && `pending:${sub.pendingChange.plan}-${sub.pendingChange.seats}-${sub.pendingChange.effectiveOn}`
  const [isDismissed, dismiss] = useDismissedNotices()

  function cancel(id: string) {
    const undo = actions.cancelRequest(id)
    toast('Plan change request withdrawn', { undo })
  }

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          overline="System"
          title="Billing & plan"
          description="Your plan, seats and invoices. Pay by bank transfer against each invoice; plan changes go to Bool for approval."
          actions={
            <>
              <Button variant="outline" onClick={guard(() => setRequesting(true))} disabled={!!pending && isAdmin}>
                Request a plan change
              </Button>
              <Button onClick={() => pay([defaultPayInvoice(invoices, payments)?.id ?? ''].filter(Boolean))} disabled={!payable.length} title={payable.length ? undefined : 'Nothing to pay'}>
                <Landmark className="size-4" strokeWidth={1.8} />
                Pay
              </Button>
            </>
          }
        />
        <RuleStrip>
          {sub.plan} · {sub.cycle.toLowerCase()} · renews {fmtIso(sub.renewsOn)} · {open.length ? <span className={cn(overdue.length && 'text-tone-risk-foreground')}>{formatMoney(owed, sub.currency)} outstanding{overdue.length ? `, ${overdue.length} overdue` : ''}</span> : 'nothing outstanding'}
        </RuleStrip>

        {overdue.length > 0 && !isDismissed(overdueKey) && (
          <Alert variant="warning" className="mb-5" onDismiss={() => dismiss(overdueKey)}>
            <AlertDescription>
              {overdue.map((i) => i.number).join(', ')} {overdue.length === 1 ? 'is' : 'are'} past due. Transfer the amount quoting the invoice number, then use Pay to upload the slip.
            </AlertDescription>
          </Alert>
        )}
        {sub.pendingChange && pendingKey && !isDismissed(pendingKey) && (
          <Alert className="mb-5" onDismiss={() => dismiss(pendingKey)}>
            <AlertDescription>
              Moving to {sub.pendingChange.plan} with {sub.pendingChange.seats} seats on {fmtIso(sub.pendingChange.effectiveOn)}.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 [&>*]:h-full">
          <Panel heading="Plan" aside={<Badge variant="filter-active" size="sm">{sub.cycle}</Badge>}>
            <div className="text-[34px] leading-[1.05] font-bold tracking-[-0.03em] text-foreground">{sub.plan}</div>
            <div className="mt-1 text-compact text-faint">
              {formatMoney(sub.pricePerSeat, sub.currency)} a seat · {formatMoney(monthly, sub.currency)} a month
            </div>
            <div className="mt-4">
              <KeyValue rows={[{ k: 'Renews on', v: fmtIso(sub.renewsOn) }, { k: 'Payment', v: 'Invoice · bank transfer' }]} />
            </div>
            <div className="mt-3 text-overline text-faint">Apps included</div>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {sub.apps.map((a) => (
                <li key={a}>
                  <Badge variant="secondary" size="sm">
                    {a}
                    {ALWAYS_ON_APPS.includes(a) && <span className="font-normal text-faint">· Included</span>}
                  </Badge>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel heading="Billing contact" aside={<Button variant="outline" size="sm" className="rounded-full font-bold" onClick={guard(() => setEditContact(true))}>Edit</Button>}>
            <KeyValue rows={[{ k: 'Name', v: contact.name }, { k: 'Email', v: contact.email }, { k: 'Phone', v: contact.phone, mono: true }, { k: 'Address', v: contact.address }, { k: 'TIN', v: contact.tin, mono: true }]} />
          </Panel>

          <Panel heading="Seats" aside={<span className="text-caption text-faint">counted from people on the books</span>}>
            <div className="flex items-baseline gap-2">
              <span className={cn('text-[34px] leading-[1.05] font-bold tracking-[-0.03em] tabular-nums', state === 'over' ? 'text-tone-risk-foreground' : 'text-foreground')}>{sub.seatsUsed}</span>
              <span className="text-compact text-faint">of {sub.seatsIncluded} seats</span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={sub.seatsIncluded} aria-valuenow={sub.seatsUsed} aria-label={`${sub.seatsUsed} of ${sub.seatsIncluded} seats used`}>
              <div className={cn('h-full rounded-full transition-[width] duration-considered ease-bool', state === 'ok' ? 'bg-chart-1' : state === 'near' ? 'bg-chart-3' : 'bg-chart-risk')} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-compact text-faint">
              <span className="tabular-nums">{state === 'over' ? `${sub.seatsUsed - sub.seatsIncluded} over` : `${sub.seatsIncluded - sub.seatsUsed} free`}</span>
              <span>Extra seats billed at {formatMoney(sub.pricePerSeat, sub.currency)}</span>
            </div>
            {state !== 'ok' && (
              <p className={cn('mt-3 text-compact leading-[1.5]', state === 'over' ? 'text-tone-risk-foreground' : 'text-tone-warning-foreground')}>
                {state === 'over' ? 'More people than your plan covers; the extra seats are added to your next invoice. Request more seats to fold them into your plan.' : 'Nearly at your allowance. Request more seats before adding many more people.'}
              </p>
            )}
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:h-full">
          <Panel heading="Plan change requests">
            {requests.length === 0 && <p className="mt-3 text-compact text-faint">No plan changes requested yet.</p>}
            <ul>
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 border-b border-divider py-2.5 last:border-b-0">
                  <span className="min-w-0 flex-[1_1_220px]">
                    <span className="block text-ui-sm font-bold text-foreground">
                      {r.plan} · {r.seats} seats
                    </span>
                    <span className="mt-0.5 block text-meta text-faint">
                      {personById(people, r.requestedBy)?.name ?? r.requestedBy} · {fmtIso(r.requestedOn)}
                      {r.note && ` · ${r.note}`}
                    </span>
                  </span>
                  <Badge variant={REQUEST_TONE[r.status]} size="sm">
                    {r.status}
                  </Badge>
                  {r.status === 'Pending' && isAdmin && (
                    <Button variant="outline" size="sm" className="rounded-full font-bold text-tone-risk-foreground" onClick={() => cancel(r.id)}>
                      Withdraw
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel heading="Next invoice" aside={<span className="text-caption text-faint">Generated automatically on {fmtIso(next.issuedOn)}</span>}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-compact text-faint">
                {fmtIso(next.periodFrom)} – {fmtIso(next.periodTo)} · estimate from current seats
              </span>
              <span className="text-xl font-bold tracking-[-0.01em] text-foreground tabular-nums">{formatMoney(next.total, next.currency)}</span>
            </div>
            <ul className="mt-3">
              {next.lines.map((l, n) => (
                <li key={n} className="flex items-baseline justify-between gap-3 border-b border-divider py-2 text-compact last:border-b-0">
                  <span className="min-w-0 text-body">
                    {l.label} <span className="text-faint tabular-nums">× {l.qty}</span>
                  </span>
                  <span className="tabular-nums text-foreground">{formatMoney(lineTotal(l), next.currency)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 text-compact text-faint">
              {next.gst ? `Includes ${formatMoney(next.gst, next.currency)} GST. ` : 'GST exempt. '}Emailed to {contact.email} when issued, due {INVOICE_TERMS_DAYS} days later.
            </div>
          </Panel>
        </div>

        {recent.length > 0 && (
          <Panel heading="Recent payments" className="mt-4" aside={<span className="text-caption text-faint">Bool verifies each transfer, usually within one working day</span>}>
            <PaymentList payments={recent} showInvoice invoiceNumber={numberOf} onReupload={(id) => pay([id])} canReupload={(id) => payableIds.has(id) && paymentsFor(payments, id)[0]?.status === 'Rejected'} />
          </Panel>
        )}

        <Card className="mt-4 gap-0 overflow-clip py-0">
          <div className="flex items-baseline justify-between gap-3 px-[22px] pt-5 pb-3">
            <div className="text-overline text-faint">Invoices</div>
            <span className="text-caption text-faint">{invoices.length} on record</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="h-auto hover:bg-transparent">
                <TableHead>Number</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Due</TableHead>
                <TableHead align="right">Total</TableHead>
                <TableHead align="right">Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((i) => (
                <TableRow key={i.id} className={cn('cursor-pointer', i.status === 'Overdue' && !isUnderReview(i, payments) && 'bg-tone-risk-soft/40')} onClick={() => setInvoice(i)}>
                  <TableCell className="font-mono text-compact font-bold text-foreground">
                    {i.number}
                    {auto.has(i.number) && (
                      <Badge variant="secondary" size="sm" className="ml-2 font-sans" title="Issued automatically">
                        Auto
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-compact">
                    {fmtIso(i.periodFrom)} – {fmtIso(i.periodTo)}
                  </TableCell>
                  <TableCell className={cn('text-compact', i.status === 'Overdue' && !isUnderReview(i, payments) && 'font-bold text-tone-risk-foreground')}>{fmtIso(i.dueOn)}</TableCell>
                  <TableCell align="right" className="text-compact tabular-nums">{formatMoney(i.total, i.currency)}</TableCell>
                  <TableCell align="right">
                    <span className="inline-flex items-center gap-2">
                      {payableIds.has(i.id) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full font-bold"
                          onClick={(e) => {
                            e.stopPropagation()
                            pay([i.id])
                          }}
                        >
                          Pay
                        </Button>
                      )}
                      <Badge variant={DISPLAY_TONE[invoiceDisplayStatus(i, payments)]} size="sm">
                        {invoiceDisplayStatus(i, payments)}
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <ChevronRight className="size-3.5 text-faint" strokeWidth={1.8} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
      <InvoiceDialog
        invoice={invoice}
        payments={invoice ? paymentsFor(payments, invoice.id) : []}
        payable={!!invoice && payableIds.has(invoice.id)}
        onPay={(id) => {
          setInvoice(null)
          pay([id])
        }}
        onClose={() => setInvoice(null)}
      />
      <PayDialog invoiceIds={payFor} onClose={() => setPayFor(null)} />
      <ContactDialog open={editContact} contact={contact} onClose={() => setEditContact(false)} />
      <PlanChangeDialog open={requesting} current={{ plan: sub.plan, seats: sub.seatsIncluded, used: sub.seatsUsed }} onClose={() => setRequesting(false)} />
    </div>
  )
}

function InvoiceDialog({ invoice, payments, payable, onPay, onClose }: { invoice: TenantInvoice | null; payments: PaymentSubmission[]; payable: boolean; onPay: (invoiceId: string) => void; onClose: () => void }) {
  const toast = useToast()
  const i = invoice
  return (
    <Dialog open={!!i} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 px-[26px] py-6 sm:max-w-[560px]" showCloseButton={false}>
        {i && (
          <>
            <DialogHeader className="mb-[18px] gap-0 text-left">
              <div className="flex items-center justify-between gap-3">
                <DialogTitle className="font-mono text-xl font-black tracking-[-0.01em]">{i.number}</DialogTitle>
                <Badge variant={DISPLAY_TONE[invoiceDisplayStatus(i, payments)]} size="sm">
                  {invoiceDisplayStatus(i, payments)}
                </Badge>
              </div>
              <DialogDescription className="mt-1.5 text-compact leading-[1.5] text-faint">
                {fmtIso(i.periodFrom)} – {fmtIso(i.periodTo)} · issued {fmtIso(i.issuedOn)} · {i.paidOn ? `paid ${fmtIso(i.paidOn)}` : `due ${fmtIso(i.dueOn)}`}
              </DialogDescription>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow className="h-auto hover:bg-transparent">
                  <TableHead>Item</TableHead>
                  <TableHead align="right">Qty</TableHead>
                  <TableHead align="right">Unit</TableHead>
                  <TableHead align="right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {i.lines.map((l, n) => (
                  <TableRow key={n} className="hover:bg-transparent">
                    <TableCell className="text-compact">{l.label}</TableCell>
                    <TableCell align="right" className="text-compact tabular-nums">{l.qty}</TableCell>
                    <TableCell align="right" className="text-compact tabular-nums">{formatMoney(l.unitAmount, i.currency)}</TableCell>
                    <TableCell align="right" className="text-compact tabular-nums">{formatMoney(lineTotal(l), i.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3">
              <KeyValue rows={[{ k: 'Subtotal', v: formatMoney(i.subtotal, i.currency) }, { k: i.gst ? 'GST' : 'GST (exempt)', v: formatMoney(i.gst, i.currency), quiet: !i.gst }, { k: 'Total', v: <span className="text-base font-bold text-foreground">{formatMoney(i.total, i.currency)}</span> }]} />
            </div>
            {payments.length > 0 && (
              <div className="mt-5">
                <div className="text-overline text-faint">Payments</div>
                <PaymentList payments={payments} onReupload={onPay} canReupload={() => payable && payments[0]?.status === 'Rejected'} />
              </div>
            )}
            <div className="mt-[22px] flex items-center justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button variant={payable ? 'outline' : 'default'} onClick={() => toast(`Downloading ${i.number}.pdf`)}>
                <Download className="size-4" strokeWidth={1.8} />
                Download PDF
              </Button>
              {payable && <Button onClick={() => onPay(i.id)}>Pay</Button>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ContactDialog({ open, contact, onClose }: { open: boolean; contact: BillingContact; onClose: () => void }) {
  const actions = useBillingActions()
  const toast = useToast()
  const [draft, setDraft] = useState(contact)
  useEffect(() => {
    if (open) setDraft(contact)
  }, [open, contact])
  const set = (k: keyof BillingContact) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }))

  function save() {
    if (!draft.name.trim() || !/^\S+@\S+\.\S+$/.test(draft.email.trim())) return toast('A contact needs a name and a valid email', { ok: false })
    const undo = actions.updateContact({ name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim(), address: draft.address.trim(), tin: draft.tin.trim() })
    toast('Billing contact updated', { undo })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 px-[26px] py-6 sm:max-w-[520px]" showCloseButton={false}>
        <DialogHeader className="mb-[18px] gap-0 text-left">
          <DialogTitle className="text-xl font-black tracking-[-0.01em]">Billing contact</DialogTitle>
          <DialogDescription className="mt-1.5 text-compact leading-[1.5] text-faint">Invoices and payment reminders go here.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
          <div>
            <FieldLabel>Name</FieldLabel>
            <input value={draft.name} onChange={set('name')} className={fieldClass} autoFocus />
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <input type="email" value={draft.email} onChange={set('email')} className={fieldClass} />
          </div>
          <div>
            <FieldLabel>Phone</FieldLabel>
            <input value={draft.phone} onChange={set('phone')} className={fieldClass} />
          </div>
          <div>
            <FieldLabel>TIN</FieldLabel>
            <input value={draft.tin} onChange={set('tin')} className={fieldClass} />
          </div>
        </div>
        <div className="mt-3.5">
          <FieldLabel>Address</FieldLabel>
          <input value={draft.address} onChange={set('address')} className={fieldClass} />
        </div>
        <div className="mt-[22px] flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save contact</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PlanChangeDialog({ open, current, onClose }: { open: boolean; current: { plan: PlanName; seats: number; used: number }; onClose: () => void }) {
  const actions = useBillingActions()
  const toast = useToast()
  const [plan, setPlan] = useState<PlanName>(current.plan)
  const [seats, setSeats] = useState(String(current.seats))
  const [note, setNote] = useState('')
  useEffect(() => {
    if (!open) return
    setPlan(current.plan)
    setSeats(String(current.seats))
    setNote('')
  }, [open, current.plan, current.seats])
  const n = Number(seats)
  const valid = Number.isInteger(n) && n > 0
  const same = plan === current.plan && n === current.seats

  function submit() {
    if (!valid) return toast('Seats must be a whole number above zero', { ok: false })
    if (same) return toast('That is your current plan', { ok: false })
    const undo = actions.requestChange({ plan, seats: n, note: note.trim() })
    toast(`Requested ${plan} with ${n} seats`, { undo })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 px-[26px] py-6 sm:max-w-[480px]" showCloseButton={false}>
        <DialogHeader className="mb-[18px] gap-0 text-left">
          <DialogTitle className="text-xl font-black tracking-[-0.01em]">Request a plan change</DialogTitle>
          <DialogDescription className="mt-1.5 text-compact leading-[1.5] text-faint">Bool reviews the request and confirms when it takes effect. Nothing changes until then.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
          <div>
            <FieldLabel>Plan</FieldLabel>
            <SelectField
              aria-label="Plan"
              value={plan}
              onValueChange={(v) => setPlan(v as PlanName)}
              className="w-full"
              options={PLANS.map((p) => ({ value: p, label: `${p} · MVR ${PLAN_SEAT_PRICE[p]} a seat` }))}
            />
          </div>
          <div>
            <FieldLabel>Seats</FieldLabel>
            <input type="number" min={1} step={1} value={seats} onChange={(e) => setSeats(e.target.value)} className={cn(fieldClass, 'tabular-nums')} />
          </div>
        </div>
        <div className="mt-3.5">
          <FieldLabel hint=" · optional">Note</FieldLabel>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What prompted the change" className={cn(fieldClass, 'h-auto py-2.5')} />
        </div>
        {valid && n < current.used && (
          <Alert variant="warning" className="mt-4">
            <AlertDescription>{current.used} people are on the books — fewer seats than that means some lose access.</AlertDescription>
          </Alert>
        )}
        {valid && (
          <div className="mt-3 text-compact text-faint">
            About {formatMoney(n * PLAN_SEAT_PRICE[plan])} a month before GST.
          </div>
        )}
        <div className="mt-[22px] flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Send request</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
