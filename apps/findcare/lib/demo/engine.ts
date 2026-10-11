// The demo's booking rules, standing in for FindCare's backend: what is open, holding a slot,
// booking, paying by transfer, waitlists and their offers, rescheduling and cancelling. Ported from
// the approved prototype's store. Queries read the state; actions change it through commit(), once
// each, so a nested action (accepting an offer reschedules, which books) saves and notifies once.
// Only @/lib/data imports this file.
import { addAppointment, addNotification, clinicOfBranch, isLive, lookup, sessionById, sessionsBetween, slotTimes, uid } from './records'
import { commit, getState } from './store'
import { addDays, age, fmtDate, nowMin, nowMs, periodOf, startMs, toMin, toTime, today } from './time'
import type {
  Account,
  Appointment,
  DayPeriod,
  DemoState,
  Doctor,
  Offer,
  Receipt,
  Session,
  SlotPick,
  WaitlistEntry,
} from './types'

const HOLD_MS = 5 * 60e3
const OFFER_MS = 30 * 60e3
// The demo has no clinic; it answers a request this long after it is sent, and its offered time
// stays open for the patient this long.
const CLINIC_RESPONSE_MS = 45e3
const REQUEST_OFFER_MS = 2 * 3600e3

// ---------- queries ----------

export const clinicOf = (branchId: string) => clinicOfBranch(getState(), branchId)
export const sessionFor = (id: string) => sessionById(getState(), id)
export { slotTimes }

const liveIn = (s: DemoState, sessionId: string) => Object.values(s.appointments).filter((a) => a.sessionId === sessionId && isLive(a))

function slotStateIn(s: DemoState, se: Session, time: string, holdId?: string) {
  const past = se.date === today() && toMin(time) <= nowMin() + 15
  const booked = liveIn(s, se.id).some((a) => a.time === time)
  const existing = lookup(s.holds, `${se.id}|${time}`)
  const held = !!existing && existing.expiresAt > nowMs() && existing.id !== holdId
  const offered = Object.values(s.offers).some((o) => o.status === 'active' && o.sessionId === se.id && o.time === time)
  return { time, available: !past && !booked && !held && !offered && se.status === 'active', past, taken: booked || held || offered }
}

function queueStateIn(s: DemoState, se: Session, holdId?: string) {
  const booked = liveIn(s, se.id).length
  const holds = Object.values(s.holds).filter((h) => h.sessionId === se.id && !h.time && h.expiresAt > nowMs() && h.id !== holdId).length
  const offers = Object.values(s.offers).filter((o) => o.status === 'active' && o.sessionId === se.id).length
  const started = se.date === today() && toMin(se.end) - 30 <= nowMin()
  const capacity = se.capacity ?? 0
  const remaining = Math.max(0, capacity - booked - holds - offers)
  return { booked, capacity, remaining, available: remaining > 0 && !started && se.status === 'active', started, nextNo: nextQueueNoIn(s, se, holdId) }
}

/**
 * The number the next person to join a queue gets. Numbers are called in order and never reused, so
 * it follows the highest number already given out (a cancelled place keeps its number), after any
 * places others are holding right now. What the page promises and what booking gives are the same.
 */
function nextQueueNoIn(s: DemoState, se: Session, holdId?: string) {
  const highest = Object.values(s.appointments).reduce((n, a) => (a.sessionId === se.id ? Math.max(n, a.queueNo ?? 0) : n), 0)
  const held = Object.values(s.holds).filter((h) => h.sessionId === se.id && !h.time && h.expiresAt > nowMs() && h.id !== holdId).length
  return highest + held + 1
}

export const slotState = (se: Session, time: string, holdId?: string) => slotStateIn(getState(), se, time, holdId)
export const queueState = (se: Session, holdId?: string) => queueStateIn(getState(), se, holdId)

/** A doctor's (or service's) sessions in the next two weeks, at one branch or all. */
export function doctorSessions(doctorId: string, branchId?: string, from = today(), to = addDays(today(), 13)) {
  return sessionsBetween(getState(), from, to)
    .filter((se) => se.doctorId === doctorId && (!branchId || se.branchId === branchId))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
}

export type NextOpening = { date: string; sessionId: string; mode: Session['mode']; time?: string; window?: string; remaining?: number }

export function nextOpening(doctorId: string, branchId?: string, from?: string, to?: string): NextOpening | null {
  for (const se of doctorSessions(doctorId, branchId, from, to)) {
    if (se.status !== 'active') continue
    if (se.mode === 'exact') {
      const time = slotTimes(se).find((t) => slotState(se, t).available)
      if (time) return { date: se.date, time, sessionId: se.id, mode: 'exact' }
    } else {
      const q = queueState(se)
      if (q.available) return { date: se.date, sessionId: se.id, mode: se.mode, window: `${se.start}–${se.end}`, remaining: q.remaining }
    }
  }
  return null
}

