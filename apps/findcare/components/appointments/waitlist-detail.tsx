'use client'

import { useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import { FactTile } from '@/components/ui/text'
import type { Account, WaitlistEntry } from '@/lib/data'
import { db, find, fmtDay, leaveWaitlist, payTerms } from '@/lib/data'
import { routes } from '@/lib/routes'
import { ConfirmRow } from './confirm-row'

/** A waitlist entry, opened under its row: what it waits for, how offers work, and leaving it. */
export function WaitlistDetail({
  entry: w,
  account,
  id,
  onMessage,
  onClose,
  onShowVisit,
}: {
  entry: WaitlistEntry
  account: Account
  id: string
  onMessage: (msg: string) => void
  onClose: () => void
  /** Opens the visit an "earlier time" entry would replace. */
  onShowVisit: (apptId: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const doctor = db().doctors[w.doctorId]
  const linked = find.appointment(w.linkedApptId)
  const terms = payTerms(w.branchId, w.doctorId)
  const active = w.status === 'active'
  const note = active
    ? `You’re in line for ${doctor.name}. When a time opens that fits, we text you and you get 30 minutes to take it.` +
      (terms ? ` Nothing is paid until you take a time; then it’s ${terms.text}.` : '')
    : w.status === 'fulfilled'
      ? 'Booked from this waitlist. See it under Upcoming.'
      : 'You left this waitlist.'

  return (
    <div id={id} className="flex flex-col gap-3.5 rounded-[20px] bg-white/55 px-5 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,.95)]">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-2">
        <FactTile label="Type" value={linked ? `Earlier than ${fmtDay(linked.date)}` : 'New visit'} />
        <FactTile label="Payment" value={terms ? 'Only when confirmed' : 'At clinic'} />
        <FactTile label="Texts to" value={w.notif || account.phone || '—'} />
      </div>
      <p className="text-[12.5px] leading-normal text-ink-700">{note}</p>
      {active &&
        (confirming ? (
          <ConfirmRow
            question="Leave this waitlist? You won’t be offered times that open up."
            confirmLabel="Leave waitlist"
            keepLabel="Stay on it"
            onKeep={() => setConfirming(false)}
            onConfirm={() => {
              leaveWaitlist(w.id)
              setConfirming(false)
              onClose()
              onMessage(`You’ve left the waitlist for ${doctor.name}.`)
            }}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={routes.doctor(w.doctorId, { branch: w.branchId })}>See open times</ButtonLink>
            {linked && (
              <Button variant="ghost" className="h-[38px] px-3.5" onClick={() => onShowVisit(linked.id)}>
                Current visit
              </Button>
            )}
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Leave waitlist
            </Button>
          </div>
        ))}
    </div>
  )
}
