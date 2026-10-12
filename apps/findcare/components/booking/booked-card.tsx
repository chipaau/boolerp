'use client'

import { ButtonLink, buttonClass } from '@/components/ui/button'
import { fmtDay, sessionFor } from '@/lib/data'
import type { Appointment, Branch, Clinic, Doctor } from '@/lib/data'
import { routes } from '@/lib/routes'
import { calendarHref } from '@/lib/visit-files'

/** What happened, in the dark offer style: booked, requested, moved, or booked with a payment still due. */
export function BookedCard({ appt, doctor, clinic, branch, moved }: { appt: Appointment; doctor: Doctor; clinic: Clinic; branch: Branch; moved: boolean }) {
  const se = sessionFor(appt.sessionId)
  const pay = appt.pay?.method === 'transfer' ? appt.pay : null
  const status = appt.status
  const kicker = moved
    ? 'Visit moved'
    : status === 'requested'
      ? 'Request sent'
      : status === 'pending_payment'
        ? 'Almost there · payment due'
        : status === 'payment_review'
          ? 'Booked · checking payment'
          : 'You’re booked'
  const when = appt.time ?? (status === 'requested' ? `${se.start}–${se.end} window` : `Queue #${appt.queueNo}`)
  const sub =
    status === 'pending_payment'
      ? `Transfer MVR ${pay?.amount ?? doctor.fees[branch.id]}${pay?.deposit ? ' (deposit)' : ''} and upload the receipt within ${clinic.pay.windowH || 2} hours, or this time is released. Reference ${appt.ref}.`
      : status === 'payment_review'
        ? `Your receipt is with ${clinic.name}. We’ll text you when the payment is verified. Reference ${appt.ref}.`
        : status === 'requested'
          ? `${clinic.name} will offer you an exact time${appt.preference && appt.preference !== 'any' ? ` in the ${appt.preference}` : ''} and text you. Take it in Appointments. Reference ${appt.ref}.`
          : `Reference ${appt.ref} · ${clinic.name}. ${clinic.arrive}`
  const due = status === 'pending_payment'
  return (
    <section role="status" className="flex animate-fc-rise flex-col gap-3.5 rounded-[22px] bg-indigo-900 p-[22px] text-white shadow-banner">
      <div className="eyebrow text-indigo-300">{kicker}</div>
      <div className="text-[20px] leading-[1.25] font-semibold">
        {fmtDay(appt.date)} · {when} with {doctor.name}
      </div>
      <p className="text-[13px] leading-normal text-indigo-300">{sub}</p>
      <div className="flex flex-wrap gap-2.5">
        <a
          href={calendarHref(appt)}
          download={`findcare-${appt.ref}.ics`}
          className={buttonClass({ variant: 'outline', size: 'md' }, 'h-10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.3)] hover:shadow-[inset_0_0_0_1px_#fff]')}
        >
          Add to calendar
        </a>
        <ButtonLink
          href={due ? routes.appointments({ pay: appt.id }) : routes.appointments({ appt: appt.id })}
          variant="soft"
          className="cta-label h-10 bg-white text-ink-900 hover:bg-indigo-100"
        >
          {due ? 'Upload receipt' : 'View appointments'}
        </ButtonLink>
      </div>
    </section>
  )
}
