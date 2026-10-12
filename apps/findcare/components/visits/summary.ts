// How a visit reads in a list: the date tile, who and where, the status in words. Shared by
// Appointments and My Care so a visit says the same thing on both.
import type { StatusTone } from '@/components/ui/status-pill'
import type { Appointment, AppointmentStatus, Patient, WaitlistEntry } from '@/lib/data'
import { MON, clinicOf, db, fmtDay, sessionFor, today } from '@/lib/data'

export const STATUS: Record<AppointmentStatus, { label: string; tone: StatusTone }> = {
  confirmed: { label: 'Confirmed', tone: 'confirmed' },
  checked_in: { label: 'Checked in', tone: 'confirmed' },
  in_progress: { label: 'With the doctor', tone: 'confirmed' },
  needs_reschedule: { label: 'Needs a new time', tone: 'attention' },
  pending_payment: { label: 'Payment due', tone: 'attention' },
  requested: { label: 'Awaiting clinic', tone: 'waiting' },
  offered: { label: 'Time offered', tone: 'attention' },
  payment_review: { label: 'Checking payment', tone: 'waiting' },
  waitlisted: { label: 'Waitlisted', tone: 'waiting' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
  completed: { label: 'Completed', tone: 'muted' },
  no_show: { label: 'Missed', tone: 'muted' },
  rescheduled: { label: 'Rescheduled', tone: 'muted' },
}

/** What one row shows; an appointment and a waitlist entry both reduce to it. */
export type VisitSummary = {
  day: string
  month: string
  title: string
  status: { label: string; tone: StatusTone }
  sub: string
  when: string
  who: string
}

const ENDED: AppointmentStatus[] = ['cancelled', 'completed', 'no_show', 'rescheduled']

/** Still to come: not ended, and today or later. A visit earlier today that is still live stays upcoming. */
export const isUpcoming = (a: Appointment) => !ENDED.includes(a.status) && a.date >= today()

/** "You" for the account holder, else the family member's first name. */
export function whoFor(patientId: string, holderId: string) {
  const p = db().patients[patientId] as Patient | undefined
  if (!p) return ''
  return p.id === holderId ? 'You' : p.name.split(' ')[0]
}

/** "Pediatrics · Lagoon Medical Centre · Hulhumalé" */
export function placeLine(doctorId: string, branchId: string) {
  const s = db()
  const spec = s.specialties.find((x) => x.id === s.doctors[doctorId].spec)
  return [spec?.name, clinicOf(branchId).name, s.branches[branchId].name.split(' — ')[0]].filter(Boolean).join(' · ')
}

/** When, in the visit's own terms: a time, a queue number, or the window a request asked for. */
export function whenLine(a: Appointment) {
  const se = sessionFor(a.sessionId)
  const at = a.time ?? (a.offer ? `${a.offer.time} offered` : a.queueNo ? `Queue #${a.queueNo}` : `${se.start}–${se.end} window`)
  return `${fmtDay(a.date)} · ${at}`
}

export function appointmentSummary(a: Appointment, holderId: string): VisitSummary {
  return {
    day: String(Number(a.date.slice(8, 10))),
    month: MON[Number(a.date.slice(5, 7)) - 1],
    title: db().doctors[a.doctorId].name,
    status: STATUS[a.status],
    sub: placeLine(a.doctorId, a.branchId),
    when: whenLine(a),
    who: whoFor(a.patientId, holderId),
  }
}

export function waitlistSummary(w: WaitlistEntry, holderId: string): VisitSummary {
  const d = db().doctors[w.doctorId]
  const status =
    w.status === 'active'
      ? { label: 'Waiting', tone: 'waiting' as const }
      : {
          label: w.status === 'fulfilled' ? 'Booked' : 'Left',
          tone: 'muted' as const,
        }
  return {
    day: '—',
    month: 'Waitlist',
    title: d.name,
    status,
    sub: placeLine(w.doctorId, w.branchId),
    when: (d.kind === 'service' ? 'Next opening for this service' : 'Next opening with this doctor') + (w.sessions.length ? ` · ${w.sessions.join(', ')}` : ''),
    who: whoFor(w.patientId, holderId),
  }
}
