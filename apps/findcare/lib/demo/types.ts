// The demo's data model: the patient side of clinic booking, as the approved prototype runs it
// (.design/Clinic booking design system/ui_kits/patient-app/app/store.js). There is no backend yet,
// so this is the shape the UI is built against, not an API contract.

/** Each specialty has one tint, used for its avatars and dots everywhere. */
export type Tint = 'mint' | 'peach' | 'lilac' | 'butter' | 'sky' | 'blue'

/** How a clinic session is booked: a time slot, a numbered walk-in queue, or a request the clinic confirms. */
export type BookingMode = 'exact' | 'queue' | 'request'

export type DayPeriod = 'morning' | 'afternoon' | 'evening'

export type Specialty = {
  id: string
  name: string
  tint: Tint
  icon: string
  group?: 'service'
}

export type BankDetails = { bank: string; name: string; acc: string }

export type PaySettings = {
  atClinic: boolean
  transfer: BankDetails | null
  /** none: pay at the clinic; optional: transfer ahead if you like; required: transfer (or a deposit) to keep the time. */
  prepay: 'none' | 'optional' | 'required'
  /** Hours the patient has to transfer, capped at one hour before the visit. */
  windowH: number
  deposit?: number
}

export type Clinic = {
  id: string
  name: string
  short: string
  types: { exact?: boolean; queue?: boolean; request?: boolean; waitlist?: boolean }
  /** Online changes close this many hours before the visit. */
  cutoffH: number
  pay: PaySettings
  status: 'active' | 'paused'
  email: string
  arrive: string
  cancelPolicy: string
  paused: boolean
}

export type Branch = {
  id: string
  clinicId: string
  name: string
  city: string
  address: string
  phone: string
  hours: string
  lat: number
  lng: number
}

/** A doctor, or a service (kind "service") booked the same way. Fees are per branch. */
export type Doctor = {
  id: string
  kind?: 'service'
  name: string
  spec: string
  initials: string
  quals: string[]
  langs: string
  ageMin: number | null
  ageMax: number | null
  years?: number
  duration?: string
  provider?: string
  about: string
  fees: Record<string, number>
}

export type Schedule = {
  id: string
  doctorId: string
  branchId: string
  /** Days of the week, 0 = Sunday. */
  days: number[]
  start: string
  end: string
  mode: BookingMode
  slotMin?: number
  capacity?: number
}

/** One occurrence of a schedule on a date: id is `<scheduleId>_<YYYY-MM-DD>`. */
export type Session = {
  id: string
  schedId: string
  doctorId: string
  branchId: string
  date: string
  start: string
  end: string
  mode: BookingMode
  slotMin?: number
  capacity?: number
  status: 'active' | 'cancelled'
  reason: string
}

export type SessionOverride = { status?: 'cancelled'; reason?: string; at?: number; start?: string; end?: string; capacity?: number }

export type Patient = {
  id: string
  name: string
  dob: string | null
  phone: string | null
  accountId: string | null
  relation: string | null
}

export type Account = {
  id: string
  providers: string[]
  via?: string
  phone: string
  holderId: string
  familyIds: string[]
  notifPhone: string
  notifSms: boolean
  saved: string[]
  isNew?: boolean
}

/**
 * Where a visit is. Booking a slot: confirmed, or pending_payment → payment_review → confirmed when
 * the clinic wants payment first. A request: requested → offered (the clinic proposes an exact time)
 * → confirmed or pending_payment once the patient accepts. On the day: checked_in → in_progress →
 * completed. A waitlist place, once offered and taken, becomes a booking like any other.
 */
export type AppointmentStatus =
  | 'confirmed'
  | 'requested'
  | 'offered'
  | 'in_progress'
  | 'pending_payment'
  | 'payment_review'
  | 'checked_in'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'rescheduled'
  | 'needs_reschedule'
  | 'waitlisted'

export type Receipt = { name: string; data: string; isImg: boolean; at: number }

export type Payment =
  | { method: 'clinic'; status: 'at_clinic'; amount: number }
  | {
      method: 'transfer'
      status: 'due' | 'review' | 'verified' | 'rejected'
      amount: number
      fee?: number
      deposit?: boolean
      dueAt?: number | null
      receipt?: Receipt | null
      rejectReason?: string | null
      autoVerifyAt?: number | null
      refund?: { status: 'processing'; amount: number; at: number }
    }

export type HistoryEntry = { at: number; text: string; by: string }

export type Appointment = {
  id: string
  ref: string
  sessionId: string
  doctorId: string
  branchId: string
  date: string
  kind: BookingMode
  time: string | null
  queueNo: number | null
  patientId: string
  accountId: string | null
  status: AppointmentStatus
  source: 'online' | 'phone' | 'walkin'
  notif: string | null
  reason: string
  createdAt: number
  history: HistoryEntry[]
  pay?: Payment
  replacedBy?: string
  waitlistId?: string
  checkedInAt?: number
  /** A request's preferred part of the day. */
  preference?: DayPeriod | 'any'
  /** When the clinic answers a request (the demo has no clinic, so it answers on its own). */
  clinicRespondsAt?: number
  /** The exact time the clinic offered for a request, until the patient accepts or it lapses. */
  offer?: { time: string; expiresAt: number }
}

export type WaitlistEntry = {
  id: string
  accountId: string
  patientId: string
  doctorId: string
  branchId: string
  /** new: any opening; earlier: an earlier time than an appointment already booked. */
  kind: 'new' | 'earlier'
  linkedApptId: string | null
  dates: { from: string; to: string } | null
  sessions: DayPeriod[]
  status: 'active' | 'left' | 'fulfilled'
  createdAt: number
  notif: string
  fulfilledAt?: number
}

/** An opening offered to the first matching waitlist entry, held for 30 minutes. */
export type Offer = {
  id: string
  waitlistId: string
  sessionId: string
  time?: string | null
  queueNo: number | null
  status: 'active' | 'accepting' | 'accepted' | 'declined' | 'expired' | 'withdrawn'
  createdAt: number
  expiresAt: number
  apptId?: string
  seen?: boolean
}

export type NotificationType =
  'confirmation' | 'request_received' | 'request_offered' | 'reminder' | 'cancellation' | 'reschedule' | 'session_cancelled' | 'waitlist_offer' | 'waitlist_accepted' | 'waitlisted'

export type Notification = {
  id: string
  apptId: string | null
  offerId: string | null
  type: NotificationType
  channel: 'SMS'
  status: 'delivered' | 'failed'
  at: number
  attempts: number
}

/** A slot or queue place held for five minutes while the patient finishes booking. */
export type Hold = { id: string; sessionId: string; time: string | null; expiresAt: number }

export type DemoState = {
  version: number
  seededOn: string
  specialties: Specialty[]
  clinics: Record<string, Clinic>
  branches: Record<string, Branch>
  doctors: Record<string, Doctor>
  schedules: Record<string, Schedule>
  sessionOverrides: Record<string, SessionOverride>
  accounts: Record<string, Account>
  patients: Record<string, Patient>
  appointments: Record<string, Appointment>
  waitlist: Record<string, WaitlistEntry>
  offers: Record<string, Offer>
  notifications: Record<string, Notification>
  holds: Record<string, Hold>
  idem: Record<string, string>
  auth: { accountId: string | null }
}

/** What the patient picked: a session and, for a slot, its time. */
export type SlotPick = { sessionId: string; time?: string | null }
