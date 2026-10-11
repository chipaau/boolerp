'use client'

import { useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { Button } from '@/components/ui/button'
import { checkIn, clinicOf, db, nowMin, queueLive, sessionFor, toMin } from '@/lib/data'
import type { Account, Appointment } from '@/lib/data'

/**
 * Today's queue at a glance: the number being seen, yours, and a dot per place — served filled,
 * yours ringed. "I’ve arrived" checks in from an hour before the queue opens.
 */
export function QueueCard({ account, visit }: { account: Account; visit: Appointment }) {
  const [message, setMessage] = useState('')
  const s = db()
  const se = sessionFor(visit.sessionId)
  const live = queueLive(se)
  const mine = visit.queueNo ?? 0
  const serving = live.started ? live.serving : 0
  const ahead = Math.max(0, mine - serving)
  const places = Math.min(24, Math.max(mine, live.booked, 8))
  const checkedIn = visit.status === 'checked_in'
  const withDoctor = visit.status === 'in_progress'
  const canCheckIn = !checkedIn && !withDoctor && nowMin() >= toMin(se.start) - 60
  const doctor = s.doctors[visit.doctorId]
  const spec = s.specialties.find((x) => x.id === doctor.spec)
  const who = visit.patientId === account.holderId ? 'You' : s.patients[visit.patientId].name.split(' ')[0]

  return (
    <section aria-label="Live queue today" className="glass rounded-[20px] px-[18px] py-4">
      <div className="eyebrow flex items-center justify-between text-ink-500">
        <span className="flex items-center gap-[7px]">
          <span aria-hidden className="size-1.5 rounded-full bg-success-fg shadow-[0_0_0_3px_rgba(46,116,88,.15)]" />
          Live queue · today
        </span>
        <span>{who}</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2" aria-live="polite">
        <span className="text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{live.started ? `#${live.serving}` : se.start}</span>
        <span className="text-[12px] text-ink-600">
          {live.started ? 'now serving' : 'queue opens'} · yours is <b className="font-semibold text-ink-900">#{mine}</b>
        </span>
      </div>
      <div aria-hidden className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${places}, minmax(0, 1fr))` }}>
        {Array.from({ length: places }, (_, i) => (
          <span
            key={i}
            className={cn('h-3.5 rounded-[4px] transition-colors duration-300', i < serving ? 'bg-indigo-900' : i === mine - 1 ? 'bg-white shadow-[inset_0_0_0_1.5px_var(--indigo-500)]' : 'bg-line-2')}
          />
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3 text-[12px] text-ink-600">
        <span className="truncate">
          {spec?.name ?? doctor.name} · {clinicOf(visit.branchId).name}
        </span>
        <span className="shrink-0">
          {live.started ? (
            ahead ? (
              <>
                About <b className="font-semibold text-ink-900">{ahead * (live.per ?? 10)} min</b>
              </>
            ) : (
              <b className="font-semibold text-ink-900">{serving === mine ? 'It’s your turn' : 'You’re next'}</b>
            )
          ) : (
            <>
              Opens <b className="font-semibold text-ink-900">{se.start}</b>
            </>
          )}
        </span>
      </div>
      {canCheckIn && (
        <Button
          className="mt-3 w-full text-[10.5px]"
          onClick={() => setMessage(checkIn(visit.id).ok ? 'Checked in. Reception can see you’re here.' : 'Check-in isn’t open for this visit.')}
        >
          I’ve arrived
        </Button>
      )}
      {withDoctor && (
        <p role="status" className="mt-2.5 text-[12px] leading-[1.45] text-success-fg">
          It’s your turn. You’re with the doctor now.
        </p>
      )}
      {(checkedIn || message) && (
        <p role="status" className="mt-2.5 text-[12px] leading-[1.45] text-success-fg">
          {checkedIn ? 'Checked in. Stay nearby; we’ll text you when you’re two away.' : message}
        </p>
      )}
    </section>
  )
}
