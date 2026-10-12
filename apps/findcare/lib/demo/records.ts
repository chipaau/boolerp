// Building blocks shared by the seed data and the engine: expanding schedules into sessions, and
// creating appointments and notifications in a state.
import { addDays, dow, nowMs, toMin, toTime } from './time'
import type { Appointment, DemoState, Notification, NotificationType, Session } from './types'

/** A stable pseudo-random number in [0, 1] for a string, so the seeded clinic days look the same all day. */
export const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

/** A record by id, honestly typed: ids from a URL or saved data may name nothing. */
export const lookup = <T>(records: Record<string, T>, id: string | null | undefined): T | undefined => (id && Object.hasOwn(records, id) ? records[id] : undefined)

export const uid = (prefix: string) => prefix + Math.random().toString(36).slice(2, 8)

const bookingRef = (clinicShort: string) => `${clinicShort}-${Math.floor(1000 + Math.random() * 9000)}`

const sessionOf = (s: DemoState, schedId: string, date: string): Session => {
  const sc = s.schedules[schedId]
  const id = `${schedId}_${date}`
  const ov = s.sessionOverrides[id] ?? {}
  return {
    id,
    schedId,
    doctorId: sc.doctorId,
    branchId: sc.branchId,
    date,
    start: ov.start ?? sc.start,
    end: ov.end ?? sc.end,
    mode: sc.mode,
    slotMin: sc.slotMin,
    capacity: ov.capacity ?? sc.capacity,
    status: ov.status ?? 'active',
    reason: ov.reason ?? '',
  }
}

/** Every session from `from` to `to`, inclusive. */
export function sessionsBetween(s: DemoState, from: string, to: string): Session[] {
  const out: Session[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const sc of Object.values(s.schedules)) if (sc.days.includes(dow(d))) out.push(sessionOf(s, sc.id, d))
  }
  return out
}

export function sessionById(s: DemoState, id: string): Session {
  const i = id.lastIndexOf('_')
  return sessionOf(s, id.slice(0, i), id.slice(i + 1))
}

/** The start times of an exact-time session's slots. */
export function slotTimes(se: Session): string[] {
  const out: string[] = []
  const step = se.slotMin ?? 0
  if (!step) return out
  for (let m = toMin(se.start); m + step <= toMin(se.end); m += step) out.push(toTime(m))
  return out
}

export const clinicOfBranch = (s: DemoState, branchId: string) => s.clinics[s.branches[branchId].clinicId]

type NewAppointment = Pick<Appointment, 'sessionId' | 'patientId' | 'status' | 'source'> & Partial<Pick<Appointment, 'time' | 'queueNo' | 'accountId' | 'notif' | 'reason' | 'ref'>>

const bookedBy = (source: Appointment['source']) =>
  source === 'online'
    ? { text: 'Booked online', by: 'Patient' }
    : source === 'phone'
      ? { text: 'Booked by reception (phone)', by: 'Reception' }
      : { text: 'Walk-in added by reception', by: 'Reception' }

export function addAppointment(s: DemoState, o: NewAppointment): Appointment {
  const se = sessionById(s, o.sessionId)
  const id = uid('a')
  const at = nowMs() - 864e5
  const a: Appointment = {
    id,
    ref: o.ref ?? bookingRef(clinicOfBranch(s, se.branchId).short),
    sessionId: o.sessionId,
    doctorId: se.doctorId,
    branchId: se.branchId,
    date: se.date,
    kind: se.mode,
    time: o.time ?? null,
    queueNo: o.queueNo ?? null,
    patientId: o.patientId,
    accountId: o.accountId ?? null,
    status: o.status,
    source: o.source,
    notif: o.notif ?? null,
    reason: o.reason ?? '',
    createdAt: at,
    history: [{ at, ...bookedBy(o.source) }],
  }
  s.appointments[id] = a
  return a
}

export function addNotification(s: DemoState, apptId: string | null, type: NotificationType, status: Notification['status'], offerId: string | null = null): Notification {
  const id = uid('n')
  const n: Notification = {
    id,
    apptId,
    offerId,
    type,
    channel: 'SMS',
    status,
    at: nowMs() - Math.floor(Math.random() * 3600e3),
    attempts: status === 'failed' ? 2 : 1,
  }
  s.notifications[id] = n
  return n
}

/** Not cancelled and not replaced by a rescheduled one. */
export const isLive = (a: Appointment) => a.status !== 'cancelled' && a.status !== 'rescheduled'
