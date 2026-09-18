import { useState } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { FormModal, FormModalField } from '@workspace/ui/components/form-modal'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { SelectField } from '@workspace/ui/components/select'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { AdminUserDialog } from '@/features/admin-users/admin-user-modal'
import { formatMvr, prorate } from '@/features/billing/logic'
import { useBillingActions, useBillingOptions, useCredits, useDunningPolicy, useTenantBilling } from '@/features/billing/queries'
import type { BillingProfile, ChaseTemplate, CreditKind, PaymentMethod, TenantDunningMode } from '@/features/billing/types'
import { childrenOf, planByName, seatPct } from './logic'
import { usePlans, useTenantDirectory, useTenantProfileActions } from './queries'
import type { DirectoryTenant, PlanName } from './types'
import { KeyValueRows, LEDGER_TONE, Overline, PickCard, Radio, SeatBar } from './tenant-detail-bits'

export type TenantModalState =
  | { type: 'plan' }
  | { type: 'parent' }
  | { type: 'admin' }
  | { type: 'billing' }
  | { type: 'dunning' }
  | { type: 'chase' }
  | { type: 'invoice'; no: string }
  | { type: 'credit'; against: string; kind: CreditKind }
  | null

type ModalProps = { tenant: DirectoryTenant; onClose: () => void; onOpen: (d: TenantModalState) => void }

/** Every modal the tenant detail screen opens, keyed by `modal.type`. */
export function TenantModals({ tenant, modal, onClose, onOpen }: ModalProps & { modal: TenantModalState }) {
  if (!modal) return null
  const p = { tenant, onClose, onOpen }
  switch (modal.type) {
    case 'plan':
      return <PlanModal {...p} />
    case 'parent':
      return <ParentModal {...p} />
    case 'admin':
      return <AdminModal {...p} />
    case 'billing':
      return <BillingDetailsModal {...p} />
    case 'dunning':
      return <DunningModal {...p} />
    case 'chase':
      return <ChaseModal {...p} />
    case 'invoice':
      return <InvoiceModal key={modal.no} {...p} no={modal.no} />
    case 'credit':
      return <CreditModal key={modal.against} {...p} against={modal.against} initialKind={modal.kind} />
  }
}

// ------------------------------------------------------------------------------------------
// Plan & seats
// ------------------------------------------------------------------------------------------

