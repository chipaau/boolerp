// FIXTURES — static sample data for the Home overview (the schedule and meeting counts come from
// the Calendar feature's data instead). Only ./queries.ts may import this file
// (lint-enforced). Delete it when the inbox / calendar / activity endpoints exist.
import type { DayActivity, InboxItem, MonthActivity, Stat } from './types'

export const STATS: Stat[] = [
  { value: 6, label: 'due today' },
  { value: 12, label: 'low stock' },
]


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

/** Deterministic so the heat map is stable between renders; meetings are filled in from the calendar. */
function activityFor(year: number, month: number, day: number): DayActivity {
  const seed = (year * 12 + month) * 31 + day
  const r = (n: number) => (seed * n + 7) % 5 // 0..4
  return { meetings: 0, tasks: r(5) % 4, approvals: r(7) % 2 }
}

/** `month` is 0-based, as in `Date`. */
export function monthActivity(year: number, month: number): MonthActivity {
  const days = new Date(year, month + 1, 0).getDate()
  const out: MonthActivity = {}
  for (let d = 1; d <= days; d++) out[d] = activityFor(year, month, d)
  return out
}
