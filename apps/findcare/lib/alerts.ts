// What needs the patient's attention, newest-first by kind: an earlier time offered from a waitlist,
// one that ran out, a payment due, a session the clinic cancelled, and visits in the next three days.
// The header's bell, My Care and Notifications all read this one list.
import { accountAppointments, addDays, clinicOf, db, fmtDay, minutesUntil, nowMs, offerOutcomes, sessionFor, today } from '@/lib/data'
import type { Account } from '@/lib/data'
import { routes } from './routes'

export type Alert = {
  key: string
  kind: 'offer' | 'request-offer' | 'offer-ended' | 'payment' | 'session-cancelled' | 'reminder'
  title: string
  sub: string
  href: string
}

/** The dot colour for each kind: offers rose, money and rebooking amber, reminders indigo. */
export const ALERT_DOT: Record<Alert['kind'], string> = {
  'request-offer': 'bg-rose-400',
  offer: 'bg-rose-400',
  'offer-ended': 'bg-ink-500',
  payment: 'bg-warning-dot',
  'session-cancelled': 'bg-warning-dot',
  reminder: 'bg-indigo-500',
}

export function alertsFor(account: Account): Alert[] {
  const s = db()
  const t = today()
  const mine = accountAppointments(account.id)
  const out: Alert[] = []
  const doctorName = (id: string) => s.doctors[id].name

  for (const o of Object.values(s.offers)) {
    if (o.status !== 'active' || o.expiresAt <= nowMs() || s.waitlist[o.waitlistId].accountId !== account.id) continue
    const se = sessionFor(o.sessionId)
    out.push({
      key: o.id,
      kind: 'offer',
      title: 'Earlier slot offered',
      sub: `${doctorName(se.doctorId)}, ${fmtDay(se.date)} ${o.time ?? se.start} · ${minutesUntil(o.expiresAt)} min left`,
      href: routes.appointments({ offer: o.id }),
    })
  }
  for (const o of offerOutcomes(account.id)) {
    const se = sessionFor(o.sessionId)
    out.push({
      key: o.id,
      kind: 'offer-ended',
      title: o.status === 'expired' ? 'Earlier slot expired' : 'Earlier slot was taken',
      sub: `${doctorName(se.doctorId)}. You’re still on the waitlist.`,
      href: routes.appointments({ tab: 'waitlists' }),
    })
  }
  for (const a of mine) {
    if (a.status === 'offered' && a.offer)
      out.push({
        key: a.id,
        kind: 'request-offer',
        title: 'Time offered',
        sub: `${doctorName(a.doctorId)} · ${fmtDay(a.date)} ${a.offer.time}. Take it before it lapses.`,
        href: routes.appointments({ appt: a.id }),
      })
    if (a.status === 'pending_payment')
      out.push({
        key: a.id,
        kind: 'payment',
        title: a.pay?.status === 'rejected' ? 'Receipt didn’t match' : 'Payment due',
        sub: `${doctorName(a.doctorId)} · ${fmtDay(a.date)}. Upload a receipt to keep this time.`,
        href: routes.appointments({ pay: a.id }),
      })
    if (a.status === 'needs_reschedule')
      out.push({
        key: a.id,
        kind: 'session-cancelled',
        title: 'Pick a new time',
        sub: `${doctorName(a.doctorId)} cancelled the ${fmtDay(a.date)} session.`,
        href: routes.doctor(a.doctorId, { branch: a.branchId, reschedule: a.id }),
      })
  }
  mine
    .filter((a) => a.status === 'confirmed' && a.date >= t && a.date <= addDays(t, 3))
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
    .forEach((a) => {
      const p = s.patients[a.patientId]
      const forWhom = p.id !== account.holderId ? ` · for ${p.name.split(' ')[0]}` : ''
      out.push({
        key: a.id,
        kind: 'reminder',
        title: `Reminder · ${fmtDay(a.date)}${a.time ? ` ${a.time}` : ''}`,
        sub: `${doctorName(a.doctorId)} · ${clinicOf(a.branchId).name}${forWhom}`,
        href: routes.appointments({ appt: a.id }),
      })
    })
  return out
}
