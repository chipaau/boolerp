// What My Care shows, derived from the data: the next visit, the one card that most needs the
// patient, today's queue, who is open soon, their doctors and their family. Plain functions, no
// React, so each card stays a view.
import { directionsHref } from '@/lib/visit-files'
import { isUpcoming } from '@/components/visits/summary'
import type { Account, Appointment, NextOpening, SearchRow } from '@/lib/data'
import { accountAppointments, addDays, age, clinicOf, db, fmtDay, nowMs, payTerms, queueLive, search, sessionFor, today } from '@/lib/data'
import { knownDoctors } from '@/lib/known-doctors'
import { routes } from '@/lib/routes'

const byTime = (a: Appointment, b: Appointment) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? ''))

/** Days from today: 0 today, 1 tomorrow. */
export const daysUntil = (date: string) => Math.round((Date.parse(date) - Date.parse(today())) / 864e5)

/** "Today", "Tomorrow", "In 3 days". */
export const relativeDay = (date: string) => {
  const d = daysUntil(date)
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`
}

/** The account's visits still to come, soonest first. */
export const upcomingVisits = (account: Account) => accountAppointments(account.id).filter(isUpcoming).sort(byTime)

/** Today's queue visit (yours or a family member's), if there is one. */
export const todaysQueue = (account: Account) =>
  accountAppointments(account.id).find((a) => a.date === today() && a.queueNo && (a.status === 'confirmed' || a.status === 'checked_in' || a.status === 'in_progress'))

/** The line under the greeting. */
export function subline(account: Account) {
  const queue = todaysQueue(account)
  if (queue) {
    const se = sessionFor(queue.sessionId)
    const live = queueLive(se)
    return live.started ? `Your queue is moving. Number ${live.serving} is being seen.` : `You’re in today’s queue. It opens at ${se.start}.`
  }
  const next = upcomingVisits(account).at(0)
  if (!next) return 'Nothing booked yet.'
  const d = daysUntil(next.date)
  return `Next visit ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}, with ${db().doctors[next.doctorId].name}.`
}

/** What the next-visit card says under the facts: what to do, or the clinic's arrival advice. */
export function visitNote(a: Appointment) {
  switch (a.status) {
    case 'pending_payment':
      return 'Upload your transfer receipt to keep this time.'
    case 'payment_review':
      return 'Receipt sent. The clinic is checking it.'
    case 'needs_reschedule':
      return 'The clinic cancelled this session. Pick a new time.'
    case 'requested':
      return 'Waiting for the clinic to confirm your time.'
    default:
      return clinicOf(a.branchId).arrive.split('.')[0] + '.'
  }
}

export type Priority = {
  key: string
  kicker: string
  right: string
  line: string
  cta: { label: string; href: string; external?: boolean }
  /** The offer is declined; anything else is only hidden on this device. */
  dismiss: { label: string; offerId?: string }
}

/**
 * The one card that most needs the patient, in order: an earlier time offered from a waitlist, a
 * payment due, a request awaiting the clinic, a visit within two days, joining a waitlist to go
 * sooner, or (with nothing booked) a doctor open soon. Dismissed keys are skipped.
 */
export function priority(account: Account, dismissed: ReadonlySet<string>): Priority | null {
  const s = db()
  const cards: Priority[] = []
  const upcoming = upcomingVisits(account)
  const next = upcoming.at(0)

  const offer = Object.values(s.offers).find((o) => o.status === 'active' && o.expiresAt > nowMs() && s.waitlist[o.waitlistId].accountId === account.id)
  if (offer) {
    const se = sessionFor(offer.sessionId)
    const left = Math.max(0, Math.floor((offer.expiresAt - nowMs()) / 1000))
    const terms = payTerms(se.branchId, se.doctorId, se, offer.time)
    cards.push({
      key: `offer-${offer.id}`,
      kicker: 'Earlier slot offered',
      right: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`,
      line: `${s.doctors[se.doctorId].name} · ${fmtDay(se.date).toLowerCase()} ${offer.time ?? se.start} — sooner than yours.${terms ? ` Pay ${terms.text} after taking it.` : ''}`,
      cta: { label: 'Take it', href: routes.appointments({ offer: offer.id }) },
      dismiss: { label: 'Keep mine', offerId: offer.id },
    })
  }
  const offered = upcoming.find((a) => a.status === 'offered' && a.offer)
  if (offered?.offer) {
    const left = Math.max(0, Math.floor((offered.offer.expiresAt - nowMs()) / 60000))
    cards.push({
      key: `request-offer-${offered.id}`,
      kicker: 'Clinic offered a time',
      right: `${Math.floor(left / 60)}h ${String(left % 60).padStart(2, '0')}m left`,
      line: `${s.doctors[offered.doctorId].name} · ${fmtDay(offered.date).toLowerCase()} ${offered.offer.time} — for your request.`,
      cta: { label: 'Take it', href: routes.appointments({ appt: offered.id }) },
      dismiss: { label: 'Not now' },
    })
  }
  const due = upcoming.find((a) => a.status === 'pending_payment')
  if (due && due.pay?.method === 'transfer') {
    const ms = Math.max(0, (due.pay.dueAt ?? 0) - nowMs())
    cards.push({
      key: `pay-${due.id}`,
      kicker: 'Payment due',
      right: `${Math.floor(ms / 3600000)}h ${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}m left`,
      line: `Upload your transfer receipt to keep ${fmtDay(due.date).toLowerCase()}${due.time ? ` ${due.time}` : ''} with ${s.doctors[due.doctorId].name}.`,
      cta: { label: 'Upload receipt', href: routes.appointments({ pay: due.id }) },
      dismiss: { label: 'Not now' },
    })
  }
  const request = upcoming.find((a) => a.status === 'requested')
  if (request) {
    const se = sessionFor(request.sessionId)
    cards.push({
      key: `request-${request.id}`,
      kicker: 'Request pending',
      right: fmtDay(request.date),
      line: `${clinicOf(request.branchId).name} will text you a confirmed time for your ${se.start}–${se.end} request with ${s.doctors[request.doctorId].name}.`,
      cta: { label: 'View request', href: routes.appointments({ appt: request.id }) },
      dismiss: { label: 'Not now' },
    })
  }
  if (next && daysUntil(next.date) <= 2) {
    cards.push({
      key: `soon-${next.id}`,
      kicker: relativeDay(next.date),
      right: next.time ?? '',
      line: `${clinicOf(next.branchId).arrive.split('.')[0]}. ${s.branches[next.branchId].name.split(' — ')[0]}.`,
      cta: { label: 'Directions', href: directionsHref(next.branchId), external: true },
      dismiss: { label: 'Not now' },
    })
  }
  if (next && next.status !== 'requested' && clinicOf(next.branchId).types.waitlist) {
    cards.push({
      key: `waitlist-${next.id}`,
      kicker: 'Want it sooner?',
      right: relativeDay(next.date),
      line: `Join the waitlist for ${s.doctors[next.doctorId].name} and we’ll text you if an earlier time opens.`,
      cta: { label: 'Join waitlist', href: routes.doctor(next.doctorId, { branch: next.branchId, from: 'mycare' }) },
      dismiss: { label: 'Not now' },
    })
  }
  if (!next) {
    const open = search({}).find((r) => r.next && r.doctor.kind !== 'service')
    if (open?.next) {
      cards.push({
        key: `open-${open.key}-${open.next.date}`,
        kicker: 'Open soon',
        right: fmtDay(open.next.date),
        line: `${open.doctor.name} has a time ${fmtDay(open.next.date).toLowerCase()} at ${open.next.time ?? open.next.window}.`,
        cta: { label: 'Book', href: routes.doctor(open.doctor.id, { branch: open.branch.id, date: open.next.date, from: 'mycare' }) },
        dismiss: { label: 'Not now' },
      })
    }
  }
  // an offer is never hidden: it can only be taken or declined
  return cards.find((c) => c.dismiss.offerId || !dismissed.has(c.key)) ?? null
}

