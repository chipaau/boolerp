'use client'

import { Upload } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { buttonClass } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import type { Appointment } from '@/lib/data'
import { clinicOf, nowMs, uploadReceipt } from '@/lib/data'
import { readReceipt } from '@/lib/receipt'
import { CopyButton } from './copy-button'
import { isUpcoming } from './summary'

/** Whether a visit has a transfer still to settle or being checked: the cases the panel is for. */
export function showsTransfer(a: Appointment) {
  return isUpcoming(a) && a.pay?.method === 'transfer' && a.pay.status !== 'verified'
}

const groups = (acc: string) => acc.replace(/(\d{4})(?=\d)/g, '$1 ')

function left(ms: number) {
  const m = Math.floor(Math.max(0, ms) / 60000)
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m left`
}

/**
 * Paying by bank transfer: the clinic's account (with copy), the amount and reference, how long is
 * left, why a receipt was rejected, and uploading one; then "the clinic is checking". Render it only
 * when showsTransfer(appt). Call useNow() in the parent so the countdown ticks.
 */
export function TransferPanel({ appt: a, onMessage }: { appt: Appointment; onMessage: (msg: string) => void }) {
  const fileId = useId()
  const [viewing, setViewing] = useState(false)
  if (a.pay?.method !== 'transfer') return null
  const pay = a.pay
  const clinic = clinicOf(a.branchId)
  const bank = clinic.pay.transfer
  const due = pay.status === 'due' || pay.status === 'rejected'
  const rejected = pay.status === 'rejected'

  const title = !due
    ? 'Receipt sent · clinic is checking'
    : rejected
      ? 'Receipt didn’t match — upload again'
      : a.status === 'pending_payment'
        ? 'Payment needed to keep this time'
        : 'Pay ahead (optional)'

  const onFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    // Cleared so choosing the same file again still fires a change.
    input.value = ''
    if (!file) return
    try {
      uploadReceipt(a.id, await readReceipt(file))
      onMessage(`Receipt sent to ${clinic.name}.`)
    } catch (e) {
      onMessage(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  return (
    <section aria-label="Payment by bank transfer" className={cn('flex flex-col gap-2.5 rounded-2xl px-4 py-3.5', due ? 'bg-warning-bg' : 'bg-wash-1')}>
      <div className="flex items-baseline justify-between gap-2.5">
        <h3 className="text-[13.5px] font-semibold">{title}</h3>
        {due && pay.dueAt && <span className="text-[12px] font-medium text-ink-600 tabular-nums">{left(pay.dueAt - nowMs())}</span>}
      </div>
      {rejected && pay.rejectReason && <p className="text-[12.5px] leading-normal font-medium text-warning-strong">Why: {pay.rejectReason}</p>}
      <p className="text-[12.5px] leading-[1.55] text-ink-700">
        {due && bank
          ? `Transfer MVR ${pay.amount}${pay.deposit ? ' deposit' : ''} to ${bank.bank} · ${bank.name} · ${groups(bank.acc)}. Reference ${a.ref}.`
          : !due
            ? `We’ll text you once ${clinic.name} verifies it.`
            : `Pay MVR ${pay.amount} at ${clinic.name}.`}
      </p>
      {due && a.status === 'pending_payment' && pay.dueAt && (
        <p className="text-[12px] leading-normal text-ink-600">If no receipt arrives by then, the time is released to other patients and you’ll get a text. Nothing is charged.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {due && (
          <label htmlFor={fileId} className={buttonClass({ variant: 'primary', size: 'sm' }, 'h-9 focus-within:ring-2 focus-within:ring-indigo-500')}>
            <Upload aria-hidden className="size-[13px]" strokeWidth={2} />
            Upload receipt
            <input id={fileId} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => void onFile(e.currentTarget)} />
          </label>
        )}
        {pay.receipt &&
          (pay.receipt.isImg ? (
            <button type="button" className={buttonClass({ variant: 'soft', size: 'sm' }, 'h-9')} onClick={() => setViewing(true)}>
              View receipt
            </button>
          ) : (
            <a href={pay.receipt.data} download={pay.receipt.name} className={buttonClass({ variant: 'soft', size: 'sm' }, 'h-9')}>
              View receipt
            </a>
          ))}
        {due && bank && <CopyButton value={bank.acc} label="Copy account number" />}
      </div>
      {pay.receipt?.isImg && (
        <Dialog open={viewing} onOpenChange={setViewing} kicker={`Reference ${a.ref}`} title="Your transfer receipt" width={560}>
          {/* A data URL the patient chose themselves; next/image cannot optimise it. */}
          <img src={pay.receipt.data} alt={`Receipt ${pay.receipt.name}`} className="w-full rounded-xl" />
        </Dialog>
      )}
    </section>
  )
}