export type SearchFilters = { q?: string; spec?: string; location?: string; range?: 'any' | 'today' | '3d' | 'week'; availableOnly?: boolean }

/** One doctor or service at one branch, soonest opening first. */
export function search(f: SearchFilters) {
  const s = getState()
  const q = (f.q ?? '').trim().toLowerCase()
  const t = today()
  const [from, to] = { any: [t, addDays(t, 13)], today: [t, t], '3d': [t, addDays(t, 2)], week: [t, addDays(t, 6)] }[f.range ?? 'any']
  const rows = []
  for (const doctor of Object.values(s.doctors)) {
    const spec = s.specialties.find((x) => x.id === doctor.spec)!
    for (const branchId of Object.keys(doctor.fees)) {
      const branch = s.branches[branchId]
      const clinic = s.clinics[branch.clinicId]
      if (clinic.status !== 'active') continue
      if (f.spec && f.spec !== doctor.spec) continue
      if (f.location && f.location !== 'any' && branch.city !== f.location) continue
      if (q && ![doctor.name, spec.name, clinic.name, branch.name, branch.city].some((x) => x.toLowerCase().includes(q))) continue
      const next = clinic.paused ? null : nextOpening(doctor.id, branchId, from, to)
      if (f.availableOnly && !next) continue
      rows.push({ key: `${doctor.id}_${branchId}`, doctor, spec, branch, clinic, fee: doctor.fees[branchId], next, waitlist: !!clinic.types.waitlist })
    }
  }
  const when = (n: NextOpening) => n.date + (n.time ?? n.window)
  return rows.sort((a, b) => (!a.next ? (b.next ? 1 : 0) : !b.next ? -1 : when(a.next).localeCompare(when(b.next))))
}

export type SearchRow = ReturnType<typeof search>[number]

function pickAvailableIn(s: DemoState, pick: SlotPick, holdId?: string) {
  const se = sessionById(s, pick.sessionId)
  if (se.status !== 'active' || clinicOfBranch(s, se.branchId).paused) return false
  return pick.time ? slotStateIn(s, se, pick.time, holdId).available : queueStateIn(s, se, holdId).available
}

export const pickAvailable = (pick: SlotPick, holdId?: string) => pickAvailableIn(getState(), pick, holdId)

/** Whether a doctor sees someone of this age; the message says why not. */
function eligibleFor(d: Doctor, dob: string | null): { ok: true } | { ok: false; msg: string } {
  const a = age(dob)
  if (a == null) return { ok: true }
  if (d.ageMin != null && a < d.ageMin) return { ok: false, msg: `${d.name} sees patients aged ${d.ageMin} and over.` }
  if (d.ageMax != null && a > d.ageMax) return { ok: false, msg: `${d.name} sees patients aged ${d.ageMax} and under.` }
  return { ok: true }
}

export const eligible = (doctorId: string, dob: string | null) => eligibleFor(getState().doctors[doctorId], dob)

/** When a transfer must arrive: the clinic's window, but at least 30 minutes and no later than an hour before the visit. */
function payDue(se: Session, time: string | null | undefined, windowH: number) {
  const win = nowMs() + (windowH || 2) * 3600e3
  const cut = startMs(se.date, time || se.start) - 60 * 60e3
  return Math.max(nowMs() + 30 * 60e3, Math.min(win, cut))
}

/** What a clinic that requires paying ahead asks for, or null when paying at the clinic is fine. */
export function payTerms(branchId: string, doctorId: string, se?: Session, time?: string | null) {
  const s = getState()
  const pc = clinicOfBranch(s, branchId).pay
  if (pc.prepay !== 'required') return null
  const fee = s.doctors[doctorId].fees[branchId] ?? 0
  const amount = pc.deposit ? Math.min(pc.deposit, fee) : fee
  const hours = pc.windowH || 2
  const mins = se ? Math.round((payDue(se, time, hours) - nowMs()) / 60000) : hours * 60
  const within = se && mins < 120 ? `${mins} min` : `${hours}h`
  return { amount, deposit: !!pc.deposit, hours, short: !!se && mins < hours * 60, text: `${pc.deposit ? `MVR ${amount} deposit` : `MVR ${amount}`} by transfer within ${within}` }
}

