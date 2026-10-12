'use client'

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import type { Account, Offer } from '@/lib/data'
import { acceptOffer, db, declineOffer, dismissOutcome, find, fmtDay, nowMs, offerOutcomes, payTerms, sessionFor } from '@/lib/data'

const clock = (ms: number) => {
  const s = Math.floor(Math.max(0, ms) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** The account's live waitlist offers, the one being linked to (?offer=) first. */
export function activeOffers(accountId: string, first?: string | null) {
  const s = db()
  return Object.values(s.offers)
    .filter((o) => o.status === 'active' && o.expiresAt > nowMs() && find.waitlist(o.waitlistId)?.accountId === accountId)
    .sort((a, b) => Number(b.id === first) - Number(a.id === first) || a.expiresAt - b.expiresAt)
}

const slotLine = (o: Offer) => {
  const se = sessionFor(o.sessionId)
  return `${db().doctors[se.doctorId].name}, ${fmtDay(se.date)} ${o.time ?? se.start}`
}

/**
 * An earlier slot offered from a waitlist: 30 minutes to take it or say no thanks. The dark banner is
 * the one heavy element on the page, so an offer is not missed.
 */
export function OfferBanner({ offer: o, onMessage }: { offer: Offer; onMessage: (msg: string) => void }) {
  // The page redraws every few seconds; the m:ss countdown needs every second.
  const [now, setNow] = useState(nowMs)
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowMs()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const se = sessionFor(o.sessionId)
  const terms = payTerms(se.branchId, se.doctorId, se, o.time)
  return (
    <Banner
      tone="offer"
      title="Earlier slot"
      className="gap-x-3.5 gap-y-2.5 pl-5"
      action={
        <span className="flex items-center gap-2">
          <span className="text-[11.5px] font-medium text-indigo-300 tabular-nums">
            <span className="sr-only">Time left to take it: </span>
            {clock(o.expiresAt - now)} left
          </span>
          <Button
            size="sm"
            className="h-8 bg-white px-4 text-ink-900 hover:bg-indigo-100"
            onClick={() => {
              const r = acceptOffer(o.id, `k${o.id}`)
              onMessage(
                r.ok
                  ? `${r.appt.status === 'pending_payment' ? 'Held · pay to confirm' : 'Booked ·'} ${fmtDay(r.appt.date)} ${r.appt.time ?? `queue #${r.appt.queueNo}`}`
                  : 'That offer is no longer available.',
              )
            }}
          >
            Take it
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-[12px] text-indigo-300 hover:bg-transparent hover:text-white"
            onClick={() => {
              declineOffer(o.id)
              onMessage('Offer declined. You stay on the waitlist.')
            }}
          >
            No thanks
          </Button>
        </span>
      }
    >
      · {slotLine(o)}
      {terms ? ` · then pay ${terms.text}` : ''}
    </Banner>
  )
}

/** Offers that ran out or went to someone else while the patient was away, until dismissed. */
export function OfferOutcomes({ account }: { account: Account }) {
  return offerOutcomes(account.id).map((o) => (
    <Banner
      key={o.id}
      tone="neutral"
      className="rounded-[18px]"
      title={o.status === 'expired' ? 'Earlier slot expired' : 'Earlier slot was taken'}
      action={
        <IconButton label="Dismiss" variant="ghost" size={32} onClick={() => dismissOutcome(o.id)}>
          <X aria-hidden className="size-3" strokeWidth={2} />
        </IconButton>
      }
    >
      · {slotLine(o)}. You’re still on the waitlist and we’ll text you if another opens.
    </Banner>
  ))
}
