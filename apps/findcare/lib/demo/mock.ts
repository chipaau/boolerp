// FIXTURES — the demo's starting state, from the approved prototype: three clinics in Malé and Hulhumalé, their
// doctors and services, a fortnight of sessions with other patients' bookings, and one signed-up
// family (Aminath and her son Ayaan) with a visit in each state worth showing — today's queue, a
// payment the clinic couldn't match, a request awaiting the clinic, a waitlist offer, a session the
// clinic cancelled. Dates are relative to the day it is seeded, so it always looks current.
// Only ./store.ts may import this file (lint-enforced); screens read through @/lib/data. Delete it
// when FindCare has a backend.
import { addAppointment, addNotification, hash, sessionsBetween, slotTimes } from './records'
import { addDays, dow, nowMin, nowMs, toMin, today } from './time'
import type { DemoState, Session } from './types'

export const SEED_VERSION = 2

const OTHER_PATIENTS = [
  'Mohamed Ashraf',
  'Hawwa Shiyana',
  'Ali Nashid',
  'Fathimath Raya',
  'Ahmed Rilwan',
  'Aishath Mishal',
  'Ibrahim Nizam',
  'Mariyam Hana',
  'Hussain Zaid',
  'Khadheeja Leena',
  'Moosa Imad',
  'Aminath Sara',
  'Yoosuf Faris',
  'Shaheema Ali',
  'Abdulla Shimaz',
  'Zeenath Hussain',
]