/** How a clinic takes payment, in a few words. */
export function payMode(clinicId: string) {
  const p = getState().clinics[clinicId].pay
  if (p.prepay === 'required') return p.deposit ? 'Deposit required' : 'Transfer required'
  return p.transfer ? 'Pay ahead or at clinic' : 'Pay at clinic'
}

/** Whether a visit can still be changed online, or only by calling the branch. */
export function canChangeOnline(a: Appointment) {
  const s = getState()
  const c = clinicOfBranch(s, a.branchId)
  const se = sessionById(s, a.sessionId)
  return { ok: startMs(a.date, a.time || se.start) - nowMs() > c.cutoffH * 3600e3, cutoffH: c.cutoffH, phone: s.branches[a.branchId].phone }
}

/** Where a queue session has got to today: not started, or the number being served. */
export const queueLive = (se: Session) => queueLiveIn(getState(), se)

function queueLiveIn(s: DemoState, se: Session) {
  if (se.date !== today()) return { started: false, serving: 0, booked: 0 }
  const s0 = toMin(se.start)
  const e0 = toMin(se.end)
  const n = nowMin()
  const booked = liveIn(s, se.id).length
  if (n < s0) return { started: false, serving: 0, startsIn: s0 - n, booked }
  const per = (e0 - s0) / Math.max(1, se.capacity ?? 1)
  return { started: true, serving: Math.min(booked, Math.floor((n - s0) / per) + 1), per: Math.round(per), booked, ended: n >= e0 }
}

// ---------- the signed-in account ----------

export function currentAccount(): Account | null {
  const s = getState()
  return s.auth.accountId ? s.accounts[s.auth.accountId] : null
}

function expirePaymentsIn(s: DemoState) {
  let changed = false
  for (const a of Object.values(s.appointments)) {
    if (a.status === 'pending_payment' && a.pay?.method === 'transfer' && a.pay.dueAt && a.pay.dueAt < nowMs()) {
      a.status = 'cancelled'
      a.history.push({ at: nowMs(), text: 'Released — no payment received in time', by: 'System' })
      offerNextIn(s, a.sessionId, a.queueNo, a.time)
      changed = true
    }
    // The demo has no clinic to check receipts, so one is accepted 45 seconds after upload.
    if (a.status === 'payment_review' && a.pay?.method === 'transfer' && a.pay.autoVerifyAt && a.pay.autoVerifyAt < nowMs()) {
      a.pay.autoVerifyAt = null
      a.pay.status = 'verified'
      a.status = 'confirmed'
      a.history.push({ at: nowMs(), text: 'Payment verified', by: 'Clinic' })
      changed = true
    }
  }
  return changed
}

function expireOffersIn(s: DemoState) {
  let changed = false
  for (const o of Object.values(s.offers)) {
    if (o.status === 'active' && o.expiresAt < nowMs()) {
      o.status = 'expired'
      offerNextIn(s, o.sessionId, o.queueNo, o.time, o.waitlistId)
      changed = true
    }
  }
  return changed
}

/** Applies what time has done since the last look: lapsed payments and offers, verified receipts. */
/** Applies what time has done since the last look; saves and re-renders only when something changed. */
export function tick() {
  const s = getState()
  // every step runs (no short-circuit)
  const changed = [expirePaymentsIn(s), expireOffersIn(s), answerRequestsIn(s), progressVisitsIn(s)].some(Boolean)
  if (changed) commit(() => undefined)
}

const PERIOD_RANGE: Record<DayPeriod, [number, number]> = { morning: [0, 12 * 60], afternoon: [12 * 60, 17 * 60], evening: [17 * 60, 24 * 60] }

/**
 * The demo clinic answers requests: it offers the first free half hour inside the session's window
 * and the patient's preferred part of the day (any part when none fits). An offered time the patient
 * leaves for two hours lapses, and the request is cancelled.
 */
function answerRequestsIn(s: DemoState) {
  let changed = false
  for (const a of Object.values(s.appointments)) {
    if (a.status === 'offered' && a.offer && a.offer.expiresAt < nowMs()) {
      a.status = 'cancelled'
      a.history.push({ at: nowMs(), text: `Offered time ${a.offer.time} lapsed`, by: 'System' })
      a.offer = undefined
      changed = true
    }
    if (a.status !== 'requested' || !a.clinicRespondsAt || a.clinicRespondsAt > nowMs()) continue
    const se = sessionById(s, a.sessionId)
    const taken = new Set(liveIn(s, se.id).map((x) => x.time))
    const times: string[] = []
    for (let m = toMin(se.start); m + 30 <= toMin(se.end); m += 30) times.push(toTime(m))
    const free = times.filter((t) => !taken.has(t) && !(se.date === today() && toMin(t) <= nowMin() + 30))
    const [from, to] = a.preference && a.preference !== 'any' ? PERIOD_RANGE[a.preference] : [0, 24 * 60]
    const time = free.find((t) => toMin(t) >= from && toMin(t) < to) ?? free.at(0)
    a.clinicRespondsAt = undefined
    if (!time) continue
    a.status = 'offered'
    a.offer = { time, expiresAt: nowMs() + REQUEST_OFFER_MS }
    a.history.push({ at: nowMs(), text: `Clinic offered ${time}`, by: 'Clinic' })
    addNotification(s, a.id, 'request_offered', 'delivered')
    changed = true
  }
  return changed
}

