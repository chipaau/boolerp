import { ArrowLeftRight, Bell, Check, Clock, TriangleAlert, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@workspace/ui/lib/utils'
import { TINT } from '@/components/ui/avatar'
import { db, find, fmtDay, nowMs, sessionFor } from '@/lib/data'
import type { Account, Notification, NotificationType, Tint } from '@/lib/data'
import { routes } from '@/lib/routes'

const KIND: Record<NotificationType, { title: string; icon: LucideIcon; tint: Tint | 'muted' }> = {
  confirmation: { title: 'Booking confirmed', icon: Check, tint: 'mint' },
  request_received: { title: 'Request received', icon: Clock, tint: 'lilac' },
  request_offered: { title: 'Time offered', icon: Clock, tint: 'peach' },
  reminder: { title: 'Reminder', icon: Bell, tint: 'blue' },
  cancellation: { title: 'Visit cancelled', icon: X, tint: 'muted' },
  reschedule: { title: 'Visit moved', icon: ArrowLeftRight, tint: 'lilac' },
  waitlist_offer: { title: 'Earlier slot offered', icon: Clock, tint: 'peach' },
  waitlist_accepted: { title: 'Booked from waitlist', icon: Check, tint: 'mint' },
  waitlisted: { title: 'Added to waitlist', icon: Clock, tint: 'lilac' },
  session_cancelled: { title: 'Session cancelled by clinic', icon: TriangleAlert, tint: 'butter' },
}

const ago = (at: number) => {
  const m = Math.max(1, Math.round((nowMs() - at) / 60000))
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`
}

/** One text the account was sent: what it was about, when, and whether it reached the phone. */
export function SmsRow({ n, account }: { n: Notification; account: Account }) {
  const s = db()
  const k = KIND[n.type]
  const appt = find.appointment(n.apptId)
  const offer = find.offer(n.offerId)
  const sessionId = appt?.sessionId ?? offer?.sessionId
  const se = sessionId ? sessionFor(sessionId) : null
  const who = appt ? s.patients[appt.patientId] : null
  const time = appt?.time ?? offer?.time
  const sub = se
    ? `${s.doctors[se.doctorId].name} · ${fmtDay(se.date)}${time ? ` ${time}` : ''}${who && who.id !== account.holderId ? ` · for ${who.name.split(' ')[0]}` : ''}`
    : ''
  const failed = n.status === 'failed'
  const Icon = k.icon
  return (
    <Link
      href={appt ? routes.appointments({ appt: appt.id }) : routes.appointments({ tab: 'waitlists' })}
      className="flex gap-3 rounded-[14px] p-3 text-ink-900 no-underline transition-colors hover-glass"
    >
      <span className={cn('flex size-[34px] shrink-0 items-center justify-center rounded-full', k.tint === 'muted' ? 'bg-wash-3 text-ink-600' : TINT[k.tint])}>
        <Icon aria-hidden className="size-[15px]" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex justify-between gap-2.5">
          <span className="text-[13.5px] font-semibold">{k.title}</span>
          <span className="shrink-0 text-[11.5px] text-ink-500 tabular-nums">{ago(n.at)}</span>
        </span>
        {sub && <span className="mt-[3px] block text-[12.5px] leading-[1.45] text-ink-600">{sub}</span>}
        <span className={cn('mt-1 block text-[11px] font-medium', failed ? 'text-danger' : 'text-ink-500')}>
          Text to {account.notifPhone || account.phone} · {failed ? 'not delivered' : 'delivered'}
        </span>
      </span>
    </Link>
  )
}
