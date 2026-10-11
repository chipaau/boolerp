'use client'

import { cn } from '@workspace/ui/lib/utils'
import { Panel } from '@/components/ui/card'
import { TimeSlot } from '@/components/ui/time-slot'
import { queueState, slotState, slotTimes } from '@/lib/data'
import type { Session, SlotPick } from '@/lib/data'

type Props = {
  sessions: Session[]
  pick: SlotPick | null
  holdId?: string
  /** The clinic has paused online booking: times show for reference only. */
  paused: boolean
  onPick: (p: SlotPick) => void
}

const picked = (pick: SlotPick | null, sessionId: string, time: string | null) => !!pick && pick.sessionId === sessionId && (pick.time ?? null) === time

/** A day's sessions, each in its own booking mode: exact times, a numbered walk-in queue, or a request window. */
export function SessionList({ sessions, ...rest }: Props) {
  if (sessions.length === 0) return <Panel className="text-[13px] text-ink-600">No sessions this day. Pick a day with a dot.</Panel>
  return (
    <>
      {sessions.map((se) => (
        <SessionBlock key={se.id} se={se} {...rest} />
      ))}
    </>
  )
}

function SessionBlock({ se, pick, holdId, paused, onPick }: Omit<Props, 'sessions'> & { se: Session }) {
  const cancelled = se.status !== 'active'
  if (se.mode === 'exact') {
    const slots = slotTimes(se).map((time) => {
      const st = slotState(se, time, holdId)
      return { time, off: !st.available || paused, taken: st.taken }
    })
    return (
      <Panel className="flex flex-col gap-3">
        <Header title={`Appointments · ${se.start}–${se.end}`} meta={cancelled ? 'Cancelled by clinic' : `${slots.filter((x) => !x.off).length} free`} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Times from ${se.start} to ${se.end}`}>
          {slots.map((x) => (
            <TimeSlot
              key={x.time}
              time={x.time}
              selected={picked(pick, se.id, x.time)}
              disabled={x.off}
              aria-label={`${x.time}${x.off ? (x.taken ? ', taken' : ', not available') : ''}`}
              onClick={() => onPick({ sessionId: se.id, time: x.time })}
            />
          ))}
        </div>
      </Panel>
    )
  }

  const q = queueState(se, holdId)
  const on = picked(pick, se.id, null)
  const off = !q.available || paused || cancelled
  const request = se.mode === 'request'
  const label = request
    ? off
      ? 'Requests closed · join the waitlist below'
      : on
        ? 'Selected · request this window'
        : 'Request this window'
    : off
      ? q.started
        ? 'Session has started'
        : 'Queue is full'
      : on
        ? `Selected · you’d be #${q.nextNo}`
        : `Join queue · you’d be #${q.nextNo}`
  const meta = cancelled ? 'Cancelled by clinic' : request ? (off ? 'Day is full' : 'Clinic confirms your time') : `${q.remaining} of ${q.capacity} places left`
  return (
    <Panel className="flex flex-col gap-3">
      <Header title={`${request ? 'Request a visit' : 'Walk-in queue'} · ${se.start}–${se.end}`} meta={meta} />
      <button
        type="button"
        disabled={off}
        aria-pressed={on}
        onClick={() => onPick({ sessionId: se.id, time: null })}
        className={cn(
          'h-10 rounded-full text-[12.5px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
          on ? 'bg-indigo-900 text-white' : off ? 'cursor-default bg-transparent text-ink-300' : 'cursor-pointer bg-white text-ink-900 shadow-outline hover-outline',
        )}
      >
        {label}
      </button>
      <p className="text-[12px] leading-normal text-pretty text-ink-600">
        {request
          ? 'This clinic doesn’t list exact times. Send a request for this window, say when suits you, and they’ll offer you an exact time to take.'
          : 'Numbers are called in order. On the day you can watch your place in the queue live.'}
      </p>
    </Panel>
  )
}

function Header({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex justify-between gap-2.5 text-[12px] font-medium text-ink-600">
      <span>{title}</span>
      <span>{meta}</span>
    </div>
  )
}