/**
 * On the day, a checked-in visit moves on by itself: with the doctor once its queue number is being
 * served (or its time arrives), completed once the queue passes it (or its slot ends).
 */
function progressVisitsIn(s: DemoState) {
  let changed = false
  const t = today()
  for (const a of Object.values(s.appointments)) {
    if (a.date !== t || (a.status !== 'checked_in' && a.status !== 'in_progress') || !a.accountId) continue
    const se = sessionById(s, a.sessionId)
    let next: 'in_progress' | 'completed' | null = null
    if (a.queueNo) {
      const live = queueLiveIn(s, se)
      if (live.started && live.serving > a.queueNo) next = 'completed'
      else if (live.started && live.serving === a.queueNo) next = 'in_progress'
    } else if (a.time) {
      const startMin = toMin(a.time)
      if (nowMin() >= startMin + (se.slotMin ?? 20)) next = 'completed'
      else if (nowMin() >= startMin) next = 'in_progress'
    }
    if (!next || next === a.status) continue
    a.status = next
    a.history.push({ at: nowMs(), text: next === 'in_progress' ? 'Consultation started' : 'Consultation finished', by: 'Clinic' })
    changed = true
  }
  return changed
}

/** Takes the time the clinic offered for a request: confirmed, or held for payment when the clinic wants it first. */
export function acceptRequestOffer(apptId: string) {
  return commit((s) => {
    const a = lookup(s.appointments, apptId)
    if (!a || a.status !== 'offered' || !a.offer) return { ok: false }
    const se = sessionById(s, a.sessionId)
    const pc = clinicOfBranch(s, a.branchId).pay
    a.time = a.offer.time
    a.offer = undefined
    if (pc.prepay === 'required') {
      const fee = s.doctors[a.doctorId].fees[a.branchId] ?? 0
      const deposit = pc.deposit ? Math.min(pc.deposit, fee) : 0
      a.status = 'pending_payment'
      a.pay = { method: 'transfer', status: 'due', amount: deposit || fee, fee, deposit: !!deposit, dueAt: payDue(se, a.time, pc.windowH), receipt: null }
    } else a.status = 'confirmed'
    a.history.push({ at: nowMs(), text: `Accepted ${a.time}`, by: 'Patient' })
    addNotification(s, a.id, 'confirmation', 'delivered')
    return { ok: true }
  })
}

/** Turns down the time the clinic offered; the request is cancelled. */
export function declineRequestOffer(apptId: string) {
  return commit((s) => {
    const a = lookup(s.appointments, apptId)
    if (!a || a.status !== 'offered' || !a.offer) return { ok: false }
    a.history.push({ at: nowMs(), text: `Declined the offered ${a.offer.time}`, by: 'Patient' })
    a.status = 'cancelled'
    a.offer = undefined
    addNotification(s, a.id, 'cancellation', 'delivered')
    return { ok: true }
  })
}

/** The account's appointments: the holder's and their family's. */
export function accountAppointments(accountId: string) {
  const s = getState()
  const acc = lookup(s.accounts, accountId)
  if (!acc) return []
  const people = [acc.holderId, ...acc.familyIds]
  return Object.values(s.appointments).filter((a) => a.accountId === accountId && people.includes(a.patientId))
}

/** Offers on the account's waitlists that ran out or were taken in the last six hours, not yet dismissed. */
export function offerOutcomes(accountId: string) {
  const s = getState()
  const since = nowMs() - 6 * 3600e3
  return Object.values(s.offers).filter(
    (o) =>
      (o.status === 'expired' || o.status === 'withdrawn') &&
      !o.seen &&
      o.expiresAt > since &&
      lookup(s.waitlist, o.waitlistId)?.accountId === accountId &&
      !Object.values(s.offers).some((x) => x.status === 'active' && x.waitlistId === o.waitlistId),
  )
}