const openingLabel = (n: NextOpening) => n.time ?? n.window?.split('–')[0] ?? ''

/** Doctors with a time today, then tomorrow, one row each: "Open today near you". */
export function openSoon(limit = 3) {
  const seen = new Set<string>()
  const t = today()
  const pick = (date: string) =>
    search({}).filter((r): r is SearchRow & { next: NextOpening } => !!r.next && r.next.date === date && !seen.has(r.doctor.id) && !!seen.add(r.doctor.id))
  return [...pick(t), ...pick(addDays(t, 1))].slice(0, limit).map((r) => ({
    key: r.key,
    doctor: r.doctor,
    tint: r.spec.tint,
    sub: `${r.spec.name} · ${r.clinic.name}`,
    time: `${r.next.date === t ? '' : 'Tmrw '}${openingLabel(r.next)}`,
    href: routes.doctor(r.doctor.id, { branch: r.branch.id, date: r.next.date, from: 'mycare' }),
  }))
}

/**
 * The doctors to book again: saved ones first, then those seen before, else suggestions. Each with
 * its next opening, or the waitlist when there is none.
 */
export function yourDoctors(account: Account, limit = 3) {
  const s = db()
  const rows = search({})
  const known = knownDoctors(account)
  const ids = known.ids.length ? known.ids : [...new Set(rows.map((r) => r.doctor.id))].filter((id) => s.doctors[id].kind !== 'service')
  const unique = ids.slice(0, limit)
  return {
    title: known.saved ? 'Your doctors' : known.seen ? 'Book again' : 'Suggested for you',
    doctors: unique.map((id) => {
      const d = s.doctors[id]
      const row = rows.find((r) => r.doctor.id === id && r.next) ?? rows.find((r) => r.doctor.id === id)
      const spec = s.specialties.find((x) => x.id === d.spec)
      return {
        doctor: d,
        tint: spec?.tint ?? 'blue',
        sub: [spec?.name, row?.clinic.name].filter(Boolean).join(' · '),
        slot: row?.next ? `${fmtDay(row.next.date)} ${openingLabel(row.next)}` : 'Waitlist',
        href: routes.doctor(id, { branch: row?.branch.id, date: row?.next?.date, from: 'mycare' }),
      }
    }),
  }
}

/** You, then each family member, with what they have booked next. */
export function family(account: Account) {
  const s = db()
  const upcoming = upcomingVisits(account)
  return [account.holderId, ...account.familyIds].map((id) => {
    const p = s.patients[id]
    const next = upcoming.find((a) => a.patientId === id)
    const years = age(p.dob)
    const spec = next ? s.specialties.find((x) => x.id === s.doctors[next.doctorId].spec) : undefined
    return {
      id,
      name: id === account.holderId ? 'You' : p.name.split(' ')[0],
      fullName: p.name,
      relation: id === account.holderId ? '' : `${(p.relation ?? 'family').toLowerCase()}${years != null ? `, ${years}` : ''}`,
      line: next ? `${spec?.name ?? ''} · ${fmtDay(next.date)}${next.time ? `, ${next.time}` : ''}` : 'Nothing booked',
    }
  })
}
