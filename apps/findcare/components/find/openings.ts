// What listings show about openings: a row's first bookable times on its next open day, and a
// clinic's summary. Shared by Find care and the clinic page; reads only through @/lib/data.
import { addDays, clinicOf, db, doctorSessions, fmtDay, queueState, search, slotState, slotTimes, today } from '@/lib/data'
import type { SearchRow } from '@/lib/data'
import { routes } from '@/lib/routes'

/** Up to n bookable times on a date; a queue or request session reads "Queue 08:00" / "Request 08:00". */
export function openingTimes(doctorId: string, branchId: string, date: string | undefined, n: number) {
  const out: string[] = []
  if (!date || clinicOf(branchId).paused) return out
  for (const se of doctorSessions(doctorId, branchId, date, date)) {
    if (se.status !== 'active') continue
    if (se.mode === 'exact') {
      for (const t of slotTimes(se)) {
        if (slotState(se, t).available) out.push(t)
        if (out.length >= n) return out
      }
    } else if (queueState(se).available) {
      out.push(`${se.mode === 'request' ? 'Request' : 'Queue'} ${se.start}`)
      if (out.length >= n) return out
    }
  }
  return out
}

/** The booking page for a row, opened on its next open day. */
export type RowFrom = NonNullable<Parameters<typeof routes.doctor>[1]>['from']

/** A row's doctor page on its next open day; `from` sets that page's back link. */
export const rowHref = (r: SearchRow, from?: RowFrom) => routes.doctor(r.doctor.id, { branch: r.branch.id, date: r.next?.date, from })

export const isService = (r: SearchRow) => r.doctor.kind === 'service'

/** Rows with an opening first, soonest first; the rest keep their order. */
export const bySoonest = (a: SearchRow, b: SearchRow) => Number(!!b.next) - Number(!!a.next) || (a.next?.date ?? '').localeCompare(b.next?.date ?? '')

/** Whether a row's next opening falls inside an "Available" filter. */
export function availableIn(r: SearchRow, when: string) {
  if (when === 'any') return true
  if (!r.next) return false
  return when === 'today' ? r.next.date === today() : r.next.date <= addDays(today(), 6)
}

export type ClinicSummary = { id: string; name: string; places: string; doctors: number; next: string }

/** Every clinic with its places, how many doctors and services book there, and its soonest opening. */
export function clinicSummaries(rows = search({})): ClinicSummary[] {
  const s = db()
  return Object.values(s.clinics).map((c) => {
    const branches = Object.values(s.branches).filter((b) => b.clinicId === c.id)
    const mine = rows.filter((r) => r.clinic.id === c.id)
    const next = mine.flatMap((r) => (r.next ? [r.next.date] : [])).sort()[0]
    return {
      id: c.id,
      name: c.name,
      places: [...new Set(branches.map((b) => b.city).filter(Boolean))].join(' & '),
      doctors: new Set(mine.map((r) => r.doctor.id)).size,
      next: next ? fmtDay(next) : '—',
    }
  })
}

/** The cities with a branch, for area filters. */
export const cities = () => [
  ...new Set(
    Object.values(db().branches)
      .map((b) => b.city)
      .filter(Boolean),
  ),
]