/** SMS the account has been sent, newest first. */
export function accountNotifications(accountId: string) {
  const s = getState()
  const mine = new Set(accountAppointments(accountId).map((a) => a.id))
  return Object.values(s.notifications)
    .filter((n) => (n.apptId && mine.has(n.apptId)) || (n.offerId && lookup(s.waitlist, lookup(s.offers, n.offerId)?.waitlistId)?.accountId === accountId))
    .sort((a, b) => b.at - a.at)
}

export const isSaved = (doctorId: string) => !!currentAccount()?.saved.includes(doctorId)

// ---------- holds & booking ----------

/** Holds a slot or queue place for five minutes while the patient finishes; renewing keeps the same hold. */
export function hold(pick: SlotPick, holdId?: string): { ok: true; id: string; expiresAt: number } | { ok: false } {
  return commit((s) => {
    for (const [k, h] of Object.entries(s.holds)) if (h.expiresAt < nowMs()) delete s.holds[k]
    if (!pickAvailableIn(s, pick, holdId)) return { ok: false as const }
    if (holdId) for (const [k, h] of Object.entries(s.holds)) if (h.id === holdId) delete s.holds[k]
    const id = holdId ?? uid('h')
    const expiresAt = nowMs() + HOLD_MS
    s.holds[`${pick.sessionId}|${pick.time || 'q' + id}`] = { id, sessionId: pick.sessionId, time: pick.time ?? null, expiresAt }
    return { ok: true as const, id, expiresAt }
  })
}

function releaseIn(s: DemoState, holdId: string) {
  for (const [k, h] of Object.entries(s.holds)) if (h.id === holdId) delete s.holds[k]
}

export const release = (holdId: string) => commit((s) => releaseIn(s, holdId))

export type NewPatient = { id?: string; name?: string; dob?: string | null; phone?: string | null; relation?: string | null }

export type BookingRequest = {
  pick: SlotPick
  holdId?: string
  patient: NewPatient
  accountId: string | null
  notif: string | null
  reason?: string
  /** Makes retrying the same booking (a double tap, a lost response) return the first one. */
  idemKey?: string
  payMethod?: 'clinic' | 'transfer'
  receipt?: Receipt | null
  fromOffer?: boolean
  /** The queue place an accepted offer was for; it keeps that number rather than joining the end. */
  queueNo?: number | null
  replaceApptId?: string
  /** For a request: the part of the day the patient prefers. */
  preference?: DayPeriod | 'any'
  by?: string
}

export type BookingResult =
  | { ok: true; appt: Appointment; duplicate?: boolean }
  | { ok: false; code: 'unavailable' | 'ineligible' | 'conflict' | 'missing' | Offer['status']; msg?: string; appt?: Appointment }

