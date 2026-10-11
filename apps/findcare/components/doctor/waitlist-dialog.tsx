'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Dialog } from '@/components/ui/dialog'
import { Overline } from '@/components/ui/text'
import { db, eligible, joinWaitlist, payTerms } from '@/lib/data'
import type { Account, Appointment, DayPeriod, Doctor, WaitlistEntry } from '@/lib/data'
import { routes } from '@/lib/routes'

const PERIODS: [DayPeriod, string][] = [
  ['morning', 'Morning'],
  ['afternoon', 'Afternoon'],
  ['evening', 'Evening'],
]

/**
 * Joining the doctor's waitlist at this branch: optional times of day and, with family on the
 * account, who it is for. No date to pick: the first opening that fits is offered, held 30 minutes.
 * When rescheduling, the entry is for an earlier time than the visit already booked.
 */
export function WaitlistDialog({
  open,
  onOpenChange,
  doctor,
  branchId,
  account,
  resched,
  signInHref,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  doctor: Doctor
  branchId: string
  account: Account | null
  resched?: Appointment
  signInHref: string
}) {
  const s = db()
  const [periods, setPeriods] = useState<DayPeriod[]>([])
  const people = account ? [account.holderId, ...account.familyIds].map((id) => s.patients[id]) : []
  const ok = (dob: string | null) => eligible(doctor.id, dob).ok
  const [who, setWho] = useState(() => resched?.patientId ?? people.find((p) => ok(p.dob))?.id ?? people.at(0)?.id ?? '')
  const [joined, setJoined] = useState<WaitlistEntry | null>(null)
  const terms = payTerms(branchId, doctor.id)
  const phone = account ? account.notifPhone || account.phone : ''

  const close = (o: boolean) => {
    onOpenChange(o)
    if (!o) {
      setJoined(null)
      setPeriods([])
    }
  }

  const join = () => {
    if (!account || !who) return
    const w = joinWaitlist({
      patient: { id: who },
      accountId: account.id,
      doctorId: doctor.id,
      branchId,
      dates: null,
      sessions: periods,
      notif: phone,
      linkedApptId: resched?.id,
    })
    setJoined(w)
  }

  return (
    <Dialog open={open} onOpenChange={close} kicker="Waitlist" title={`Earlier time with ${doctor.name.split(' ').slice(0, 3).join(' ')}`}>
      {!account ? (
        <>
          <p className="text-[14px] leading-[1.55] text-ink-700">Sign in so we can text you when a time opens.</p>
          <ButtonLink href={signInHref} size="lg">
            Sign in
          </ButtonLink>
        </>
      ) : joined ? (
        <>
          <p className="text-[14px] leading-[1.55] text-ink-700">
            You’re on the list. We’ll text {phone} when something opens. You can leave it any time in Appointments.
          </p>
          <Link href={routes.appointments({ waitlist: joined.id })} className="self-start text-[12.5px] font-medium text-[var(--tint-lilac-fg)] no-underline hover:text-indigo-900">
            View waitlist in Appointments →
          </Link>
          <Button size="lg" onClick={() => close(false)}>
            Done
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Overline id="wl-times">Best times · optional</Overline>
            <div role="group" aria-labelledby="wl-times" className="flex flex-wrap gap-1.5">
              {PERIODS.map(([k, label]) => {
                const on = periods.includes(k)
                return (
                  <Chip key={k} selected={on} onClick={() => setPeriods(on ? periods.filter((x) => x !== k) : [...periods, k])}>
                    {label}
                  </Chip>
                )
              })}
            </div>
          </div>
          {!resched && people.length > 1 && (
            <div className="flex flex-col gap-2">
              <Overline id="wl-for">For</Overline>
              <div role="group" aria-labelledby="wl-for" className="flex flex-wrap gap-1.5">
                {people.map((p) => {
                  const fine = ok(p.dob)
                  return (
                    <Chip key={p.id} selected={who === p.id} disabled={!fine} onClick={() => setWho(p.id)}>
                      {p.id === account.holderId ? 'Me' : p.name.split(' ')[0]}
                      {!fine && ' · not eligible'}
                    </Chip>
                  )
                })}
              </div>
            </div>
          )}
          <Button size="lg" onClick={join} disabled={!who}>
            Join waitlist
          </Button>
          {terms && (
            <div className="rounded-[14px] bg-[var(--tint-butter-bg)] px-3.5 py-3 text-[12.5px] leading-normal text-[#5c4712]">
              Nothing to pay to join. You only pay once a time is confirmed: {terms.text} after you take it.
            </div>
          )}
          <p className="text-center text-[12px] leading-normal text-ink-500">
            No date to pick — you’re in line for this doctor, and we offer you the first opening that fits. You get 30 minutes to take it before it goes to
            the next person.
          </p>
        </>
      )}
    </Dialog>
  )
}
