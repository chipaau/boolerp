'use client'

import { Download } from 'lucide-react'
import { useState } from 'react'
import { Button, ButtonLink, buttonClass } from '@/components/ui/button'
import { FactTile } from '@/components/ui/text'
import { LiveQueue, showsQueue } from '@/components/visits/live-queue'
import { RequestOffer, showsRequestOffer } from '@/components/visits/request-offer'
import { isUpcoming } from '@/components/visits/summary'
import { TransferPanel, showsTransfer } from '@/components/visits/transfer-panel'
import type { Appointment } from '@/lib/data'
import { canChangeOnline, cancel, clinicOf, db, fmtDate, sessionFor } from '@/lib/data'
import { routes } from '@/lib/routes'
import { calendarHref, directionsHref, visitReceiptHref } from '@/lib/visit-files'
import { ConfirmRow } from './confirm-row'
import { RequestNote } from './request-note'

const PAY_WORD = {
  verified: 'paid',
  review: 'checking',
  due: 'due',
  rejected: 'due',
  at_clinic: 'at clinic',
} as const

function paymentFact(a: Appointment) {
  const amount = a.pay?.amount ?? db().doctors[a.doctorId].fees[a.branchId]
  if (!a.pay) return amount ? `MVR ${amount}` : '—'
  const refunding = a.pay.method === 'transfer' && a.pay.refund ? ' · refunding' : ''
  return `MVR ${amount} · ${PAY_WORD[a.pay.status]}${refunding}`
}

/** The line under the facts: a refund on its way, what happens to a request, or how to arrive. */
function noteFor(a: Appointment, upcoming: boolean) {
  const clinic = clinicOf(a.branchId)
  if (a.pay?.method === 'transfer' && a.pay.refund) return `Refund of MVR ${a.pay.refund.amount} is on its way to your bank account. It usually takes 3–5 working days.`
  if (a.status === 'requested')
    return `The clinic will offer you an exact time${a.preference && a.preference !== 'any' ? ` in the ${a.preference}` : ''} and text you. You take it here.`
  if (a.status === 'waitlisted') return 'That day filled up, so you’re on the waitlist. We’ll text you if a place opens.'
  if (a.status === 'needs_reschedule') {
    const reason = sessionFor(a.sessionId).reason
    return `${clinic.name} cancelled this session${reason ? ` (${reason})` : ''}. Pick a new time, or cancel.`
  }
  if (upcoming) return [clinic.arrive, a.reason && `Reason: ${a.reason}.`].filter(Boolean).join(' ')
  return `Visited ${fmtDate(a.date)}.`
}

/** Everything about one visit, opened under its row: facts, payment, queue, request, history and actions. */
export function AppointmentDetail({ appt: a, id, onMessage, onClose }: { appt: Appointment; id: string; onMessage: (msg: string) => void; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const upcoming = isUpcoming(a)
  // Read before cancelling: the action changes the record in place.
  const isRequest = a.status === 'requested'
  const change = upcoming ? canChangeOnline(a) : null
  const branch = db().branches[a.branchId]
  const refundOnCancel = a.pay?.method === 'transfer' && (a.pay.status === 'verified' || a.pay.status === 'review')

  return (
    <div id={id} className="flex flex-col gap-3.5 rounded-[20px] bg-white/55 px-5 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,.95)]">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-2">
        <FactTile label="Reference" value={a.ref} />
        <FactTile label="Payment" value={paymentFact(a)} />
        <FactTile label="Location" value={branch.city || branch.name.split(' — ')[0]} />
      </div>

      {showsTransfer(a) && <TransferPanel appt={a} onMessage={onMessage} />}
      {showsQueue(a) && <LiveQueue appt={a} onMessage={onMessage} />}
      {a.status === 'requested' && <RequestNote appt={a} onMessage={onMessage} />}
      {showsRequestOffer(a) && <RequestOffer appt={a} onMessage={onMessage} />}

      <p className="text-[12.5px] leading-normal text-ink-700">{noteFor(a, upcoming)}</p>

      {confirming ? (
        <ConfirmRow
          question={
            refundOnCancel && a.pay
              ? `Cancel this visit? Your MVR ${a.pay.amount} goes back to your bank account in 3–5 working days.`
              : 'Cancel this visit? The time goes back to other patients.'
          }
          confirmLabel="Cancel visit"
          keepLabel="Keep it"
          onKeep={() => setConfirming(false)}
          onConfirm={() => {
            const r = cancel(a.id, 'Patient')
            setConfirming(false)
            if (r.ok) {
              onClose()
              onMessage(
                isRequest
                  ? 'Request withdrawn.'
                  : refundOnCancel && a.pay
                    ? `Visit cancelled. Your MVR ${a.pay.amount} is on its way back to your bank account.`
                    : 'Visit cancelled. The time goes back to other patients.',
              )
            } else onMessage('This visit can no longer be cancelled online.')
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <a href={directionsHref(a.branchId)} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: 'primary' })}>
            Directions
          </a>
          {upcoming && (
            <a href={calendarHref(a)} download={`findcare-${a.ref}.ics`} className={buttonClass({ variant: 'outline' }, 'px-4')}>
              Add to calendar
            </a>
          )}
          {change?.ok && (
            <>
              <ButtonLink variant="outline" href={routes.doctor(a.doctorId, { branch: a.branchId, reschedule: a.id })}>
                {isRequest ? 'Change request' : 'Reschedule'}
              </ButtonLink>
              <Button variant="danger" onClick={() => setConfirming(true)}>
                {isRequest ? 'Withdraw request' : 'Cancel'}
              </Button>
            </>
          )}
          {!upcoming && (
            <>
              <ButtonLink variant="outline" href={routes.doctor(a.doctorId, { branch: a.branchId })}>
                {a.status === 'completed' ? 'Book follow-up' : 'Book again'}
              </ButtonLink>
              {a.status === 'completed' && (
                <a href={visitReceiptHref(a)} download={`findcare-receipt-${a.ref}.html`} className={buttonClass({ variant: 'ghost' }, 'h-[38px] px-4')}>
                  <Download aria-hidden className="size-[13px]" strokeWidth={1.8} />
                  Visit receipt
                </a>
              )}
            </>
          )}
          {change && !change.ok && <ClosedNote phone={change.phone || branch.phone} />}
        </div>
      )}
    </div>
  )
}

/** Past the clinic's cutoff, changes go by phone. */
function ClosedNote({ phone }: { phone?: string }) {
  return (
    <span className="text-[12px] text-ink-500">
      Online changes have closed. Call{' '}
      {phone ? (
        <a href={`tel:${phone.replace(/\s/g, '')}`} className="text-ink-500 underline-offset-2 hover:text-ink-900 hover:text-indigo-500">
          {phone}
        </a>
      ) : (
        'the clinic'
      )}
      .
    </span>
  )
}