function bookIn(s: DemoState, o: BookingRequest): BookingResult {
  if (o.idemKey && s.idem[o.idemKey]) return { ok: true, appt: s.appointments[s.idem[o.idemKey]], duplicate: true }
  for (const [k, h] of Object.entries(s.holds)) if (h.expiresAt < nowMs()) delete s.holds[k]
  if (!pickAvailableIn(s, o.pick, o.holdId)) return { ok: false, code: 'unavailable' }
  const se = sessionById(s, o.pick.sessionId)

  let pid = o.patient.id
  if (!pid) {
    pid = uid('p')
    s.patients[pid] = { id: pid, name: o.patient.name ?? '', dob: o.patient.dob ?? null, phone: o.patient.phone ?? null, accountId: o.accountId, relation: o.patient.relation ?? null }
    if (o.accountId && o.patient.relation && o.patient.relation !== 'self') s.accounts[o.accountId].familyIds.push(pid)
  }
  const el = eligibleFor(s.doctors[se.doctorId], s.patients[pid].dob)
  if (!el.ok) return { ok: false, code: 'ineligible', msg: el.msg }

  const conflict = Object.values(s.appointments).find(
    (a) =>
      a.patientId === pid &&
      isLive(a) &&
      a.id !== o.replaceApptId &&
      a.date === se.date &&
      ((a.time && o.pick.time && Math.abs(toMin(a.time) - toMin(o.pick.time)) < 30) || a.sessionId === se.id),
  )
  if (conflict) return { ok: false, code: 'conflict', appt: conflict }

  const queueNo = se.mode === 'queue' ? (o.queueNo ?? nextQueueNoIn(s, se, o.holdId)) : null
  const isRequest = se.mode === 'request' && !o.fromOffer
  const pc = clinicOfBranch(s, se.branchId).pay
  const method = o.payMethod ?? (pc.prepay === 'required' ? 'transfer' : 'clinic')
  const needPay = !isRequest && method === 'transfer' && pc.prepay === 'required'
  const status = isRequest ? 'requested' : needPay ? (o.receipt ? 'payment_review' : 'pending_payment') : 'confirmed'

  const a = addAppointment(s, { sessionId: se.id, time: o.pick.time ?? null, queueNo, patientId: pid, accountId: o.accountId, status, source: 'online', notif: o.notif, reason: o.reason })
  a.createdAt = nowMs()
  a.history = [{ at: nowMs(), text: isRequest ? 'Request sent online — awaiting clinic' : 'Booked online', by: o.by ?? 'Patient' }]
  if (isRequest) {
    a.preference = o.preference ?? 'any'
    a.clinicRespondsAt = nowMs() + CLINIC_RESPONSE_MS
  }
  const fee = s.doctors[se.doctorId].fees[se.branchId] ?? 0
  const deposit = method === 'transfer' && pc.deposit ? Math.min(pc.deposit, fee) : 0
  a.pay =
    method === 'transfer'
      ? {
          method,
          status: o.receipt ? 'review' : 'due',
          amount: deposit || fee,
          fee,
          deposit: !!deposit,
          dueAt: needPay ? payDue(se, o.pick.time, pc.windowH) : null,
          receipt: o.receipt ?? null,
          autoVerifyAt: o.receipt ? nowMs() + 45000 : null,
        }
      : { method: 'clinic', status: 'at_clinic', amount: fee }
  if (o.receipt) a.history.push({ at: nowMs(), text: 'Transfer receipt uploaded', by: 'Patient' })
  if (o.holdId) releaseIn(s, o.holdId)
  if (o.idemKey) s.idem[o.idemKey] = a.id
  addNotification(s, a.id, isRequest ? 'request_received' : 'confirmation', 'delivered')
  return { ok: true, appt: a }
}

export const book = (o: BookingRequest) => commit((s) => bookIn(s, o))

export function cancel(apptId: string, reason?: string) {
  return commit((s) => {
    const a = lookup(s.appointments, apptId)
    if (!a || !isLive(a)) return { ok: false }
    a.status = 'cancelled'
    a.history.push({ at: nowMs(), text: 'Cancelled' + (reason ? ` — ${reason}` : ''), by: 'Patient' })
    if (a.pay?.method === 'transfer' && (a.pay.status === 'verified' || a.pay.status === 'review')) {
      a.pay.refund = { status: 'processing', amount: a.pay.amount, at: nowMs() }
      a.history.push({ at: nowMs(), text: `Refund of MVR ${a.pay.amount} started`, by: 'System' })
    }
    addNotification(s, a.id, 'cancellation', 'delivered')
    offerNextIn(s, a.sessionId, a.queueNo, a.time)
    return { ok: true }
  })
}

function rescheduleIn(s: DemoState, apptId: string, pick: SlotPick, holdId?: string, by = 'Patient'): BookingResult {
  const a = lookup(s.appointments, apptId)
  if (!a) return { ok: false, code: 'missing' }
  const r = bookIn(s, { pick, holdId, patient: { id: a.patientId }, accountId: a.accountId, notif: a.notif, reason: a.reason, replaceApptId: a.id, by })
  if (!r.ok) return r
  // What was paid carries over to the new time.
  if (a.pay && (a.pay.status === 'verified' || a.pay.status === 'review' || a.pay.status === 'at_clinic')) {
    r.appt.pay = a.pay
    if (r.appt.status === 'pending_payment' || r.appt.status === 'payment_review') r.appt.status = a.pay.status === 'review' ? 'payment_review' : 'confirmed'
  }
  r.appt.ref = a.ref
  r.appt.history = [...a.history, { at: nowMs(), text: `Rescheduled from ${fmtDate(a.date)} ${a.time ?? 'session'}`, by }]
  a.status = 'rescheduled'
  a.replacedBy = r.appt.id
  a.history.push({ at: nowMs(), text: `Replaced by new time ${fmtDate(r.appt.date)} ${r.appt.time ?? 'session'}`, by })
  for (const n of Object.values(s.notifications)) if (n.apptId === a.id) n.apptId = r.appt.id
  addNotification(s, r.appt.id, 'reschedule', 'delivered')
  offerNextIn(s, a.sessionId, a.queueNo, a.time)
  return r
}

export const reschedule = (apptId: string, pick: SlotPick, holdId?: string) => commit((s) => rescheduleIn(s, apptId, pick, holdId))