function catalogue(t: string): Omit<DemoState, 'appointments' | 'waitlist' | 'offers' | 'notifications' | 'holds' | 'idem'> {
  return {
    version: SEED_VERSION,
    seededOn: t,
    specialties: [
      { id: 'gp', name: 'General practice', tint: 'mint', icon: 'stethoscope' },
      { id: 'ped', name: 'Pediatrics', tint: 'butter', icon: 'baby' },
      { id: 'der', name: 'Dermatology', tint: 'peach', icon: 'sparkles' },
      { id: 'ent', name: 'ENT', tint: 'sky', icon: 'ear' },
      { id: 'gyn', name: 'Gynecology', tint: 'lilac', icon: 'heart-pulse' },
      { id: 'den', name: 'Dental', tint: 'sky', icon: 'smile' },
      { id: 'phy', name: 'Physiotherapy', tint: 'mint', icon: 'activity', group: 'service' },
      { id: 'lab', name: 'Blood tests', tint: 'peach', icon: 'test-tube', group: 'service' },
      { id: 'vac', name: 'Vaccinations', tint: 'butter', icon: 'syringe', group: 'service' },
    ],
    clinics: {
      c1: {
        id: 'c1',
        name: 'Lagoon Medical Centre',
        short: 'LMC',
        types: { exact: true, queue: true, waitlist: true },
        cutoffH: 2,
        pay: { atClinic: true, transfer: { bank: 'Bank of Maldives', name: 'Lagoon Medical Centre Pvt Ltd', acc: '7730000123456' }, prepay: 'optional', windowH: 2 },
        status: 'active',
        email: 'hello@lagoonmedical.mv',
        paused: false,
        arrive: 'Arrive 10 minutes early and bring your ID card.',
        cancelPolicy: 'Free cancellation online until 2 hours before your appointment.',
      },
      c2: {
        id: 'c2',
        name: 'Coral Family Clinic',
        short: 'CFC',
        types: { exact: false, queue: true, request: true, waitlist: true },
        cutoffH: 4,
        pay: { atClinic: true, transfer: null, prepay: 'none', windowH: 0 },
        status: 'active',
        email: 'care@coralfamily.mv',
        paused: false,
        arrive: 'Check in at the front desk when you arrive. Numbers are called in order.',
        cancelPolicy: 'Cancel online until 4 hours before your session starts.',
      },
      c3: {
        id: 'c3',
        name: 'Harbour Health',
        short: 'HH',
        types: { exact: true, queue: true, waitlist: true },
        cutoffH: 12,
        pay: { atClinic: false, transfer: { bank: 'Bank of Maldives', name: 'Harbour Health Pvt Ltd', acc: '7730000987654' }, prepay: 'required', deposit: 200, windowH: 2 },
        status: 'active',
        email: 'desk@harbourhealth.mv',
        paused: false,
        arrive: 'Arrive 15 minutes early for registration.',
        cancelPolicy: 'Changes online until 12 hours before. After that, please call the clinic.',
      },
    },
    branches: {
      b1: {
        id: 'b1',
        clinicId: 'c1',
        name: 'Malé — Majeedhee Magu',
        city: 'Malé',
        address: 'H. Seaview, Majeedhee Magu, Malé 20026',
        phone: '+960 330 1122',
        hours: 'Sun–Thu 08:00–21:00 · Sat 16:00–21:00 · Fri closed',
        lat: 4.1745,
        lng: 73.5105,
      },
      b2: {
        id: 'b2',
        clinicId: 'c1',
        name: 'Hulhumalé — Nirolhu Magu',
        city: 'Hulhumalé',
        address: 'Lot 10231, Nirolhu Magu, Hulhumalé 23000',
        phone: '+960 335 4455',
        hours: 'Sun–Thu 16:00–22:00 · Sat 16:00–21:00',
        lat: 4.2135,
        lng: 73.5418,
      },
      b3: {
        id: 'b3',
        clinicId: 'c2',
        name: 'Hulhumalé Phase 2',
        city: 'Hulhumalé',
        address: 'Lot 20450, Dhoshimeyna Goalhi, Hulhumalé 23000',
        phone: '+960 336 7788',
        hours: 'Sat–Thu 09:00–20:00 · Fri closed',
        lat: 4.2446,
        lng: 73.5452,
      },
      b4: {
        id: 'b4',
        clinicId: 'c3',
        name: 'Malé — Boduthakurufaanu Magu',
        city: 'Malé',
        address: 'M. Blue Reef, Boduthakurufaanu Magu, Malé 20094',
        phone: '+960 332 9090',
        hours: 'Sun–Thu 09:00–18:00',
        lat: 4.1779,
        lng: 73.5122,
      },
    },
    doctors: {
      d1: {
        id: 'd1',
        name: 'Dr. Aishath Nazeera',
        spec: 'gp',
        initials: 'AN',
        quals: ['MBBS, IGMC Shimla', 'Diploma in Family Medicine'],
        langs: 'Dhivehi, English',
        ageMin: null,
        ageMax: null,
        years: 14,
        about: 'Family doctor for adults and children. Check-ups, fevers, chronic conditions and referrals.',
        fees: { b1: 350, b3: 300 },
      },
      d2: {
        id: 'd2',
        name: 'Dr. Ibrahim Shareef',
        spec: 'ped',
        initials: 'IS',
        quals: ['MBBS', 'MD Pediatrics, AIIMS'],
        langs: 'Dhivehi, English',
        ageMin: 0,
        ageMax: 16,
        years: 11,
        about: 'Child health from newborn to 16 — growth checks, vaccinations advice, coughs, allergies and asthma.',
        fees: { b1: 450 },
      },
      d3: {
        id: 'd3',
        name: 'Dr. Mariyam Shifza',
        spec: 'der',
        initials: 'MS',
        quals: ['MBBS', 'MD Dermatology, Colombo'],
        langs: 'Dhivehi, English, Sinhala',
        ageMin: 12,
        ageMax: null,
        years: 9,
        about: 'Skin, hair and nail conditions — acne, eczema, pigmentation and mole checks.',
        fees: { b4: 600 },
      },
      d4: {
        id: 'd4',
        name: 'Dr. Hassan Rasheed',
        spec: 'ent',
        initials: 'HR',
        quals: ['MBBS', 'MS Otorhinolaryngology'],
        langs: 'Dhivehi, English, Hindi',
        ageMin: null,
        ageMax: null,
        years: 16,
        about: 'Ear, nose and throat — sinus problems, hearing loss, tonsils and snoring.',
        fees: { b2: 500 },
      },
      d5: {
        id: 'd5',
        name: 'Dr. Fathimath Shiuna',
        spec: 'gyn',
        initials: 'FS',
        quals: ['MBBS', 'MRCOG (UK)'],
        langs: 'Dhivehi, English',
        ageMin: 14,
        ageMax: null,
        years: 12,
        about: 'Women’s health, pregnancy care, period problems and screening.',
        fees: { b3: 550 },
      },
      d6: {
        id: 'd6',
        name: 'Dr. Ahmed Zahir',
        spec: 'den',
        initials: 'AZ',
        quals: ['BDS', 'MDS Orthodontics'],
        langs: 'Dhivehi, English',
        ageMin: null,
        ageMax: null,
        years: 10,
        about: 'Dental check-ups, fillings, braces and aligners.',
        fees: { b4: 400 },
      },
      d7: {
        id: 'd7',
        name: 'Dr. Fathimath Naila',
        spec: 'gyn',
        initials: 'FN',
        quals: ['MBBS', 'MS Obstetrics & Gynaecology'],
        langs: 'Dhivehi, English',
        ageMin: 14,
        ageMax: null,
        years: 12,
        about: 'Women’s health — antenatal care, period problems, fertility advice and screening. Send a request and the clinic confirms your time.',
        fees: { b3: 550 },
      },
      sv1: {
        id: 'sv1',
        kind: 'service',
        name: 'Physiotherapy session',
        spec: 'phy',
        initials: 'PT',
        quals: ['Registered physiotherapists'],
        langs: 'Dhivehi, English',
        ageMin: 12,
        ageMax: null,
        duration: '45 min',
        provider: 'Any available physiotherapist',
        about: 'Back and neck pain, sports injuries, recovery after surgery. First visit includes an assessment and a home exercise plan. Wear loose clothing.',
        fees: { b2: 450, b3: 400 },
      },
      sv2: {
        id: 'sv2',
        kind: 'service',
        name: 'Blood test',
        spec: 'lab',
        initials: 'BT',
        quals: ['Lab technicians'],
        langs: 'Dhivehi, English',
        ageMin: null,
        ageMax: null,
        duration: '10 min',
        provider: 'Walk-in lab team',
        about: 'Routine blood work — full blood count, sugar, cholesterol, thyroid and more. Bring your doctor’s request form. Fasting tests: no food for 8–10 hours.',
        fees: { b1: 250, b4: 200 },
      },
      sv3: {
        id: 'sv3',
        kind: 'service',
        name: 'Vaccination',
        spec: 'vac',
        initials: 'VX',
        quals: ['Nursing team'],
        langs: 'Dhivehi, English',
        ageMin: null,
        ageMax: null,
        duration: '15 min',
        provider: 'Nurse-led clinic',
        about: 'Flu, travel and routine vaccines for adults and children. Bring your vaccination card if you have one.',
        fees: { b3: 150 },
      },
    },
    schedules: {
      s1: { id: 's1', doctorId: 'd1', branchId: 'b1', days: [0, 1, 2, 3, 4], start: '09:00', end: '12:00', mode: 'exact', slotMin: 20 },
      s2: { id: 's2', doctorId: 'd1', branchId: 'b3', days: [0, 2, 4, 6], start: '16:00', end: '19:00', mode: 'queue', capacity: 12 },
      s3: { id: 's3', doctorId: 'd2', branchId: 'b1', days: [0, 1, 2, 3, 4], start: '14:00', end: '17:00', mode: 'exact', slotMin: 20 },
      s4: { id: 's4', doctorId: 'd3', branchId: 'b4', days: [1, 3], start: '10:00', end: '13:00', mode: 'exact', slotMin: 30 },
      s5: { id: 's5', doctorId: 'd4', branchId: 'b2', days: [0, 1, 2, 3], start: '17:00', end: '20:00', mode: 'exact', slotMin: 15 },
      s6: { id: 's6', doctorId: 'd5', branchId: 'b3', days: [1, 3, 6], start: '09:00', end: '12:00', mode: 'queue', capacity: 10 },
      s7: { id: 's7', doctorId: 'd6', branchId: 'b4', days: [0, 2, 4], start: '15:00', end: '18:00', mode: 'queue', capacity: 8 },
      s8: { id: 's8', doctorId: 'sv1', branchId: 'b2', days: [0, 1, 2, 3, 4], start: '16:00', end: '20:30', mode: 'exact', slotMin: 45 },
      s9: { id: 's9', doctorId: 'sv1', branchId: 'b3', days: [1, 3, 6], start: '09:00', end: '12:00', mode: 'exact', slotMin: 45 },
      s10: { id: 's10', doctorId: 'sv2', branchId: 'b1', days: [0, 1, 2, 3, 4, 6], start: '07:30', end: '10:30', mode: 'exact', slotMin: 10 },
      s11: { id: 's11', doctorId: 'sv2', branchId: 'b4', days: [0, 2, 4], start: '08:00', end: '11:00', mode: 'queue', capacity: 30 },
      s12: { id: 's12', doctorId: 'sv3', branchId: 'b3', days: [0, 2, 4], start: '14:00', end: '16:00', mode: 'queue', capacity: 20 },
      s13: { id: 's13', doctorId: 'd7', branchId: 'b3', days: [0, 1, 2, 3, 4], start: '09:00', end: '13:00', mode: 'request', capacity: 6 },
    },
    sessionOverrides: {},
    accounts: {
      acc1: { id: 'acc1', providers: ['Google'], phone: '+960 7771234', holderId: 'p1', familyIds: ['p2'], notifPhone: '+960 7771234', notifSms: true, saved: ['d3', 'd1'] },
    },
    patients: {
      p1: { id: 'p1', name: 'Aminath Rasheeda', dob: '1991-04-12', phone: '+960 7771234', accountId: 'acc1', relation: 'self' },
      p2: { id: 'p2', name: 'Ayaan Ali', dob: addDays(t, -7 * 365 - 40), phone: null, accountId: 'acc1', relation: 'Son' },
    },
    auth: { accountId: null },
  }
}