function PlanModal({ tenant: t, onClose }: ModalProps) {
  const plans = usePlans()
  const { cycleDays, daysLeft, nextCycleDate } = useBillingOptions()
  const { setPlan } = useTenantProfileActions()
  const toast = useToast()
  const [plan, setPlanName] = useState<PlanName>(t.plan)
  const [seats, setSeats] = useState(t.seatLimit)
  const [effect, setEffect] = useState<'Immediately' | 'Next cycle'>('Immediately')

  const from = planByName(plans, t.plan)
  const to = planByName(plans, plan)
  const { newMonthly, delta } = prorate(from, to, t.seatsUsed, effect, cycleDays, daysLeft)
  const prorateLabel =
    effect !== 'Immediately'
      ? `No charge now. ${formatMvr(newMonthly)} from the October invoice.`
      : !delta
        ? 'No price change, so nothing is prorated.'
        : delta > 0
          ? `A prorated ${formatMvr(delta)} is added to the September invoice.`
          : `A prorated credit of ${formatMvr(-delta)} goes back on the September invoice.`

  const save = () => {
    const undo = setPlan(t.slug, plan, seats, t)
    onClose()
    toast(
      effect === 'Immediately'
        ? `${t.abbr} moved to ${plan} with ${seats} seats${delta ? ' · ' + (delta > 0 ? `${formatMvr(delta)} prorated onto September` : `${formatMvr(-delta)} credited back`) : ''}.`
        : `${t.abbr} will move to ${plan} with ${seats} seats on ${nextCycleDate}.`,
      { undo },
    )
  }

  return (
    <FormModal
      open
      title="Plan & seats"
      note={`${t.name} · currently ${t.plan} with ${t.seatLimit} seats, ${t.seatsUsed} in use.`}
      warn={seats < t.seatsUsed ? `That is below the ${t.seatsUsed} seats already in use. People would be locked out at their next sign-in.` : undefined}
      saveLabel="Apply changes"
      onSave={save}
      onClose={onClose}
    >
      <SubLabel>Plan</SubLabel>
      <div role="radiogroup" className="grid grid-cols-2 gap-[9px]">
        {plans.map((p) => (
          <PickCard
            key={p.name}
            selected={plan === p.name}
            title={<span className="font-black">{p.name}</span>}
            note={`${p.note} · ${p.seats} seats`}
            onPick={() => {
              setPlanName(p.name)
              setSeats(p.seats)
            }}
          />
        ))}
      </div>

      <div className="mt-4 rounded-[13px] border border-divider bg-surface-band px-[18px] py-4">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="min-w-0">
            <div className="text-[11.5px] font-bold text-muted-foreground">Seat limit</div>
            <div className="mt-1 text-[11.5px] leading-[1.45] text-muted-foreground">{t.seatsUsed} seats are in use today.</div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Button variant="outline" size="icon-sm" aria-label="Fewer seats" onClick={() => setSeats((s) => Math.max(10, s - 10))}>
              −
            </Button>
            <span className="min-w-14 text-center text-[19px] font-black text-foreground tabular-nums">{seats}</span>
            <Button variant="outline" size="icon-sm" aria-label="More seats" onClick={() => setSeats((s) => s + 10)}>
              +
            </Button>
          </div>
        </div>
        <SeatBar className="mt-3.5" pct={seatPct({ seatsUsed: t.seatsUsed, seatLimit: Math.max(seats, 1) })} />
      </div>

      <SubLabel className="mt-5">When it takes effect</SubLabel>
      <div role="radiogroup" className="grid grid-cols-2 gap-[9px]">
        <PickCard selected={effect === 'Immediately'} title="Take effect today" note={`Prorated for the ${daysLeft} days left in this cycle.`} onPick={() => setEffect('Immediately')} />
        <PickCard selected={effect === 'Next cycle'} title="Start next cycle" note={`Nothing changes until ${nextCycleDate}.`} onPick={() => setEffect('Next cycle')} />
      </div>
      <p className="mt-3 text-xs leading-[1.5] text-muted-foreground">{prorateLabel}</p>
    </FormModal>
  )
}

// ------------------------------------------------------------------------------------------
// Parent tenant
// ------------------------------------------------------------------------------------------

function ParentModal({ tenant: t, onClose }: ModalProps) {
  const { tenants } = useTenantDirectory()
  const { setParent } = useTenantProfileActions()
  const toast = useToast()
  const [parent, setParentSlug] = useState(t.parentSlug ?? '')
  const kids = childrenOf(tenants, t.slug)
  const options = [
    { slug: '', name: 'No parent — standalone', tag: kids.length ? `${kids.length} children` : '' },
    ...tenants.filter((x) => x.slug !== t.slug && !x.parentSlug).map((x) => ({ slug: x.slug, name: x.name, tag: x.plan })),
  ]

  const save = () => {
    const undo = setParent(t.slug, parent || null, t)
    onClose()
    const p = tenants.find((x) => x.slug === parent)
    toast(p ? `${t.abbr} now sits under ${p.abbr}.` : `${t.abbr} is standalone again.`, { undo })
  }

  return (
    <FormModal
      open
      title="Parent tenant"
      note="Child tenants keep their own data and admin users, and roll up to the parent for plan and reporting."
      warn={kids.length ? `${t.abbr} already has ${kids.length} child tenant(s), so it cannot become a child itself.` : undefined}
      saveLabel="Save hierarchy"
      onSave={save}
      onClose={onClose}
    >
      <SubLabel>Parent tenant</SubLabel>
      <div role="radiogroup" className="flex flex-col gap-2">
        {options.map((o) => {
          const blocked = kids.length > 0 && o.slug !== ''
          return (
            <button
              key={o.slug || 'none'}
              type="button"
              role="radio"
              aria-checked={parent === o.slug}
              onClick={() => (blocked ? toast(`${t.abbr} has child tenants, so it cannot also be a child.`, { ok: false }) : setParentSlug(o.slug))}
              className={cn(
                'flex items-center gap-[11px] rounded-xl border px-3.5 py-3 text-left transition-colors duration-instant ease-bool',
                parent === o.slug ? 'border-sage bg-sage-soft' : 'border-divider hover:bg-accent',
                blocked && 'opacity-45',
              )}
            >
              <Radio on={parent === o.slug} />
              <span className="text-ui-sm font-bold text-foreground">{o.name}</span>
              {o.tag && (
                <Badge variant="secondary" size="sm" className="ms-auto">
                  {o.tag}
                </Badge>
              )}
            </button>
          )
        })}
      </div>
    </FormModal>
  )
}

