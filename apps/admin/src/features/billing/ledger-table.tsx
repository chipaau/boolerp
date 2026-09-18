import { useNavigate } from '@tanstack/react-router'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workspace/ui/components/table'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import type { DirectoryTenant } from '@/features/tenants/types'
import { creditModalFor, useInvoiceActions } from './billing-modals'
import type { BillingModal } from './billing-modals'
import { LedgerStatusBadge, signedMvr } from './ledger-bits'
import { formatMvr } from './logic'
import { useInvoicePaymentNotes } from './queries'
import { PaymentNote } from './payment-review'
import type { LedgerLine } from './types'

/** The billing ledger: invoices and credits, with the per-row action and credit/refund shortcut. */
export function LedgerTable({ rows, tenants, onModal, onClear }: { rows: LedgerLine[]; tenants: Map<string, DirectoryTenant>; onModal: (d: BillingModal) => void; onClear: () => void }) {
  // an invoice with a slip awaiting review is verified from the payments panel, never marked paid by hand
  const paymentNotes = useInvoicePaymentNotes()
  const navigate = useNavigate()
  const toast = useToast()
  const actions = useInvoiceActions()

  const act = (e: LedgerLine, t: DirectoryTenant | undefined) => {
    if (e.kind !== 'Invoice') toast(`${e.no} downloaded as PDF.`)
    else if (e.status === 'Paid') toast(`Receipt for ${e.no} downloaded as PDF.`)
    else if (e.status === 'Draft') actions.issue(e, t?.abbr ?? 'the tenant')
    else actions.markPaid(e)
  }

  return (
    <Card className="gap-0 overflow-clip py-0">
      <Table>
        <TableHeader>
          <TableRow className="h-auto hover:bg-transparent">
            <TableHead>Document</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead className="hidden md:table-cell">Period</TableHead>
            <TableHead className="hidden md:table-cell">Due</TableHead>
            <TableHead className="hidden md:table-cell">Amount</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => {
            const t = tenants.get(e.tenantSlug)
            const credit = e.kind !== 'Invoice'
            const sub = credit ? '' : e.tax ? `incl. ${formatMvr(e.tax)} GST` : e.credited ? `${formatMvr(e.credited)} credited` : ''
            return (
              <TableRow key={e.no}>
                <TableCell>
                  <button type="button" className="text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onModal({ kind: 'invoice', no: e.no })}>
                    <div className="font-mono text-caption font-bold text-foreground hover:underline">{e.no}</div>
                    {credit && (
                      <Badge variant="neutral" size="sm" className="mt-1 px-2 py-0 text-micro">
                        {e.kind}
                      </Badge>
                    )}
                  </button>
                  <div className="mt-1 text-meta text-muted-foreground md:hidden">
                    {t?.abbr ?? e.tenantSlug} · {e.period} · {formatMvr(Math.abs(e.total))} · {e.status}
                  </div>
                  {!credit && <div className="md:hidden"><PaymentNote invoiceNo={e.no} /></div>}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-[9px] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => navigate({ to: '/tenants/$slug', params: { slug: e.tenantSlug }, search: { tab: 'billing' } })}
                  >
                    {t?.parentSlug && <span aria-hidden="true" className="h-px w-3 shrink-0 bg-border" />}
                    <div className="min-w-0">
                      <div className="truncate text-ui-sm font-bold text-body">{t?.name ?? '—'}</div>
                      <div className="mt-0.5 text-meta text-muted-foreground">{e.method}</div>
                    </div>
                  </button>
                </TableCell>
                <TableCell className="hidden text-compact text-body md:table-cell">{e.period}</TableCell>
                <TableCell className={cn('hidden text-compact md:table-cell', e.status === 'Overdue' ? 'font-bold text-tone-warning-foreground' : 'text-muted-foreground')}>{e.due}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className={cn('text-ui-sm font-bold tabular-nums', credit ? 'text-link' : 'text-foreground')}>{signedMvr(e)}</div>
                  {sub && <div className="mt-0.5 text-micro text-muted-foreground">{sub}</div>}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <LedgerStatusBadge status={e.status} />
                  {!credit && <PaymentNote invoiceNo={e.no} />}
                </TableCell>
                <TableCell align="right">
                  <div className="flex justify-end gap-1.5">
                    {!credit && e.status !== 'Draft' && (
                      <Button variant="ghost" size="sm" className="text-link" onClick={() => onModal(creditModalFor(e))}>
                        {e.status === 'Paid' ? 'Refund' : 'Credit note'}
                      </Button>
                    )}
                    {(credit || e.status === 'Paid' || e.status === 'Draft' || paymentNotes.get(e.no)?.state !== 'review') && (
                      <Button variant="outline" size="sm" onClick={() => act(e, t)}>
                        {credit ? 'Download' : e.status === 'Paid' ? 'Receipt' : e.status === 'Draft' ? 'Issue' : 'Mark paid'}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {!rows.length && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-[30px] text-center">
                <div className="text-ui-sm text-body">No invoice matches those filters.</div>
                <Button variant="link" size="sm" className="mt-2" onClick={onClear}>
                  Clear filters
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  )
}
