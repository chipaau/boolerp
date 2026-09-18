import { useState } from 'react'
import { Check, FileText, ImageIcon, TriangleAlert, X } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { SelectField } from '@workspace/ui/components/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workspace/ui/components/table'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import type { DirectoryTenant } from '@/features/tenants/types'
import { KeyValueRows, Overline } from './ledger-bits'
import { formatBytes, formatIsoDate, formatMvr } from './logic'
import { useInvoicePaymentNotes, usePaymentActions, usePaymentRejectReasons, usePaymentsToVerify } from './queries'
import type { PaymentToVerify } from './queries'

/** Billing › "Payments to verify": pending bank-transfer submissions with a Review action. */
export function PaymentsToVerifyPanel({ tenants, focused }: { tenants: Map<string, DirectoryTenant>; focused: boolean }) {
  const pending = usePaymentsToVerify()
  const [openId, setOpenId] = useState<string | null>(null)
  const open = pending.find((p) => p.submission.id === openId) ?? null

  if (!pending.length && !focused) return null

  return (
    <section id="payments-to-verify" className="mb-6 scroll-mt-6">
      <div className="mb-3 flex items-center gap-2.5">
        <h2 className="text-ui-lg font-bold text-foreground">Payments to verify</h2>
        <Badge variant={pending.length ? 'warning' : 'success'} size="sm">
          {pending.length}
        </Badge>
        <span className="text-caption text-muted-foreground">Bank transfers tenants have reported. Check the slip against the statement, then verify.</span>
      </div>
      <Card className="gap-0 overflow-clip py-0">
        {pending.length ? (
          <Table>
            <TableHeader>
              <TableRow className="h-auto hover:bg-transparent">
                <TableHead>Tenant</TableHead>
                <TableHead className="hidden md:table-cell">Invoice</TableHead>
                <TableHead className="hidden md:table-cell">Amount</TableHead>
                <TableHead className="hidden lg:table-cell">Bank · reference</TableHead>
                <TableHead className="hidden lg:table-cell">Paid on</TableHead>
                <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((p) => {
                const s = p.submission
                const t = tenants.get(p.tenantSlug)
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="truncate text-ui-sm font-bold text-body">{t?.name ?? p.tenantSlug}</div>
                      <div className="mt-1 text-meta text-muted-foreground md:hidden">
                        {s.invoiceId} · {formatMvr(s.amount)}
                        {!p.amountMatches && ' · amount differs'}
                      </div>
                    </TableCell>
                    <TableCell className="hidden font-mono text-caption font-bold text-foreground md:table-cell">{s.invoiceId}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-ui-sm font-bold text-foreground tabular-nums">{formatMvr(s.amount)}</div>
                      <div className={cn('mt-0.5 text-micro', p.amountMatches ? 'text-muted-foreground' : 'font-bold text-tone-warning-foreground')}>
                        {p.amountMatches ? 'Matches invoice' : `Invoice is ${formatMvr(p.expected)}`}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="text-compact font-bold text-body">{s.bank}</div>
                      <div className="mt-0.5 font-mono text-micro text-muted-foreground">{s.reference}</div>
                    </TableCell>
                    <TableCell className="hidden text-compact text-body lg:table-cell">{formatIsoDate(s.paidOn)}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="text-compact text-body">{p.submitterName}</div>
                      <div className="mt-0.5 text-micro text-muted-foreground">{formatIsoDate(s.submittedOn)}</div>
                    </TableCell>
                    <TableCell align="right">
                      <Button variant="outline" size="sm" onClick={() => setOpenId(s.id)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="px-5 py-[26px] text-center text-compact text-muted-foreground">No payments waiting. Tenants’ bank-transfer slips show up here.</p>
        )}
      </Card>
      {open && <PaymentReviewDialog item={open} tenant={tenants.get(open.tenantSlug)} onClose={() => setOpenId(null)} />}
    </section>
  )
}

/** Review one submission: slip, details, checks, then Verify payment or Reject with a reason. */
export function PaymentReviewDialog({ item, tenant, onClose }: { item: PaymentToVerify; tenant: DirectoryTenant | undefined; onClose: () => void }) {
  const { submission: s } = item
  const { verify, reject } = usePaymentActions()
  const reasons = usePaymentRejectReasons()
  const toast = useToast()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const isPdf = s.receipt.mimeType === 'application/pdf'
  const who = tenant?.abbr ?? item.tenantSlug

  const onVerify = () => {
    const undo = verify(s.id)
    toast(`Payment for ${s.invoiceId} verified — invoice marked paid and ${who} gets a receipt.`, { undo })
    onClose()
  }
  const finalReason = [reason, detail.trim()].filter(Boolean).join(' — ')
  const onReject = () => {
    const undo = reject(s.id, finalReason)
    toast(`Payment for ${s.invoiceId} rejected. ${who} is told why and can resubmit.`, { undo })
    onClose()
  }

  const checks = [
    { label: 'Reference matches the invoice number', ok: item.referenceMatches, note: item.referenceMatches ? s.reference : `“${s.reference}” doesn’t mention ${s.invoiceId}` },
    { label: 'Amount matches', ok: item.amountMatches, note: item.amountMatches ? formatMvr(s.amount) : `Paid ${formatMvr(s.amount)}, invoice is ${formatMvr(item.expected)}` },
  ]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[520px]">
        <DialogHeader className="flex-row items-start justify-between gap-3.5 px-6 pt-[22px] pb-0">
          <div className="min-w-0">
            <DialogTitle className="tracking-[-0.015em]">Review payment</DialogTitle>
            <DialogDescription className="mt-1 text-compact text-muted-foreground">
              {tenant?.name ?? item.tenantSlug} · {s.invoiceId}
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </DialogHeader>

        <div className="max-h-[min(64vh,560px)] overflow-y-auto px-6 pt-4 pb-2">
          <button
            type="button"
            onClick={() => toast(`Opening ${s.receipt.fileName}…`)}
            className="flex w-full items-center gap-3.5 rounded-[13px] border border-divider bg-surface-band px-4 py-3.5 text-left outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground">
              {isPdf ? <FileText className="size-5" /> : <ImageIcon className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ui-sm font-bold text-foreground">{s.receipt.fileName}</span>
              <span className="mt-0.5 block text-meta text-muted-foreground">
                {isPdf ? 'PDF' : 'Image'} · {formatBytes(s.receipt.sizeBytes)}
              </span>
            </span>
            <span className="text-caption font-bold text-link">Open slip</span>
          </button>

          <Overline className="mt-5 mb-0.5">Details</Overline>
          <KeyValueRows
            rows={[
              { label: 'Amount', value: `${s.currency} ${Math.round(s.amount).toLocaleString('en-US')}` },
              { label: 'Invoice total', value: formatMvr(item.expected) },
              { label: 'Bank', value: s.bank },
              { label: 'Reference', value: <span className="font-mono">{s.reference}</span> },
              { label: 'Paid on', value: formatIsoDate(s.paidOn) },
              { label: 'Submitted', value: `${item.submitterName} · ${formatIsoDate(s.submittedOn)}` },
              ...(s.note ? [{ label: 'Note', value: s.note }] : []),
            ]}
          />

          <Overline className="mt-5 mb-2">Before you verify</Overline>
          <ul className="grid gap-2">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2.5">
                {c.ok ? <Check className="mt-0.5 size-4 shrink-0 text-tone-success-foreground" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-tone-warning-foreground" />}
                <span className="min-w-0">
                  <span className="block text-compact font-bold text-body">{c.label}</span>
                  <span className={cn('block text-meta', c.ok ? 'text-muted-foreground' : 'text-tone-warning-foreground')}>{c.note}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-meta text-muted-foreground">Confirm the transfer actually landed on the bank statement — the slip alone isn’t proof.</p>

          {rejecting && (
            <div className="mt-5 grid gap-2.5 rounded-[13px] bg-surface-band px-4 py-3.5">
              <label className="grid gap-1.5">
                <span className="text-caption font-bold text-body">Reason</span>
                <SelectField
                  aria-label="Reason"
                  value={reason}
                  onValueChange={setReason}
                  className="bg-card"
                  options={[{ value: '', label: 'Choose a reason' }, ...reasons.map((r) => ({ value: r, label: r }))]}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-caption font-bold text-body">Message to the tenant (optional)</span>
                <Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="e.g. We received MVR 11,700 — please pay the remaining MVR 20." className="h-[38px] bg-card text-sm" />
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-divider px-6 pt-[15px] pb-[18px]">
          {rejecting ? (
            <>
              <Button variant="ghost" onClick={() => setRejecting(false)}>
                Back
              </Button>
              <Button variant="destructive" disabled={!finalReason} onClick={onReject}>
                Reject payment
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setRejecting(true)}>
                Reject
              </Button>
              <Button onClick={onVerify}>Verify payment</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Under a ledger status: "Pending" while pending, "Verified by …" once verified. */
export function PaymentNote({ invoiceNo }: { invoiceNo: string }) {
  const note = useInvoicePaymentNotes().get(invoiceNo)
  if (!note) return null
  if (note.state === 'review') {
    return (
      <Badge variant="warning" size="sm" className="mt-1 px-2 py-0 text-micro">
        Pending
      </Badge>
    )
  }
  return (
    <div className="mt-1 text-micro text-muted-foreground">
      Verified{note.reviewerName ? ` by ${note.reviewerName}` : ''}
      {note.submission.reviewedOn ? ` · ${formatIsoDate(note.submission.reviewedOn)}` : ''}
    </div>
  )
}
