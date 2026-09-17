import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Switch } from '@workspace/ui/components/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workspace/ui/components/table'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { formatMvr } from '@/features/billing/logic'
import { useBillingActions, useDunningPolicy, useTenantBilling } from '@/features/billing/queries'
import { PaymentNote } from '@/features/billing/payment-review'
import type { LedgerLine } from '@/features/billing/types'
import type { DirectoryTenant } from './types'
import type { TenantDrawerState } from './tenant-drawers'
import { DetailCard, KeyValueRows, LEDGER_TONE, LinkAction, Overline, initials } from './tenant-detail-bits'

/** Tenant detail › Billing: what they pay, billing contact, group invoicing and their ledger. */
export function TenantBillingTab({ tenant: t, onOpen }: { tenant: DirectoryTenant; onOpen: (d: TenantDrawerState) => void }) {
  const b = useTenantBilling(t.slug)
  const policy = useDunningPolicy()
  const { markPaid, issue, setGroupBilling } = useBillingActions()
  const toast = useToast()
  const { profile: pf } = b

  const dunLabel =
    b.dunningMode === 'Platform policy'
      ? `Platform policy · reminders at +${policy.r1} and +${policy.r2}, warning at +${policy.warn}${policy.auto ? `, auto-suspend at +${policy.susp}` : ', no auto-suspend'}`
      : b.dunningMode

  const remind = () => (b.openCount ? onOpen({ type: 'chase' }) : toast(`Nothing outstanding for ${t.abbr}.`))

  const act = (e: LedgerLine) => {
    if (e.kind !== 'Invoice') return toast(`${e.no} downloaded as PDF.`)
    if (e.status === 'Paid') return toast(`Receipt for ${e.no} downloaded as PDF.`)
    if (e.status === 'Draft') return toast(`${e.no} issued to ${t.abbr}.`, { undo: issue(e.no) })
    toast(`${e.no} marked paid. A receipt goes to ${pf.email}.`, { undo: markPaid(e.no) })
  }

  return (
    <div>
      <div className="mb-[18px] grid items-start gap-[18px] lg:grid-cols-2">
        <DetailCard heading="What they pay" aside={<LinkAction onClick={() => onOpen({ type: 'plan' })}>Change plan</LinkAction>}>
          {b.estimate.lines.map((l) => (
            <div key={l.label} className="flex items-center justify-between gap-4 border-b border-divider py-3 last:border-b-0">
              <span className="text-compact text-body">{l.label}</span>
              <span className={cn('whitespace-nowrap text-foreground', l.strong ? 'text-ui-lg font-bold' : 'text-ui-sm font-bold')}>{l.value === null ? '—' : formatMvr(l.value)}</span>
            </div>
          ))}
        </DetailCard>

        <DetailCard heading="Billing contact" aside={<LinkAction onClick={() => onOpen({ type: 'billing' })}>Edit</LinkAction>}>
          <div className="mt-1.5 flex items-center gap-[13px] rounded-[13px] border border-divider bg-surface-band px-4 py-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-soft text-compact font-bold text-muted-foreground">{initials(pf.contact)}</span>
            <div className="min-w-0">
              <div className="text-ui-sm font-bold text-foreground">{pf.contact}</div>
              <div className="mt-[3px] truncate text-caption text-muted-foreground">
                {pf.email} · {pf.phone}
              </div>
            </div>
            <span className="flex-1" />
            <Badge size="sm" variant={b.openCount ? (b.hasOverdue ? 'warning' : 'slate') : 'success'}>
              {b.openCount ? `${formatMvr(b.openTotal)} across ${b.openCount} open invoice(s)` : 'Nothing outstanding'}
            </Badge>
          </div>
          {!b.contactSet && <p className="mt-3 text-caption leading-[1.5] text-tone-warning-foreground">No billing contact yet — invoices fall back to the tenant e-mail.</p>}

          <Overline className="mt-5 mb-0.5">Invoice details</Overline>
          <KeyValueRows
            rows={[
              { label: 'Tax registration', value: pf.taxId },
              { label: 'PO reference', value: pf.po },
              { label: 'Payment method', value: pf.method },
              { label: 'Cycle', value: 'Monthly · issued on the 1st, due in 14 days' },
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5">
            <Badge size="sm" variant={b.dunningMode === 'Platform policy' ? 'secondary' : 'slate'} className="whitespace-normal">
              {dunLabel}
            </Badge>
            <LinkAction onClick={() => onOpen({ type: 'dunning' })}>Change dunning</LinkAction>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2.5">
            <Button variant="outline" onClick={remind}>
              Send a payment reminder
            </Button>
            <Button variant="outline" onClick={() => toast(`${b.ledger.length} ledger lines for ${t.abbr} exported as CSV.`)}>
              Export CSV
            </Button>
          </div>
        </DetailCard>
      </div>

      {b.group && (
        <DetailCard className="mb-[18px]">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Overline>Group invoicing</Overline>
              <p className="mt-1.5 text-compact leading-[1.5] text-muted-foreground">
                {b.group.enabled ? `Children are billed on one invoice addressed to ${t.abbr}. Their own invoices stop being issued.` : 'Each child tenant is invoiced separately today.'}
              </p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2.5">
              <Switch
                checked={b.group.enabled}
                onCheckedChange={(on) => {
                  const undo = setGroupBilling(t.slug, on)
                  toast(on ? `${t.abbr} will be billed as one group invoice from next cycle.` : `Child tenants of ${t.abbr} go back to separate invoices.`, { undo })
                }}
              />
              <span className="text-compact font-bold text-body">Bill as one group invoice</span>
            </label>
          </div>
          {b.group.lines.map((l) => (
            <div key={l.slug} className="flex items-center justify-between gap-3.5 border-b border-divider py-[11px]">
              <div className="min-w-0">
                <div className="text-ui-sm font-bold text-foreground">{l.name}</div>
                <div className="mt-[3px] text-fine text-muted-foreground">{l.detail}</div>
              </div>
              <span className="text-ui-sm font-bold whitespace-nowrap text-body">{formatMvr(l.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3.5 pt-3.5">
            <span className="text-compact text-muted-foreground">Group total each month</span>
            <span className="text-ui-lg font-bold text-foreground">{formatMvr(b.group.total)}</span>
          </div>
          {b.group.enabled && (
            <Button
              variant="outline"
              className="mt-4 self-start"
              onClick={() => toast(`Consolidated invoice for ${t.abbr} prepared — ${b.group!.lines.length} line items, ${formatMvr(b.group!.total)}.`)}
            >
              Issue one consolidated invoice
            </Button>
          )}
        </DetailCard>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead className="hidden md:table-cell">Period</TableHead>
              <TableHead className="hidden md:table-cell">Due</TableHead>
              <TableHead className="hidden md:table-cell">Amount</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {b.ledger.map((e) => {
              const credit = e.kind !== 'Invoice'
              const sub = credit ? '' : e.tax ? `incl. ${formatMvr(e.tax)} GST` : e.credited ? `${formatMvr(e.credited)} credited` : ''
              const alt = credit || e.status === 'Draft' ? null : e.status === 'Paid' ? 'Refund' : 'Credit note'
              return (
                <TableRow key={e.no}>
                  <TableCell>
                    <button type="button" onClick={() => onOpen({ type: 'invoice', no: e.no })} className="text-left hover:underline">
                      <span className="block font-mono text-meta font-bold text-foreground">{e.no}</span>
                    </button>
                    {credit && (
                      <Badge variant="secondary" size="sm" className="mt-1 px-2 py-0 text-micro">
                        {e.kind}
                      </Badge>
                    )}
                    <span className="mt-1 block text-caption text-muted-foreground md:hidden">
                      {e.period} · {formatMvr(Math.abs(e.total))} · {e.status}
                    </span>
                    {!credit && <div className="md:hidden"><PaymentNote invoiceNo={e.no} /></div>}
                  </TableCell>
                  <TableCell className="hidden text-compact text-body md:table-cell">{e.period}</TableCell>
                  <TableCell className={cn('hidden text-compact md:table-cell', e.status === 'Overdue' ? 'font-bold text-tone-warning-foreground' : 'text-muted-foreground')}>{e.due}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className={cn('text-ui-sm font-bold', credit ? 'text-link' : 'text-foreground')}>
                      {credit ? '− ' : ''}
                      {formatMvr(Math.abs(e.total))}
                    </div>
                    {sub && <div className="mt-[3px] text-micro text-muted-foreground">{sub}</div>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge size="sm" variant={LEDGER_TONE[e.status]}>
                      {e.status}
                    </Badge>
                    {!credit && <PaymentNote invoiceNo={e.no} />}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      {alt && (
                        <Button variant="link" size="xs" onClick={() => onOpen({ type: 'credit', against: e.no, kind: e.status === 'Paid' ? 'Refund' : 'Credit note' })}>
                          {alt}
                        </Button>
                      )}
                      <Button variant="outline" size="xs" onClick={() => act(e)}>
                        {credit ? 'Download' : e.status === 'Paid' ? 'Receipt' : e.status === 'Draft' ? 'Issue' : 'Mark paid'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {!b.ledger.length && <p className="px-5 py-[26px] text-center text-compact text-muted-foreground">No invoice has been raised for this tenant yet.</p>}
      </Card>
    </div>
  )
}
