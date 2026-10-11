'use client'

import { X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { Button, ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { IconButton } from '@/components/ui/icon-button'
import { Overline } from '@/components/ui/text'
import { book, db, fmtDay, reschedule, toMin } from '@/lib/data'
import type { Account, Appointment, Branch, Clinic, DayPeriod, Doctor, Receipt, Session, SlotPick } from '@/lib/data'
import { routes } from '@/lib/routes'
import { PatientPicker, ineligibility } from './patient-picker'
import type { PatientChoice } from './patient-picker'
import { PaymentStep, defaultPayMethod } from './payment-step'
import type { PayMethod } from './payment-step'
import type { useHold } from './use-hold'

type Step = 'details' | 'pay'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
// randomUUID needs a secure context, which the plain-http development host is not.
const newKey = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
const digits = (phone: string) => phone.replace(/[^\d+]/g, '')

/** The picked time, as one line: "Tomorrow · 10:30", "Today · Queue 16:00–19:00". */
export const pickLine = (se: Session, pick: SlotPick) =>
  `${fmtDay(se.date)} · ${pick.time || `${se.mode === 'request' ? 'Request · ' : 'Queue '}${se.start}–${se.end}`}`

/**
 * Finishing a booking for the picked time: who it is for, the reason and where texts go, then how to
 * pay when the clinic takes transfers, then confirm. The time is held for five minutes meanwhile.
 * Every attempt carries one idempotency key, so a double tap or a retry books once.
 */
export function BookingPanel({
  doctor,
  clinic,
  branch,
  session,
  pick,
  account,
  resched,
  hold,
  signInHref,
  onBooked,
  onLost,
}: {
  doctor: Doctor
  clinic: Clinic
  branch: Branch
  session: Session
  pick: SlotPick
  account: Account | null
  resched?: Appointment
  hold: ReturnType<typeof useHold>
  signInHref: string
  onBooked: (a: Appointment) => void
  /** The time was taken (or its hold could not be renewed): the screen offers others. */
  onLost: () => void
}) {
  const s = db()
  const fee = doctor.fees[branch.id] ?? 0
  const people = account ? [account.holderId, ...account.familyIds].map((id) => s.patients[id]) : []
  const firstOk = people.find((p) => !ineligibility(doctor.id, people, { kind: 'existing', id: p.id })) ?? people.at(0)
  const [who, setWho] = useState<PatientChoice>(() => ({ kind: 'existing', id: resched?.patientId ?? firstOk?.id ?? '' }))
  const [reason, setReason] = useState('')
  const [preference, setPreference] = useState<DayPeriod | 'any'>('any')
  const [notif, setNotif] = useState(account?.notifPhone || account?.phone || '')
  const [method, setMethod] = useState<PayMethod>(() => defaultPayMethod(clinic))
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState<Appointment | null>(null)
  const [busy, setBusy] = useState(false)
  // One key per attempt at this pick; the panel remounts for a new pick, and so gets a new key.
  const [idemKey] = useState(newKey)

  const request = session.mode === 'request'
  const showPay = !resched && !request && (!!clinic.pay.transfer || !clinic.pay.atClinic)
  const steps: Step[] = [...(resched ? [] : (['details'] as const)), ...(showPay ? (['pay'] as const) : [])]
  const [stepIdx, setStepIdx] = useState(0)
  const i = Math.min(stepIdx, Math.max(0, steps.length - 1))
  const step = steps.at(i)
  const last = i >= steps.length - 1
  const required = clinic.pay.prepay === 'required'

  const fail = (msg: string) => {
    setError(msg)
    setConflict(null)
  }

  const validateDetails = () => {
    if (who.kind === 'new' && !who.name.trim()) return 'Add their name so the clinic knows who’s coming.'
    if (who.kind === 'new' && !who.dob) return 'Add their date of birth so we can check this doctor sees their age group.'
    const why = ineligibility(doctor.id, people, who)
    if (why) return why
    if (digits(notif).replace('+', '').length < 7) return 'Add a phone number we can text about this visit.'
    return null
  }

  const confirm = () => {
    if (!account || busy) return
    if (!resched) {
      const bad = validateDetails()
      if (bad) return fail(bad)
    }
    const h = hold.ensure()
    if (!h) return onLost()
    setBusy(true)
    const patient = who.kind === 'existing' ? { id: who.id } : { name: who.name.trim(), dob: who.dob, relation: who.relation }
    const r = resched
      ? reschedule(resched.id, pick, h.id)
      : book({
          pick,
          holdId: h.id,
          patient,
          accountId: account.id,
          notif: notif.trim(),
          reason: reason.trim(),
          idemKey,
          payMethod: showPay ? method : clinic.pay.atClinic ? 'clinic' : 'transfer',
          receipt: showPay && method === 'transfer' ? receipt : null,
          preference: request ? preference : undefined,
        })
    setBusy(false)
    if (r.ok) {
      hold.consumed()
      onBooked(r.appt)
      return
    }
    if (r.code === 'unavailable') return onLost()
    if (r.code === 'conflict') {
      setError('There’s already a booking around this time for this person.')
      setConflict(r.appt ?? null)
      return
    }
    fail(r.code === 'ineligible' && r.msg ? r.msg : 'That didn’t go through. Please try again.')
  }

  const next = () => {
    const bad = step === 'details' ? validateDetails() : null
    if (bad) return fail(bad)
    setError('')
    setStepIdx(i + 1)
  }

  return (
    <section aria-label={resched ? 'New time' : 'Your booking'} className="flex animate-fc-rise flex-col gap-4 rounded-[22px] bg-white/86 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,.95),0_20px_50px_rgba(106,92,176,.14)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Overline>{resched ? 'New time' : 'Your booking'}</Overline>
          <div className="mt-1.5 text-[18px] font-semibold">{pickLine(session, pick)}</div>
          <div className="mt-[3px] text-[12.5px] text-ink-600">
            {clinic.name} · {branch.name.split(' — ')[0]} · MVR {fee}
          </div>
          {hold.holdId && (
            <div className="mt-2 inline-flex h-6 items-center gap-1.5 rounded-full bg-info-bg px-2.5 text-[11.5px] font-medium text-info-fg tabular-nums">
              Held for you · <span aria-label={`${Math.ceil(hold.secondsLeft / 60)} minutes left`}>{clock(hold.secondsLeft)}</span>
            </div>
          )}
        </div>
        <IconButton label="Clear" variant="ghost" size={30} onClick={hold.clear}>
          <X className="size-3.5" strokeWidth={1.8} />
        </IconButton>
      </div>

      {hold.lapsed && (
        <div role="status" className="rounded-xl bg-warning-bg px-3.5 py-2.5 text-[12.5px] leading-normal text-warning-fg">
          Your 5-minute hold ran out, so we released this time. It’s still yours to take if nobody else has — confirm to try again.
        </div>
      )}

      {!account ? (
        <div className="flex flex-wrap items-center gap-3.5">
          <ButtonLink href={signInHref} size="lg">
            Sign in to book
          </ButtonLink>
          <span className="text-[12.5px] text-ink-600">Takes a few seconds with Google, Apple or Facebook.</span>
        </div>
      ) : (
        <>
          {steps.length > 1 && (
            <div className="flex items-center gap-2.5">
              <div aria-hidden className="flex gap-1">
                {steps.map((x, k) => (
                  <span key={x} className={cn('h-1 rounded-full transition-[width,background-color] duration-250', k === i ? 'w-[18px]' : 'w-1.5', k <= i ? 'bg-indigo-900' : 'bg-line-3')} />
                ))}
              </div>
              <span className="eyebrow flex-1 text-ink-500">
                Step {i + 1} of {steps.length} · {step === 'pay' ? 'Payment' : 'Details'}
              </span>
              {i > 0 && (
                <button type="button" onClick={() => setStepIdx(i - 1)} className="cursor-pointer text-[12.5px] font-medium text-ink-600 hover:text-ink-900">
                  ← Back
                </button>
              )}
            </div>
          )}

          {step === 'details' && (
            <>
              <PatientPicker doctorId={doctor.id} people={people} holderId={account.holderId} value={who} onChange={(c) => (setWho(c), setError(''))} />
              {request && <PartOfDay session={session} value={preference} onChange={setPreference} />}
              <label className="flex flex-col gap-1">
                <span className="sr-only">Reason for visit (optional)</span>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for visit (optional)"
                  className="resize-none rounded-[14px] bg-white px-3.5 py-3 text-[14px] leading-[1.45] text-ink-900 shadow-[inset_0_0_0_1px_var(--line-3)] outline-none placeholder:text-ink-400 focus:shadow-[inset_0_0_0_1px_var(--indigo-500)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-ink-600">We’ll text updates to</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={notif}
                  onChange={(e) => setNotif(e.target.value)}
                  className="h-11 rounded-[14px] bg-white px-3.5 text-[14px] text-ink-900 tabular-nums shadow-[inset_0_0_0_1px_var(--line-3)] outline-none focus:shadow-[inset_0_0_0_1px_var(--indigo-500)]"
                />
              </label>
            </>
          )}

          {step === 'pay' && (
            <PaymentStep
              clinic={clinic}
              fee={fee}
              method={method}
              onMethod={setMethod}
              receipt={receipt}
              onReceipt={(r) => (setReceipt(r), setError(''))}
              onError={fail}
              payRef={account.phone.replace(/\s/g, '').slice(-7)}
            />
          )}

          {error && (
            <div role="alert" className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-[12.5px] leading-[1.45] text-[#8a2238]">
              {error}
              {conflict && (
                <>
                  {' '}
                  <Link href={routes.appointments({ appt: conflict.id })} className="font-medium text-[#8a2238] underline">
                    View that booking
                  </Link>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3.5">
            <Button size="lg" onClick={last ? confirm : next} disabled={busy}>
              {!last ? 'Continue' : resched ? 'Move my visit' : request ? 'Send request' : 'Confirm booking'}
            </Button>
            {last && (
              <span className="text-[12px] text-ink-500">
                {showPay && method === 'transfer' && required && !receipt ? `Held for ${clinic.pay.windowH || 2} hours until your receipt arrives. ` : ''}
                {clinic.cancelPolicy}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  )
}

const PERIODS: { id: DayPeriod; label: string; from: number; to: number }[] = [
  { id: 'morning', label: 'Morning', from: 0, to: 12 * 60 },
  { id: 'afternoon', label: 'Afternoon', from: 12 * 60, to: 17 * 60 },
  { id: 'evening', label: 'Evening', from: 17 * 60, to: 24 * 60 },
]

/** A request's preferred part of the day: only the parts the clinic's window covers, or any time. */
function PartOfDay({ session, value, onChange }: { session: Session; value: DayPeriod | 'any'; onChange: (p: DayPeriod | 'any') => void }) {
  const open = PERIODS.filter((p) => toMin(session.start) < p.to && toMin(session.end) > p.from)
  return (
    <div role="group" aria-label="Preferred time" className="flex flex-col gap-2">
      <span className="text-[12px] font-medium text-ink-600">When suits you? The clinic offers an exact time.</span>
      <div className="flex flex-wrap gap-2">
        {[...open, { id: 'any' as const, label: 'Any time' }].map((p) => (
          <Chip key={p.id} size="sm" selected={value === p.id} onClick={() => onChange(p.id)}>
            {p.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}
