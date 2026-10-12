// Files a visit hands the patient: a calendar entry, a receipt after the visit, and a map search.
// Built in the browser as data URLs, since the demo has no server to serve them.
import type { Appointment } from '@/lib/data'
import { clinicOf, db, fmtDate, sessionFor, startMs } from '@/lib/data'

/** An .ics event for the visit, 30 minutes from its time (or its session's start). */
export function calendarHref(a: Appointment) {
  const s = db()
  const doctor = s.doctors[a.doctorId].name
  const clinic = clinicOf(a.branchId).name
  const branch = s.branches[a.branchId]
  // clinic times are Maldives time; startMs makes them an instant, and the event is written in UTC
  const start = new Date(startMs(a.date, a.time ?? sessionFor(a.sessionId).start))
  const end = new Date(start.getTime() + 30 * 60e3)
  const f = (dt: Date) =>
    dt
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FindCare//EN',
    'BEGIN:VEVENT',
    `UID:${a.id}@findcare`,
    `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(start)}`,
    `DTEND:${f(end)}`,
    `SUMMARY:${doctor} · ${clinic}`,
    `LOCATION:${branch.address || clinic}`,
    `DESCRIPTION:Ref ${a.ref}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`
}

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

/** A printable receipt for a completed visit, as an HTML file. */
export function visitReceiptHref(a: Appointment) {
  const s = db()
  const doctor = s.doctors[a.doctorId]
  const clinic = clinicOf(a.branchId)
  const branch = s.branches[a.branchId]
  const patient = s.patients[a.patientId] as (typeof s.patients)[string] | undefined
  const amount = a.pay?.amount ?? doctor.fees[a.branchId]
  const rows: [string, string][] = [
    ['Reference', a.ref],
    ['Patient', patient?.name ?? ''],
    ['Seen by', doctor.name],
    ['Date', fmtDate(a.date) + (a.time ? ` ${a.time}` : '')],
    ['Payment', a.pay?.method === 'transfer' ? 'Bank transfer' : 'Paid at clinic'],
    ['Amount', `MVR ${amount}`],
  ]
  const html = `<!doctype html><meta charset="utf-8"><title>Receipt ${esc(a.ref)}</title><body style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;color:#1E0A18"><div style="letter-spacing:.4em;font-size:12px;font-weight:600">FINDCARE</div><h1 style="font-size:22px;margin:24px 0 4px">Visit receipt</h1><div style="color:#6E6470">${esc(clinic.name)} · ${esc(branch.name)}</div><table style="width:100%;margin-top:24px;border-collapse:collapse;font-size:14px">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#6E6470;border-bottom:1px solid #eee">${esc(k)}</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #eee">${esc(v)}</td></tr>`,
    )
    .join('')}</table><p style="margin-top:24px;font-size:12px;color:#8B8089">${esc(branch.address)} · ${esc(branch.phone)}</p></body>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

/** A map search for the branch. The address already names its island and city, so no country is assumed. */
export function directionsHref(branchId: string) {
  const b = db().branches[branchId]
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.address || clinicOf(branchId).name, b.city].filter(Boolean).join(', '))}`
}
