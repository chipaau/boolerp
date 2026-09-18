import { useEffect, useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { DatePicker } from '@workspace/ui/components/date-picker'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@workspace/ui/components/dialog'
import { FileChip, FileDropzone } from '@workspace/ui/components/file-dropzone'
import { SelectField } from '@workspace/ui/components/select'
import { Stepper, StepperFooter, StepperLayout } from '@workspace/ui/components/stepper'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { DISPLAY_TONE, PAYMENT_TONE, RECEIPT_ACCEPT, RECEIPT_MAX_BYTES, fmtIso, formatMoney, payableInvoices, round2 } from '@/features/billing/logic'
import { receiptUrl, useBillingActions, useInvoices, usePayeeDetails, usePayments } from '@/features/billing/queries'
import type { PaymentBank, PaymentSubmission } from '@/features/billing/types'
import { copyText } from '@/features/directory/people-bits'
import { isoDate } from '@/lib/dates'
import { FieldLabel, KeyValue, fieldClass } from './control-bits'

const BANKS: PaymentBank[] = ['BML', 'MIB', 'SBI', 'Other']
const STEPS = [
  { title: 'Transfer', hint: 'Send the money' },
  { title: 'Upload slip', hint: 'Proof of transfer' },
  { title: 'Review', hint: 'Check and submit' },
]
const HEADINGS = ['Make the transfer', 'Upload the transfer slip', 'Check before you submit']
const LEADS = [
  'Pay from your bank app or at a branch into either account below, quoting the reference so Bool can match it.',
  'A screenshot or PDF of the confirmation your bank gave you. Bool checks it against the transfer, usually within one working day.',
  'Nothing is sent until you submit. The invoice shows "Pending" until Bool verifies it.',
]

/** A value with a copy button: account numbers, the amount and the reference. */
function CopyValue({ label, value, copy = value, mono = true }: { label: string; value: string; copy?: string; mono?: boolean }) {
  const toast = useToast()
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 1500)
    return () => clearTimeout(t)
  }, [done])
  return (
    <div className="flex items-center justify-between gap-3 border-b border-divider py-2 last:border-b-0">
      <span className="shrink-0 text-compact text-faint">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={cn('truncate text-ui-sm font-bold text-foreground', mono && 'font-mono tabular-nums')}>{value}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={() => {
            copyText(copy)
            setDone(true)
            toast(`${label} copied`)
          }}
        >
          {done ? <Check className="size-3.5" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={1.8} />}
        </Button>
      </span>
    </div>
  )
}

/**
 * Pay one or more invoices by bank transfer, Maldives style: transfer to Bool's account quoting the
 * invoice number, upload the slip, submit it for verification. `invoiceIds` opens the dialog with
 * those invoices chosen; null keeps it closed.
 */
