'use client'

import { cn } from '@workspace/ui/lib/utils'
import { Button } from '@/components/ui/button'
import type { Appointment } from '@/lib/data'
import { checkIn, nowMin, queueLive, sessionFor, toMin, today } from '@/lib/data'
import { isUpcoming } from './summary'

/** Whether a visit is a numbered queue place today, still to be seen: the live queue is for these. */
export function showsQueue(a: Appointment) {
  return isUpcoming(a) && !!a.queueNo && a.date === today() && (a.status === 'confirmed' || a.status === 'checked_in')
}

/**
 * Today's queue: the number being served, the patient's own, how far ahead, and "I’ve arrived" from an
 * hour before the start. Render it only when showsQueue(appt); call useNow() in the parent so it moves.
 */
export function LiveQueue({ appt: a, onMessage }: { appt: Appointment; onMessage: (msg: string) => void }) {
  const se = sessionFor(a.sessionId)
  const queueNo = a.queueNo ?? 0
  const live = queueLive(se)
  const ahead = Math.max(0, queueNo - live.serving)
  const inside = a.status === 'checked_in'
  const missed = live.started && live.serving > queueNo && !inside
  const canCheckIn = !inside && nowMin() >= toMin(se.start) - 60

  const sub = !live.started
    ? 'first number is called at the start'
    : missed
      ? 'now serving · your number has been called'
      : ahead === 0
        ? 'now serving · you’re next'
        : `now serving · ${ahead} ahead of you, about ${ahead * (live.per ?? 10)} min`
  const note = missed
    ? 'Your number was called while you weren’t checked in. Tell reception you’re here and they’ll fit you in after the current patient.'
    : inside
      ? 'You’re checked in. Stay nearby; we’ll text you when you’re two away.'
      : canCheckIn
        ? 'Tap “I’ve arrived” at the clinic so reception knows you’re here.'
        : 'Check-in opens an hour before the queue starts. We’ll text you a reminder.'

  return (
    <section aria-label="Live queue" className={cn('flex flex-col gap-2.5 rounded-2xl px-4 py-3.5', missed ? 'bg-warning-bg' : 'bg-wash-1')}>
      <div className="eyebrow flex items-center justify-between gap-2.5 text-ink-500">
        <span className="flex items-center gap-[7px]">
          <span aria-hidden className={cn('size-1.5 rounded-full', live.started ? 'bg-success-fg' : 'bg-ink-500')} />
          {live.started ? 'Live queue · now' : `Queue opens ${se.start}`}
        </span>
        <span className="text-ink-900">Your number #{queueNo}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-2.5" aria-live="polite">
        <span className="text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{live.started ? `#${live.serving}` : se.start}</span>
        <span className="text-[12.5px] text-ink-600">{sub}</span>
      </div>
      <p className="text-[12.5px] leading-normal text-ink-700">{note}</p>
      {canCheckIn && (
        <Button
          className="self-start"
          onClick={() => {
            const r = checkIn(a.id)
            onMessage(r.ok ? 'Checked in. Reception can see you’re here.' : 'Check-in isn’t open for this visit.')
          }}
        >
          I’ve arrived
        </Button>
      )}
    </section>
  )
}