export function uploadReceipt(apptId: string, receipt: Receipt) {
  return commit((s) => {
    const a = lookup(s.appointments, apptId)
    if (!a) return { ok: false }
    const prev = a.pay?.method === 'transfer' ? a.pay : { amount: a.pay?.amount ?? 0 }
    a.pay = { ...prev, method: 'transfer', status: 'review', receipt, rejectReason: null, autoVerifyAt: nowMs() + 45000 }
    if (a.status === 'pending_payment') a.status = 'payment_review'
    a.history.push({ at: nowMs(), text: 'Transfer receipt uploaded', by: 'Patient' })
    return { ok: true }
  })
}

export function checkIn(apptId: string) {
  return commit((s) => {
    const a = lookup(s.appointments, apptId)
    if (!a || a.status !== 'confirmed' || a.date !== today()) return { ok: false }
    a.status = 'checked_in'
    a.checkedInAt = nowMs()
    a.history.push({ at: nowMs(), text: 'Checked in on arrival', by: 'Patient' })
    return { ok: true }
  })
}

export function editRequest(apptId: string, reason: string) {
  return commit((s) => {
    const a = lookup(s.appointments, apptId)
    if (!a || a.status !== 'requested') return { ok: false }
    a.reason = reason
    a.history.push({ at: nowMs(), text: 'Request note updated', by: 'Patient' })
    return { ok: true }
  })
}

export function toggleSaved(doctorId: string) {
  return commit((s) => {
    const a = s.auth.accountId ? s.accounts[s.auth.accountId] : null
    if (!a) return false
    const i = a.saved.indexOf(doctorId)
    if (i >= 0) a.saved.splice(i, 1)
    else a.saved.unshift(doctorId)
    return i < 0
  })
}

// ---------- waitlist ----------

function offerNextIn(s: DemoState, sessionId: string, queueNo: number | null, time?: string | null, skipWaitlistId?: string) {
  const se = sessionById(s, sessionId)
  if (se.status !== 'active' || se.date < today()) return null
  const period = periodOf(se.start)
  const tried = Object.values(s.offers).filter((o) => o.sessionId === sessionId && (o.time ?? null) === (time ?? null)).map((o) => o.waitlistId)
  const next = Object.values(s.waitlist)
    .filter(
      (w) =>
        w.status === 'active' &&
        w.doctorId === se.doctorId &&
        w.branchId === se.branchId &&
        w.id !== skipWaitlistId &&
        !tried.includes(w.id) &&
        (!w.dates || (se.date >= w.dates.from && se.date <= w.dates.to)) &&
        (!w.sessions.length || w.sessions.includes(period)) &&
        !Object.values(s.offers).some((o) => o.waitlistId === w.id && o.status === 'active'),
    )
    .filter((w) => {
      if (w.kind !== 'earlier') return true
      const linked = w.linkedApptId ? s.appointments[w.linkedApptId] : null
      return !!linked && se.date + (time || se.start) < linked.date + (linked.time || '00:00')
    })
    .sort((a, b) => a.createdAt - b.createdAt)
    .at(0)
  if (!next) return null
  const id = uid('o')
  s.offers[id] = { id, waitlistId: next.id, sessionId, time: time ?? null, queueNo, status: 'active', createdAt: nowMs(), expiresAt: nowMs() + OFFER_MS }
  addNotification(s, null, 'waitlist_offer', 'delivered', id)
  return s.offers[id]
}

export type WaitlistRequest = {
  patient: NewPatient
  accountId: string
  doctorId: string
  branchId: string
  dates: WaitlistEntry['dates']
  sessions: DayPeriod[]
  notif: string
  linkedApptId?: string
}

export function joinWaitlist(o: WaitlistRequest) {
  return commit((s) => {
    const id = uid('w')
    let pid = o.patient.id
    if (!pid) {
      pid = uid('p')
      s.patients[pid] = { id: pid, name: o.patient.name ?? '', dob: o.patient.dob ?? null, phone: null, accountId: o.accountId, relation: o.patient.relation ?? null }
      s.accounts[o.accountId].familyIds.push(pid)
    }
    s.waitlist[id] = {
      id, accountId: o.accountId, patientId: pid, doctorId: o.doctorId, branchId: o.branchId,
      kind: o.linkedApptId ? 'earlier' : 'new', linkedApptId: o.linkedApptId ?? null, dates: o.dates, sessions: o.sessions,
      status: 'active', createdAt: nowMs(), notif: o.notif,
    }
    return s.waitlist[id]
  })
}