// ------------------------------------------------------------------------------------------
// Add a tenant admin
// ------------------------------------------------------------------------------------------

/** "Add an admin" on a tenant: the shared admin-user stepped dialog with this tenant preselected and the role fixed. */
function AdminModal({ tenant: t, onClose }: ModalProps) {
  return <AdminUserDialog open tenant={t} onClose={onClose} />
}

// ------------------------------------------------------------------------------------------
// Billing details
// ------------------------------------------------------------------------------------------

function BillingDetailsModal({ tenant: t, onClose }: ModalProps) {
  const { profile } = useTenantBilling(t.slug)
  const { paymentMethods } = useBillingOptions()
  const { saveProfile } = useBillingActions()
  const toast = useToast()
  const [f, setF] = useState<BillingProfile>(profile)
  const set = <TKey extends keyof BillingProfile>(k: TKey, v: BillingProfile[TKey]) => setF((s) => ({ ...s, [k]: v }))

  const save = () => {
    const undo = saveProfile(t.slug, f)
    onClose()
    toast(`Billing details saved. Future invoices for ${t.abbr} go to ${f.email || 'the same address'}.`, { undo })
  }

  return (
    <FormModal
      open
      title="Billing details"
      note={`${t.name} · who gets the invoice, and what has to appear on it.`}
      warn={f.email.includes('@') ? undefined : 'Invoices need a working e-mail or they will bounce into nowhere.'}
      saveLabel="Save billing details"
      onSave={save}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-x-[18px] gap-y-4">
        <FormModalField label="Billing contact">
          <Input value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Ibrahim Waheed" />
        </FormModalField>
        <FormModalField label="Invoices go to">
          <Input value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="finance@tenant.gov.mv" />
        </FormModalField>
        <FormModalField label="Contact number">
          <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="3324570" />
        </FormModalField>
        <FormModalField label="Payment method">
          <SelectField aria-label="Payment method" value={f.method} onValueChange={(v) => set('method', v as PaymentMethod)} options={paymentMethods} />
        </FormModalField>
        <FormModalField label="Tax registration" hint="Leave as exempt for government bodies.">
          <Input value={f.taxId} onChange={(e) => set('taxId', e.target.value)} placeholder="GST 1024-VC" />
        </FormModalField>
        <FormModalField label="GST rate (%)">
          <SelectField aria-label="GST rate" value={String(f.taxRate)} onValueChange={(v) => set('taxRate', Number(v) as 0 | 8)} options={['0', '8']} />
        </FormModalField>
        <FormModalField label="PO reference" wide hint="Printed on every invoice — most government tenants will not pay without it.">
          <Input value={f.po} onChange={(e) => set('po', e.target.value)} placeholder="PO-2026-114" />
        </FormModalField>
      </div>
    </FormModal>
  )
}

// ------------------------------------------------------------------------------------------
// Per-tenant dunning
// ------------------------------------------------------------------------------------------

