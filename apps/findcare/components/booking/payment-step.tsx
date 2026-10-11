'use client'

import { Check, Copy, Landmark, Upload, Building2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import type { Clinic, Receipt } from '@/lib/data'
import { readReceipt } from '@/lib/receipt'

export type PayMethod = 'clinic' | 'transfer'

/** The method a clinic starts on: transfer when it requires paying ahead or takes nothing at the desk. */
export const defaultPayMethod = (c: Clinic): PayMethod => (c.pay.prepay === 'required' || !c.pay.atClinic ? 'transfer' : 'clinic')

/** What a transfer to this clinic asks for: the full fee, or its deposit when it takes one. */
export const transferAmount = (c: Clinic, fee: number) => (c.pay.deposit ? Math.min(c.pay.deposit, fee) : fee)

/**
 * How to pay: at the clinic, or by bank transfer with the receipt attached now or later. When the
 * clinic requires paying ahead it says so first, with the window, so the patient knows what keeps
 * the time theirs.
 */
export function PaymentStep({
  clinic,
  fee,
  method,
  onMethod,
  receipt,
  onReceipt,
  onError,
  payRef,
}: {
  clinic: Clinic
  fee: number
  method: PayMethod
  onMethod: (m: PayMethod) => void
  receipt: Receipt | null
  onReceipt: (r: Receipt | null) => void
  onError: (msg: string) => void
  /** The reference to quote on the transfer: the end of the account's phone number. */
  payRef: string
}) {
  const pc = clinic.pay
  const required = pc.prepay === 'required'
  const T = pc.transfer
  const amount = transferAmount(clinic, fee)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(id)
  }, [copied])

  const options = [
    pc.atClinic && { id: 'clinic' as const, label: 'Pay at clinic', sub: 'Cash or card at reception', Icon: Building2 },
    T && {
      id: 'transfer' as const,
      label: 'Bank transfer',
      sub: required ? (pc.deposit ? `MVR ${amount} deposit to confirm` : 'Required to confirm') : 'Pay now, skip the desk',
      Icon: Landmark,
    },
  ].filter((o) => !!o)

  return (
    <div className="flex flex-col gap-2.5">
      {required && (
        <div className="rounded-xl bg-[var(--tint-butter-bg)] px-3.5 py-2.5 text-[12.5px] leading-normal text-[#6b5313]">
          {clinic.name}
          {pc.deposit ? ` asks for a MVR ${amount} deposit` : ' asks for payment in advance'}. Upload your transfer receipt within {pc.windowH || 2} hours to keep this time.
        </div>
      )}
      <div role="group" aria-label="How to pay" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2">
        {options.map(({ id, label, sub, Icon }) => {
          const on = method === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => onMethod(id)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-[background-color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                on ? 'bg-white shadow-soft' : 'bg-wash-1',
              )}
            >
              <span
                className={cn('flex size-[34px] shrink-0 items-center justify-center rounded-full', on ? 'bg-indigo-900 text-white' : 'bg-info-bg text-[var(--tint-lilac-fg)]')}
              >
                <Icon aria-hidden className="size-[15px]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-ink-900">{label}</span>
                <span className="mt-0.5 block text-[12px] text-ink-600">{sub}</span>
              </span>
            </button>
          )
        })}
      </div>

      {method === 'transfer' && T && (
        <div className="flex flex-col gap-3 rounded-2xl bg-wash-1 px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[12px] text-ink-600">
                {T.bank} · {T.name}
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-[16px] font-semibold tracking-[0.04em] tabular-nums">{T.acc.replace(/(\d{4})(?=\d)/g, '$1 ')}</span>
                <button
                  type="button"
                  aria-label="Copy account number"
                  title={copied ? 'Copied' : 'Copy account number'}
                  onClick={() => {
                    navigator.clipboard.writeText(T.acc).catch(() => undefined)
                    setCopied(true)
                  }}
                  className={cn(
                    'flex size-7 cursor-pointer items-center justify-center rounded-full outline-none hover-ghost focus-visible:ring-2 focus-visible:ring-indigo-500',
                    copied ? 'text-success-fg' : 'text-ink-600',
                  )}
                >
                  {copied ? <Check className="size-3.5" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={1.8} />}
                </button>
                <span role="status" className="sr-only">
                  {copied ? 'Account number copied' : ''}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[16px] font-semibold tabular-nums">MVR {pc.deposit ? amount : fee}</div>
              <div className="mt-[3px] text-[11.5px] text-ink-500">
                {pc.deposit ? 'Deposit · rest at clinic · ' : ''}Ref {payRef}
              </div>
            </div>
          </div>
          {receipt ? (
            <div className="flex items-center gap-3 rounded-[14px] bg-white px-3 py-2.5">
              <span
                className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-success-bg bg-cover bg-center text-success-fg"
                style={receipt.isImg ? { backgroundImage: `url(${receipt.data})` } : undefined}
              >
                {!receipt.isImg && <Check aria-hidden className="size-[15px]" strokeWidth={2} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{receipt.name}</span>
                <span className="mt-0.5 block text-[12px] text-success-fg">Ready to send with your booking</span>
              </span>
              <button type="button" onClick={() => onReceipt(null)} className="h-[30px] cursor-pointer rounded-full px-2.5 text-[12px] font-medium text-ink-600 hover:text-ink-900">
                Remove
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-3 rounded-[14px] bg-white px-3.5 py-3 shadow-[0_4px_12px_rgba(106,92,176,.06)] focus-within:ring-2 focus-within:ring-indigo-500">
              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-info-bg text-[var(--tint-lilac-fg)]">
                <Upload aria-hidden className="size-[15px]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink-900">Upload receipt</span>
                <span className="mt-0.5 block text-[12px] text-ink-600">{required ? 'Photo or PDF · or upload later from Appointments' : 'Optional · photo or PDF'}</span>
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  readReceipt(file)
                    .then((r) => onReceipt(r))
                    .catch((err: unknown) => onError(err instanceof Error ? err.message : 'Could not read that file.'))
                }}
              />
            </label>
          )}
        </div>
      )}
    </div>
  )
}