export function leaveWaitlist(id: string) {
  commit((s) => {
    s.waitlist[id].status = 'left'
    for (const o of Object.values(s.offers)) {
      if (o.waitlistId === id && o.status === 'active') {
        o.status = 'withdrawn'
        offerNextIn(s, o.sessionId, o.queueNo, o.time, id)
      }
    }
  })
}

export function acceptOffer(offerId: string, idemKey?: string): BookingResult {
  return commit((s) => {
    expireOffersIn(s)
    const o = lookup(s.offers, offerId)
    if (!o) return { ok: false, code: 'missing' }
    if (o.status !== 'active') return { ok: false, code: o.status }
    const w = s.waitlist[o.waitlistId]
    o.status = 'accepting'
    const pick = { sessionId: o.sessionId, time: o.time }
    const r =
      w.kind === 'earlier' && w.linkedApptId
        ? rescheduleIn(s, w.linkedApptId, pick, undefined, 'Patient (waitlist)')
        : bookIn(s, { pick, patient: { id: w.patientId }, accountId: w.accountId, notif: w.notif, idemKey, fromOffer: true, queueNo: o.queueNo })
    if (!r.ok) {
      o.status = 'active'
      return r
    }
    o.status = 'accepted'
    o.apptId = r.appt.id
    w.status = 'fulfilled'
    w.fulfilledAt = nowMs()
    r.appt.history.push({ at: nowMs(), text: 'Booked from waitlist offer', by: 'Patient' })
    addNotification(s, r.appt.id, 'waitlist_accepted', 'delivered')
    return r
  })
}

export function declineOffer(offerId: string) {
  commit((s) => {
    const o = lookup(s.offers, offerId)
    if (o?.status !== 'active') return
    o.status = 'declined'
    offerNextIn(s, o.sessionId, o.queueNo, o.time, o.waitlistId)
  })
}

export const dismissOutcome = (offerId: string) =>
  commit((s) => {
    const o = lookup(s.offers, offerId)
    if (o) o.seen = true
  })

// ---------- signing in ----------

/** The account a sign-in provider (Google, Apple) is linked to, if any. */
export const linkedAccount = (provider: string) => Object.values(getState().accounts).find((a) => a.providers.includes(provider)) ?? null

export function signInAs(accountId: string, provider?: string) {
  return commit((s) => {
    s.auth.accountId = accountId
    if (provider) s.accounts[accountId].via = provider
    return s.accounts[accountId]
  })
}

/** Signs in with a phone number (the SMS code is not checked in the demo), creating the account if new. */
export function signInWithPhone(phone: string, name?: string) {
  return commit((s) => {
    const digits = phone.replace(/\s/g, '')
    let acc = Object.values(s.accounts).find((a) => a.phone.replace(/\s/g, '') === digits)
    if (!acc) {
      const id = uid('acc')
      const pid = uid('p')
      s.patients[pid] = { id: pid, name: name ?? '', dob: null, phone, accountId: id, relation: 'self' }
      acc = s.accounts[id] = { id, providers: [], phone, holderId: pid, familyIds: [], notifPhone: phone, notifSms: true, saved: [], isNew: true }
    } else if (name && !s.patients[acc.holderId].name) s.patients[acc.holderId].name = name
    s.auth.accountId = acc.id
    return acc
  })
}

export function linkProvider(provider: string) {
  commit((s) => {
    const a = s.auth.accountId ? s.accounts[s.auth.accountId] : null
    if (!a) return
    a.providers = [...new Set([...a.providers, provider])]
    a.via = provider
  })
}

export const signOut = () =>
  commit((s) => {
    s.auth.accountId = null
  })

// ---------- profile & family ----------

export type ProfilePatch = { name?: string; dob?: string | null; phone?: string | null; relation?: string | null }

export function updatePatient(patientId: string, patch: ProfilePatch) {
  commit((s) => {
    Object.assign(s.patients[patientId], patch)
  })
}

export function addFamilyMember(accountId: string, person: { name: string; dob: string | null; relation: string }) {
  return commit((s) => {
    const id = uid('p')
    s.patients[id] = { id, name: person.name, dob: person.dob, phone: null, accountId, relation: person.relation }
    s.accounts[accountId].familyIds.push(id)
    return s.patients[id]
  })
}

export function removeFamilyMember(accountId: string, patientId: string) {
  commit((s) => {
    s.accounts[accountId].familyIds = s.accounts[accountId].familyIds.filter((id) => id !== patientId)
  })
}

export function updateAccount(accountId: string, patch: Partial<Pick<Account, 'notifPhone' | 'notifSms'>>) {
  commit((s) => {
    Object.assign(s.accounts[accountId], patch)
  })
}