function DunningModal({ tenant: t, onClose }: ModalProps) {
  const { dunningMode } = useTenantBilling(t.slug)
  const { dunningModes } = useBillingOptions()
  const { setTenantDunning } = useBillingActions()
  const toast = useToast()
  const [mode, setMode] = useState<TenantDunningMode>(dunningMode)

  const save = () => {
    const undo = setTenantDunning(t.slug, mode)
    onClose()
    toast(mode === 'Platform policy' ? `${t.abbr} follows the platform dunning policy again.` : `${t.abbr} now uses: ${mode}.`, { undo })
  }

  return (
    <FormModal
      open
      title={`Dunning for ${t.abbr}`}
      note="What happens when this tenant misses a due date."
      warn={mode === 'No automated chasing' ? 'Nobody will be reminded automatically. Someone has to watch this tenant by hand.' : undefined}
      saveLabel="Save policy"
      onSave={save}
      onClose={onClose}
    >
      <FormModalField label="Policy" wide hint="Overrides only this tenant. Everyone else keeps the platform policy.">
        <SelectField aria-label="Policy" value={mode} onValueChange={(v) => setMode(v as TenantDunningMode)} options={dunningModes} />
      </FormModalField>
    </FormModal>
  )
}

// ------------------------------------------------------------------------------------------
// Chase this tenant's open invoices
// ------------------------------------------------------------------------------------------

function ChaseModal({ tenant: t, onClose }: ModalProps) {
  const { ledger, profile } = useTenantBilling(t.slug)
  const { chaseTemplates } = useBillingOptions()
  const policy = useDunningPolicy()
  const toast = useToast()
  const open = ledger.filter((e) => e.kind === 'Invoice' && (e.status === 'Due' || e.status === 'Overdue'))
  const [tpl, setTpl] = useState<ChaseTemplate>('Polite nudge')
  const [skip, setSkip] = useState<Record<string, boolean>>({})
  const picks = open.filter((e) => !skip[e.no])
  const owed = (e: (typeof open)[number]) => e.total - e.credited

  const save = () => {
    if (!picks.length) {
      toast('Pick at least one invoice to chase.', { ok: false })
      return
    }
    onClose()
    toast(`${tpl} sent for ${picks.length} invoice(s) — ${formatMvr(picks.reduce((n, e) => n + e.total, 0))} chased.`)
  }

  return (
    <FormModal
      open
      size="lg"
      title="Chase open invoices"
      note={`${open.length} invoice(s) are issued and unpaid. Pick who gets a reminder and what it says.`}
      warn={tpl === 'Final notice before suspension' ? 'A final notice states the date access stops. It should not be the first thing a tenant hears.' : undefined}
      saveLabel={picks.length ? `Send ${picks.length} reminder${picks.length === 1 ? '' : 's'}` : 'Nothing selected'}
      onSave={save}
      onClose={onClose}
    >
      {open.map((e) => {
        const on = !skip[e.no]
        return (
          <button
            key={e.no}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => setSkip((s) => ({ ...s, [e.no]: on }))}
            className={cn('mb-2 flex w-full items-center gap-[11px] rounded-xl border px-3.5 py-[13px] text-left', on ? 'border-sage bg-sage-soft' : 'border-divider')}
          >
            <span className={cn('grid size-[18px] shrink-0 place-items-center rounded-[5px] text-[11px] font-bold text-sage-foreground', on ? 'bg-sage' : 'shadow-[inset_0_0_0_1.5px_var(--border)]')}>{on ? '✓' : ''}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-ui-sm font-bold text-foreground">{t.name}</div>
              <div className="mt-[3px] truncate text-[11.5px] text-muted-foreground">
                {e.no} · {profile.contact} · {profile.email}
              </div>
              <div className={cn('mt-[3px] text-[11.5px] font-bold', e.status === 'Overdue' ? 'text-tone-warning-foreground' : 'text-muted-foreground')}>
                {e.status === 'Overdue' ? `Overdue · next step at day +${policy.warn}` : `Due ${e.due}`}
              </div>
            </div>
            <span className="shrink-0 text-ui-sm font-black text-foreground">{formatMvr(owed(e))}</span>
          </button>
        )
      })}
      <div className="mt-1.5 text-compact font-bold text-muted-foreground">{formatMvr(picks.reduce((n, e) => n + owed(e), 0))} chased in total</div>
      <div className="mt-5">
        <FormModalField label="Message" wide hint="Sent to each tenant’s billing contact, copied to their tenant admins on a final notice.">
          <SelectField aria-label="Message" value={tpl} onValueChange={(v) => setTpl(v as ChaseTemplate)} options={chaseTemplates} />
        </FormModalField>
      </div>
    </FormModal>
  )
}