export function PayDialog({ invoiceIds, onClose }: { invoiceIds: string[] | null; onClose: () => void }) {
  const invoices = useInvoices()
  const payments = usePayments()
  const payee = usePayeeDetails()
  const actions = useBillingActions()
  const toast = useToast()
  const payable = useMemo(() => payableInvoices(invoices, payments), [invoices, payments])

  const [step, setStep] = useState(0)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [file, setFile] = useState<File | null>(null)
  const [bank, setBank] = useState<PaymentBank>('BML')
  const [reference, setReference] = useState('')
  const [paidOn, setPaidOn] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const open = invoiceIds !== null
  useEffect(() => {
    if (!invoiceIds) return
    setStep(0)
    setChosen(new Set(invoiceIds))
    setFile(null)
    setBank('BML')
    setReference('')
    setPaidOn(isoDate(new Date()))
    setNote('')
  }, [invoiceIds])

  const selected = payable.filter((i) => chosen.has(i.id))
  const total = round2(selected.reduce((n, i) => n + i.total, 0))
  const currency = selected[0]?.currency ?? 'MVR'
  const numbers = selected.map((i) => i.number).join(', ')
  const several = selected.length > 1
  useEffect(() => setAmount(total ? total.toFixed(2) : ''), [total])

  const n = Number(amount)
  const amountOk = amount.trim() !== '' && Number.isFinite(n) && n > 0
  const today = isoDate(new Date())
  const slipOk = !!file && !!reference.trim() && !!paidOn && paidOn <= today && amountOk
  const complete = (i: number) => (i === 0 ? selected.length > 0 : i === 1 ? slipOk : true)

  const [reviewUrl, setReviewUrl] = useState<string>()
  useEffect(() => {
    if (step !== 2 || !file || !/^image\//.test(file.type)) return setReviewUrl(undefined)
    const u = URL.createObjectURL(file)
    setReviewUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [step, file])

  function toggle(id: string, on: boolean) {
    setChosen((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }
  function go(to: number) {
    for (let i = 0; i < to; i++) if (!complete(i)) return toast(i === 0 ? 'Choose at least one invoice to pay' : 'Add the slip, reference, date paid and amount', { ok: false })
    setStep(to)
  }
  function submit() {
    if (!file || !slipOk || !selected.length) return
    const undo = actions.submitPayment({ invoices: selected, bank, reference, paidOn, amount: several ? total : round2(n), note, file })
    toast(`Payment for ${numbers} sent for verification`, { undo, undoLabel: 'Withdraw' })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[860px]" showCloseButton>
        <StepperLayout rail={<Stepper title="Pay by transfer" steps={STEPS} current={step} complete={complete} onStep={go} />}>
          <div className="mb-5 pr-8">
            <DialogTitle className="text-[21px] leading-tight font-bold tracking-[-0.015em] text-foreground">{HEADINGS[step]}</DialogTitle>
            <DialogDescription className="mt-1.5 max-w-[58ch] text-compact leading-[1.55] text-pretty text-body">{LEADS[step]}</DialogDescription>
          </div>

          {step === 0 && (
            <div className="flex flex-col gap-4">
              {payable.length > 1 && (
                <div>
                  <FieldLabel>Invoices to pay</FieldLabel>
                  <ul className="rounded-xl border border-border px-3.5">
                    {payable.map((i) => (
                      <li key={i.id} className="border-b border-divider last:border-b-0">
                        <label className="flex cursor-pointer items-center gap-3 py-2.5">
                          <Checkbox checked={chosen.has(i.id)} onCheckedChange={(v) => toggle(i.id, !!v)} aria-label={`Pay ${i.number}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block font-mono text-compact font-bold text-foreground">{i.number}</span>
                            <span className="block text-caption text-faint">due {fmtIso(i.dueOn)}</span>
                          </span>
                          <Badge variant={DISPLAY_TONE[i.status]} size="sm">{i.status}</Badge>
                          <span className="w-[112px] text-right text-compact tabular-nums text-foreground">{formatMoney(i.total, i.currency)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.length > 0 ? (
                <div className="rounded-[13px] border border-border bg-surface-band px-4 py-3">
                  <CopyValue label="Amount" value={formatMoney(total, currency)} copy={total.toFixed(2)} />
                  <CopyValue label="Reference" value={numbers} />
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-surface-band px-4 py-3 text-compact text-faint">Choose an invoice to see the amount and reference.</div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {payee.accounts.map((a) => (
                  <div key={a.accountNumber} className="rounded-[13px] border border-border px-4 py-3">
                    <div className="mb-1 text-overline text-faint">{a.bank}</div>
                    <CopyValue label="Account name" value={payee.accountName} mono={false} />
                    <CopyValue label="Account number" value={a.accountNumber} />
                    <CopyValue label="SWIFT" value={a.swift} />
                    <div className="pt-1.5 text-caption text-faint">{a.currency} account</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <FileDropzone file={file} onFile={setFile} onClear={() => setFile(null)} accept={RECEIPT_ACCEPT} maxBytes={RECEIPT_MAX_BYTES} label="Drop the transfer slip here" hint="JPG, PNG or PDF, up to 10 MB" aria-label="Upload transfer slip" />
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <FieldLabel>Paid from</FieldLabel>
                  <SelectField aria-label="Paid from" value={bank} onValueChange={(v) => setBank(v as PaymentBank)} className="w-full" options={BANKS} />
                </div>
                <div>
                  <FieldLabel>Transfer reference</FieldLabel>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="As printed on the slip" className={cn(fieldClass, 'font-mono')} />
                </div>
                <div>
                  <FieldLabel>Paid on</FieldLabel>
                  <DatePicker value={paidOn} onChange={setPaidOn} aria-label="Paid on" />
                </div>
                <div>
                  <FieldLabel hint={several ? ' · total of the invoices chosen' : undefined}>Amount ({currency})</FieldLabel>
                  <input type="number" min={0} step="0.01" value={amount} readOnly={several} onChange={(e) => setAmount(e.target.value)} className={cn(fieldClass, 'tabular-nums', several && 'text-faint')} />
                </div>
              </div>
              {paidOn > today && (
                <Alert variant="warning">
                  <AlertDescription>The date paid cannot be in the future.</AlertDescription>
                </Alert>
              )}
              {!several && amountOk && round2(n) !== total && (
                <Alert variant="warning">
                  <AlertDescription>
                    That is not the invoice total of {formatMoney(total, currency)}. Bool will verify what actually arrived.
                  </AlertDescription>
                </Alert>
              )}
              <div>
                <FieldLabel hint=" · optional">Note for Bool</FieldLabel>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything Bool should know about this transfer" className={cn(fieldClass, 'h-auto py-2.5')} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-[13px] border border-border px-4 py-1">
                <KeyValue
                  rows={[
                    { k: several ? 'Invoices' : 'Invoice', v: numbers, mono: true },
                    { k: 'Amount', v: <span className="font-bold text-foreground">{formatMoney(several ? total : round2(n), currency)}</span> },
                    { k: 'Paid from', v: `${bank} · bank transfer` },
                    { k: 'Reference', v: reference.trim(), mono: true },
                    { k: 'Paid on', v: paidOn ? fmtIso(paidOn) : '—' },
                    ...(note.trim() ? [{ k: 'Note', v: note.trim() }] : []),
                  ]}
                />
              </div>
              {file && <FileChip name={file.name} mimeType={file.type} sizeBytes={file.size} url={reviewUrl} />}
            </div>
          )}

          <StepperFooter note={[selected.length ? `${selected.length} ${selected.length === 1 ? 'invoice' : 'invoices'} · ${formatMoney(total, currency)}` : 'No invoice chosen yet.', file ? 'Slip attached.' : 'No slip yet.', 'You can withdraw it from the toast straight after.'][step]}>
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < 2 ? <Button onClick={() => go(step + 1)}>{step === 0 ? 'I have paid' : 'Review'}</Button> : <Button onClick={submit}>Submit payment</Button>}
          </StepperFooter>
        </StepperLayout>
      </DialogContent>
    </Dialog>
  )
}

/** Submissions against invoices, newest first: status, slip, and why one was sent back. */
export function PaymentList({ payments, onReupload, canReupload = () => true, showInvoice = false, invoiceNumber }: { payments: PaymentSubmission[]; /** Offered on a rejected submission whose invoice still needs paying. */ onReupload?: (invoiceId: string) => void; canReupload?: (invoiceId: string) => boolean; showInvoice?: boolean; invoiceNumber?: (id: string) => string }) {
  return (
    <ul>
      {payments.map((p) => (
        <li key={p.id} className="border-b border-divider py-2.5 last:border-b-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="min-w-0 flex-[1_1_200px]">
              <span className="block text-ui-sm font-bold text-foreground tabular-nums">
                {formatMoney(p.amount, p.currency)}
                {showInvoice && <span className="font-mono font-normal text-faint"> · {invoiceNumber?.(p.invoiceId) ?? p.invoiceId}</span>}
              </span>
              <span className="mt-0.5 block text-meta text-faint">
                {p.bank} · <span className="font-mono">{p.reference}</span> · paid {fmtIso(p.paidOn)}
              </span>
            </span>
            <Badge variant={PAYMENT_TONE[p.status]} size="sm">
              {p.status}
            </Badge>
          </div>
          {!showInvoice && <FileChip className="mt-2 py-2" name={p.receipt.fileName} mimeType={p.receipt.mimeType} sizeBytes={p.receipt.sizeBytes} url={receiptUrl(p.receipt.storageKey)} />}
          {p.status === 'Rejected' && (
            // a quiet reason line under the row, not a red block: the badge already says Rejected
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-compact text-muted-foreground">
              <span className="min-w-0 flex-1">
                <span className="text-tone-risk-foreground">Reason:</span> {p.rejectReason ?? 'Bool could not verify this payment.'}
              </span>
              {onReupload && canReupload(p.invoiceId) && (
                <Button variant="link" size="xs" className="font-bold" onClick={() => onReupload(p.invoiceId)}>
                  Upload a new slip
                </Button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