/** Other patients' bookings, so the schedules are as full as a real clinic's. */
function fillSessions(s: DemoState, sessions: Session[], t: string) {
  let n = 0
  const add = (se: Session, time: string | null, queueNo: number | null, past: boolean) => {
    const i = n++
    const pid = 'gp' + i
    const name = OTHER_PATIENTS[Math.floor(hash(se.id + (time ?? queueNo ?? i) + 'n') * OTHER_PATIENTS.length)]
    const phone = '+960 7' + String(100000 + Math.floor(hash(pid) * 899999))
    s.patients[pid] = { id: pid, name, dob: null, phone, accountId: null, relation: null }
    const source = hash(pid + 's') < 0.62 ? 'online' : hash(pid + 't') < 0.6 ? 'phone' : 'walkin'
    let status: 'confirmed' | 'completed' | 'no_show' | 'cancelled' | 'checked_in' = 'confirmed'
    if (past) {
      const h = hash(pid + 'st')
      status = h < 0.08 ? 'no_show' : h < 0.14 ? 'cancelled' : 'completed'
    } else if (se.date === t && time && toMin(time) < nowMin() - 30) status = hash(pid + 'x') < 0.1 ? 'no_show' : 'completed'
    else if (se.date === t && time && toMin(time) < nowMin() + 20) status = 'checked_in'
    addAppointment(s, { sessionId: se.id, time, queueNo, patientId: pid, status, source, notif: phone, ref: `${s.clinics[s.branches[se.branchId].clinicId].short}-${1000 + i}` })
  }
  const firstD5Session = () => {
    for (let i = 0; i < 14; i++) if (s.schedules.s6.days.includes(dow(addDays(t, i)))) return addDays(t, i)
  }
  for (const se of sessions) {
    const past = se.date < t
    if (se.mode === 'exact') {
      const fill = se.date === t ? 0.55 : past ? 0.7 : se.date <= addDays(t, 3) ? 0.45 : 0.2
      for (const time of slotTimes(se)) if (hash(se.id + time) < fill) add(se, time, null, past)
    } else if (se.mode === 'request') {
      const count = Math.floor((se.capacity ?? 0) * (past ? 0.8 : se.date <= addDays(t, 2) ? 0.6 : 0.2))
      for (let q = 1; q <= count; q++) add(se, null, null, past)
    } else {
      // The dentist is always fully booked, so his waitlist has something to offer.
      const full = se.doctorId === 'd6' || (se.doctorId === 'd5' && firstD5Session() === se.date)
      const cap = se.capacity ?? 0
      const count = full ? cap : Math.floor(cap * (past ? 0.8 : se.date <= addDays(t, 2) ? 0.5 : 0.25))
      for (let q = 1; q <= count; q++) add(se, null, q, past)
    }
  }
}

