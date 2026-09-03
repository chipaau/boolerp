// Static mock data for the Home overview. Obviously fake; replaced by API queries when the
// inbox/calendar endpoints exist. Keep shapes close to what the API will return.
import avatar1 from '@workspace/assets/avatars/avatar-1.jpg'
import avatar2 from '@workspace/assets/avatars/avatar-2.jpg'
import avatar3 from '@workspace/assets/avatars/avatar-3.jpg'
import avatar4 from '@workspace/assets/avatars/avatar-4.webp'

export type Stat = { value: number; label: string }
export const STATS: Stat[] = [
  { value: 6, label: 'due today' },
  { value: 12, label: 'low stock' },
  { value: 4, label: 'meetings' },
]

export type Person = { name: string; photo?: string }

/** `people` are shown as avatars; `others` are the rest, listed on the "+n" count. */
export type ScheduleItem = { id: string; start: string; end: string; people: Person[]; others?: string[] }
export const SCHEDULE: ScheduleItem[] = [
  {
    id: 's1',
    start: '9:30 AM',
    end: '10:30 AM',
    people: [
      { name: 'Aishath Nasheed', photo: avatar1 },
      { name: 'Mohamed Waheed', photo: avatar2 },
    ],
    others: ['Mariyam Shifa', 'Ahmed Zayan', 'Hawwa Leena'],
  },
  {
    id: 's2',
    start: '12:00 PM',
    end: '14:00 PM',
    people: [
      { name: 'Fathimath Ali', photo: avatar3 },
      { name: 'Ibrahim Rasheed', photo: avatar4 },
    ],
  },
]

export type InboxTone = 'success' | 'slate' | 'plum' | 'rose' | 'danger' | 'warning'
export type InboxItem = {
  id: string
  /** App the item belongs to (drives the icon). */
  app: string
  title: string
  tag: { label: string; tone: InboxTone }
  meta: { label: string; overdue?: boolean }[]
  action: 'Review' | 'Approve'
}
export const INBOX: InboxItem[] = [
  {
    id: 'i1',
    app: 'inventory',
    title: 'Printer toner is below reorder level',
    tag: { label: 'Stock Alert', tone: 'success' },
    meta: [{ label: 'Dept: Finance' }, { label: 'Today, 02:37 PM' }],
    action: 'Review',
  },
  {
    id: 'i2',
    app: 'control-centre',
    title: 'Goods request awaiting approval',
    tag: { label: 'Goods Request', tone: 'slate' },
    meta: [{ label: 'Dept: Admin' }, { label: 'Today, 08:05 AM' }],
    action: 'Approve',
  },
  {
    id: 'i3',
    app: 'asset',
    title: 'Asset verification assigned to you',
    tag: { label: 'Quarterly asset check', tone: 'plum' },
    meta: [{ label: 'Due: 08th June 26, 12:00 PM' }],
    action: 'Approve',
  },
  {
    id: 'i4',
    app: 'procurement',
    title: 'Purchase order not received',
    tag: { label: 'Supplier follow-up', tone: 'rose' },
    meta: [{ label: 'Dept: HR' }, { label: '1 Day Overdue', overdue: true }],
    action: 'Review',
  },
]

/** What a day on the heat map holds. Level 0..2 = light / healthy / at-or-above target. */
export type DayActivity = { meetings: number; tasks: number; approvals: number }

/** Deterministic mock so the heat map is stable between renders. */
export function activityFor(year: number, month: number, day: number): DayActivity {
  const seed = (year * 12 + month) * 31 + day
  const r = (n: number) => (seed * n + 7) % 5 // 0..4
  return { meetings: r(3) % 3, tasks: r(5) % 4, approvals: r(7) % 2 }
}

export function activityLevel(a: DayActivity): 0 | 1 | 2 {
  const total = a.meetings + a.tasks + a.approvals
  if (total === 0) return 0
  return total >= 4 ? 2 : 1
}
