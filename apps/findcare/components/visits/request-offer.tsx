'use client'

import { Button } from '@/components/ui/button'
import { acceptRequestOffer, declineRequestOffer, fmtDay, minutesUntil, payTerms, sessionFor } from '@/lib/data'
import type { Appointment } from '@/lib/data'

/** Whether a request has a time from the clinic waiting for the patient. */
export const showsRequestOffer = (a: Appointment) => a.status === 'offered' && !!a.offer

/**
 * The exact time a clinic offered for a request: take it (confirmed, or held for payment when the
 * clinic wants it first) or decline it (the request is cancelled). It lapses after two hours.
 */
export function RequestOffer({ appt: a, onMessage }: { appt: Appointment; onMessage: (msg: string) => void }) {
  if (!a.offer) return null
  const se = sessionFor(a.sessionId)
  const terms = payTerms(a.branchId, a.doctorId, se, a.offer.time)
  const left = minutesUntil(a.offer.expiresAt)
  return (
    <section aria-label="Time offered" className="flex flex-col gap-3 rounded-2xl bg-indigo-900 px-[18px] py-4 text-white">
      <div className="eyebrow flex items-center justify-between gap-3 text-indigo-300">
        <span>Clinic offered a time</span>
        <span className="text-white tabular-nums">{left >= 60 ? `${Math.floor(left / 60)}h ${String(left % 60).padStart(2, '0')}m` : `${left} min`} left</span>
      </div>
      <p className="text-[13px] leading-[1.45] font-medium">
        {fmtDay(a.date)} at {a.offer.time}.{terms ? ` Then pay ${terms.text} to keep it.` : ' Nothing to pay now.'}
      </p>
      <div className="flex items-center gap-3.5">
        <Button
          variant="soft"
          size="sm"
          className="cta-label bg-white text-[10.5px] text-ink-900 hover:bg-indigo-100"
          onClick={() => onMessage(acceptRequestOffer(a.id).ok ? (terms ? 'Time taken. Pay by transfer to keep it.' : 'Booked. See you then.') : 'That offer is no longer open.')}
        >
          Take it
        </Button>
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-[10.5px] font-medium tracking-[0.18em] text-indigo-300 uppercase hover:text-white"
          onClick={() => onMessage(declineRequestOffer(a.id).ok ? 'Declined. Your request is cancelled.' : 'That offer is no longer open.')}
        >
          Decline
        </button>
      </div>
    </section>
  )
}