export function seed(): DemoState {
  const t = today()
  const s: DemoState = { ...catalogue(t), appointments: {}, waitlist: {}, offers: {}, notifications: {}, holds: {}, idem: {} }
  const sessions = sessionsBetween(s, addDays(t, -14), addDays(t, 14))
  fillSessions(s, sessions, t)
  const find = (f: (se: Session) => boolean) => sessions.find(f)
  const me = { patientId: 'p1', accountId: 'acc1', source: 'online' as const, notif: '+960 7771234' }

  // The ENT doctor's next session after tomorrow is cancelled by the clinic; its patients must rebook.
  const cancelled = find((x) => x.schedId === 's5' && x.date >= addDays(t, 2))
  if (cancelled) {
    const at = nowMs() - 3 * 3600e3
    s.sessionOverrides[cancelled.id] = { status: 'cancelled', reason: 'Doctor unavailable (conference)', at }
    for (const a of Object.values(s.appointments)) {
      if (a.sessionId !== cancelled.id || a.status !== 'confirmed') continue
      a.status = 'needs_reschedule'
      a.history.push({ at, text: 'Session cancelled by clinic — awaiting rescheduling', by: 'Clinic' })
      addNotification(s, a.id, 'session_cancelled', a.id.charCodeAt(a.id.length - 1) % 3 === 0 ? 'failed' : 'delivered')
    }
  }

  // Aminath's dermatology visit, paid ahead by transfer.
  const derm = find((x) => x.doctorId === 'd3' && x.date >= addDays(t, 2))
  if (derm) {
    const a = addAppointment(s, { ...me, sessionId: derm.id, time: '11:30', status: 'confirmed', ref: 'HH-3108' })
    a.pay = { method: 'transfer', status: 'verified', amount: s.doctors.d3.fees.b4 }
  }

  // Ayaan's pediatrics visit; the SMS reminder failed.
  const peds = find((x) => x.doctorId === 'd2' && x.date >= addDays(t, 1))
  if (peds) {
    const a = addAppointment(s, { ...me, patientId: 'p2', sessionId: peds.id, time: '16:00', status: 'confirmed', ref: 'LMC-5530', reason: 'Recurring cough' })
    addNotification(s, a.id, 'reminder', 'failed')
  }

  // A request the clinic hasn't confirmed yet.
  const request = find((x) => x.doctorId === 'd7' && x.date >= addDays(t, 3))
  if (request) {
    const a = addAppointment(s, { ...me, sessionId: request.id, status: 'requested', ref: 'CFC-7702', reason: 'Annual check-up' })
    a.history = [{ at: nowMs() - 5 * 3600e3, text: 'Request sent online — awaiting clinic', by: 'Patient' }]
    a.preference = 'morning'
    // the demo clinic answers it shortly after the demo starts
    a.clinicRespondsAt = nowMs() + 45e3
  }

  // A past visit.
  const past = sessions.filter((x) => x.schedId === 's1' && x.date < t).at(-1)
  if (past) addAppointment(s, { ...me, sessionId: past.id, time: '10:20', status: 'completed', ref: 'LMC-2214' })

  // On the dentist's waitlist, with an earlier place offered now (and one that ran out earlier).
  s.waitlist.w1 = {
    id: 'w1',
    accountId: 'acc1',
    patientId: 'p1',
    doctorId: 'd6',
    branchId: 'b4',
    kind: 'new',
    linkedApptId: null,
    dates: { from: t, to: addDays(t, 14) },
    sessions: ['afternoon'],
    status: 'active',
    createdAt: nowMs() - 2 * 864e5,
    notif: '+960 7771234',
  }
  const dental = find((x) => x.doctorId === 'd6' && x.date >= addDays(t, 1))
  if (dental) {
    const freed = Object.values(s.appointments).find((a) => a.sessionId === dental.id && a.queueNo === dental.capacity)
    if (freed) {
      freed.status = 'cancelled'
      freed.history.push({ at: nowMs() - 600e3, text: 'Cancelled by patient', by: 'Patient' })
    }
    s.offers.o1 = {
      id: 'o1',
      waitlistId: 'w1',
      sessionId: dental.id,
      queueNo: freed?.queueNo ?? dental.capacity ?? null,
      status: 'active',
      createdAt: nowMs() - 5 * 60e3,
      expiresAt: nowMs() + 25 * 60e3,
    }
    addNotification(s, null, 'waitlist_offer', 'delivered', 'o1')
  }
  const earlierDental = find((x) => x.doctorId === 'd6' && x.date >= t)
  if (earlierDental)
    s.offers.o0 = { id: 'o0', waitlistId: 'w1', sessionId: earlierDental.id, queueNo: 4, status: 'expired', createdAt: nowMs() - 3 * 3600e3, expiresAt: nowMs() - 2.5 * 3600e3 }

  // Today's queue visit, for the live queue and checking in.
  const queue = find((x) => x.date === t && x.mode === 'queue' && x.doctorId !== 'd6' && toMin(x.end) - 20 > nowMin())
  if (queue) {
    const ahead = Object.values(s.appointments).filter((a) => a.sessionId === queue.id && a.status !== 'cancelled' && a.status !== 'rescheduled').length
    const a = addAppointment(s, { ...me, sessionId: queue.id, queueNo: ahead + 1, status: 'confirmed' })
    a.pay = { method: 'clinic', status: 'at_clinic', amount: s.doctors[queue.doctorId].fees[queue.branchId] ?? 0 }
  }

  // A transfer receipt the clinic couldn't match: upload again within the window.
  const lab = find((x) => x.doctorId === 'sv2' && x.branchId === 'b4' && x.date >= addDays(t, 1))
  if (lab) {
    const a = addAppointment(s, { ...me, sessionId: lab.id, queueNo: 3, status: 'pending_payment', reason: 'Fasting blood sugar' })
    a.pay = {
      method: 'transfer',
      status: 'rejected',
      amount: 200,
      fee: 200,
      deposit: false,
      dueAt: nowMs() + 70 * 60e3,
      receipt: null,
      rejectReason: 'The amount on the receipt (MVR 150) doesn’t match the fee (MVR 200).',
    }
    a.history.push({ at: nowMs() - 20 * 60e3, text: 'Receipt could not be matched — please upload again', by: 'Clinic' })
  }
  return s
}