// ------------------------------------------------------------------------------------------
// Invoice / credit document
// ------------------------------------------------------------------------------------------

function InvoiceModal({ tenant: t, onClose, onOpen, no }: ModalProps & { no: string }) {
  const { ledger, profile: pf } = useTenantBilling(t.slug)
  const credits = useCredits()
  const plans = usePlans()
  const policy = useDunningPolicy()
  const { dunningMode } = useTenantBilling(t.slug)
  const { markPaid, issue } = useBillingActions()
  const toast = useToast()
  const e = ledger.find((x) => x.no === no)
  if (!e) return null
  const credit = e.kind !== 'Invoice'
  const plan = planByName(plans, t.plan)
  const against = credits.filter((c) => c.against === e.no)
  const lines = credit
    ? [{ label: e.reason ?? 'Adjustment', qty: `Against ${e.against}`, value: `− ${formatMvr(Math.abs(e.net))}` }]
    : [
        { label: `${plan.name} plan, monthly base`, qty: `1 × ${formatMvr(plan.base)}`, value: formatMvr(plan.base) },
        { label: 'Seats in use', qty: `${t.seatsUsed} × ${formatMvr(plan.perSeat)}`, value: formatMvr(plan.perSeat * t.seatsUsed) },
        ...against.map((c) => ({ label: `${c.kind} ${c.no}`, qty: c.reason, value: `− ${formatMvr(c.amount)}` })),
      ]
  const timeline = credit
    ? [{ when: e.due, what: `${e.kind} issued`, who: 'Mariyam Ahmed' }]
    : [
        { when: e.issued || '—', what: `Invoice issued to ${pf.email}`, who: e.status === 'Draft' ? 'Not sent yet' : 'Sent automatically' },
        { when: e.due, what: 'Payment due', who: e.status === 'Overdue' ? 'Missed — reminders running' : e.status === 'Paid' ? 'Settled' : 'Not yet due' },
        ...against.map((c) => ({ when: c.date, what: `${c.kind} ${c.no} for ${formatMvr(c.amount)}`, who: c.reason })),
        ...(e.status === 'Paid' ? [{ when: '—', what: 'Paid in full', who: pf.method }] : []),
      ]

  const primary = () => {
    if (e.status === 'Draft') {
      const undo = issue(e.no)
      toast(`${e.no} issued to ${pf.email}.`, { undo })
    } else {
      const undo = markPaid(e.no)
      toast(`${e.no} marked paid. A receipt goes to ${pf.email}.`, { undo })
    }
  }

  return (
    <FormModal
      open
      size="lg"
      title={e.no}
      note={`${t.name} · ${e.kind} for ${e.period} · ${e.status}`}
      warn={
        e.status === 'Overdue'
          ? 'Past due. ' + (dunningMode === 'Platform policy' ? `Platform dunning is running — suspension warning at day +${policy.warn}.` : `${dunningMode} applies to this tenant.`)
          : undefined
      }
      saveLabel="Download PDF"
      onSave={() => {
        onClose()
        toast(`${e.no} downloaded as PDF.`)
      }}
      onClose={onClose}
    >
      <div className="rounded-[14px] border border-divider bg-surface-band px-[22px] py-5">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3.5">
          <Overline>Lines</Overline>
          <Badge variant={LEDGER_TONE[e.status]} size="sm">
            {e.status}
          </Badge>
        </div>
        {lines.map((l) => (
          <div key={l.label} className="flex items-center justify-between gap-3.5 border-b border-divider py-3">
            <div className="min-w-0">
              <div className="text-ui-sm font-bold text-foreground">{l.label}</div>
              <div className="mt-[3px] text-[11.5px] text-muted-foreground">{l.qty}</div>
            </div>
            <span className="text-ui-sm font-bold whitespace-nowrap text-body">{l.value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3.5 border-b border-divider py-3">
          <span className="text-compact text-body">{e.tax ? `GST at ${pf.taxRate}%` : 'GST — exempt'}</span>
          <span className="text-ui-sm font-bold text-body">{e.tax ? formatMvr(e.tax) : '—'}</span>
        </div>
        <div className="flex items-center justify-between gap-3.5 pt-3.5">
          <span className="text-compact text-muted-foreground">Total</span>
          <span className="text-[21px] font-black tracking-[-0.02em] text-foreground">
            {credit ? '− ' : ''}
            {formatMvr(Math.abs(e.total))}
          </span>
        </div>
      </div>

      <Overline className="mt-[22px] mb-1">Billed to</Overline>
      <KeyValueRows
        rows={[
          { label: 'Tenant', value: t.name },
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
          <span className="text-compact text-muted-foreground">{ev.when}</span>
          <div className="min-w-0">
            <div className="text-ui-sm leading-[1.45] text-foreground">{ev.what}</div>
            <div className="mt-[3px] text-[11.5px] text-muted-foreground">{ev.who}</div>
          </div>
        </div>
      ))}

      <div className="mt-5 flex flex-wrap gap-2.5">
        {!credit && e.status !== 'Paid' && (
          <Button variant="outline" onClick={primary}>
            {e.status === 'Draft' ? 'Issue invoice' : 'Mark paid'}
          </Button>
        )}
        {!credit && e.status !== 'Draft' && (
          <Button variant="outline" onClick={() => onOpen({ type: 'credit', against: e.no, kind: e.status === 'Paid' ? 'Refund' : 'Credit note' })}>
            {e.status === 'Paid' ? 'Refund' : 'Credit note'}
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>
          Open tenant
        </Button>
      </div>
    </FormModal>
  )
}

// ------------------------------------------------------------------------------------------
// Credit note / refund
// ------------------------------------------------------------------------------------------

function CreditModal({ tenant: t, onClose, against, initialKind }: ModalProps & { against: string; initialKind: CreditKind }) {
  const { ledger } = useTenantBilling(t.slug)
  const { issueCredit } = useBillingActions()
  const toast = useToast()
  const line = ledger.find((x) => x.no === against)
  const cap = line?.total ?? 0
  const [kind, setKind] = useState<CreditKind>(initialKind)
  const [amount, setAmount] = useState(String(cap))
  const [reason, setReason] = useState('')
  const amt = Math.round(Number(amount || 0))
  const isRefund = kind === 'Refund'

  const save = () => {
    if (!(amt > 0)) {
      toast('Put an amount on the credit before issuing it.', { ok: false })
      return
    }
    if (amt > cap) {
      toast(`Credits cannot exceed the ${formatMvr(cap)} on ${against}.`, { ok: false })
      return
    }
    const { no, undo } = issueCredit({ tenantSlug: t.slug, against, kind, amount: amt, reason })
    onClose()
    toast(`${no} issued for ${formatMvr(amt)} against ${against}.`, { undo })
  }

  return (
    <FormModal
      open
      title={isRefund ? 'Refund a payment' : 'Issue a credit note'}
      note={`${isRefund ? 'Money goes back to ' : 'Credit is applied against '}${against} for ${t.name}.`}
      warn={amt > cap ? `That is more than the ${formatMvr(cap)} on ${against}. Credits cannot exceed the original document.` : undefined}
      saveLabel={isRefund ? 'Issue refund' : 'Issue credit note'}
      onSave={save}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-x-[18px] gap-y-4">
        <FormModalField label="Type" hint="A credit note reduces what they owe. A refund returns money already paid.">
          <SelectField aria-label="Type" value={kind} onValueChange={(v) => setKind(v as CreditKind)} options={['Credit note', 'Refund']} />
        </FormModalField>
        <FormModalField label="Amount (MVR)">
          <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </FormModalField>
        <FormModalField label="Reason shown on the document" wide>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Seat count corrected after a mid-month leaver" />
        </FormModalField>
      </div>
    </FormModal>
  )
}

function SubLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-[9px] text-[11.5px] font-bold tracking-[0.03em] text-muted-foreground', className)}>{children}</div>
}
