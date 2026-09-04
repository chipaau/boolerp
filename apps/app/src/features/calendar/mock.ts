// FIXTURES — the Calendar design's sample workspace (Acme). Only ./queries.ts may import this file
// (lint-enforced). Meetings are anchored to the real "today" so the board always has today's
// meetings where the design put them (day 3 of the sample month = today).
import avatar1 from '@workspace/assets/avatars/avatar-1.jpg'
import avatar2 from '@workspace/assets/avatars/avatar-2.jpg'
import avatar3 from '@workspace/assets/avatars/avatar-3.jpg'
import avatar4 from '@workspace/assets/avatars/avatar-4.webp'
import avatar5 from '@workspace/assets/avatars/avatar-5.jpg'
import { addDays, toIso } from './logic'
import type { Attendee, CalendarDef, Meeting, Person, Room, Rsvp, Swatch } from './types'

/** The signed-in person's key in this workspace. */
export const ME = 'MA'

/** Minutes since midnight for the "now" line (2:05 pm), so the sample day reads like the design. */
export const NOW_MINUTES = 14 * 60 + 5

export const CALENDARS: CalendarDef[] = [
  { key: 'team', label: 'Team', tone: 'success', visibility: 'Everyone in the workspace' },
  { key: 'client', label: 'Client', tone: 'plum', visibility: 'Everyone in the workspace' },
  { key: 'one', label: '1:1', tone: 'slate', visibility: 'Only you and the other person' },
  { key: 'hiring', label: 'Recruiting', tone: 'tan', visibility: 'Admins and Managers only' },
]

export const SWATCHES: Swatch[] = [
  { name: 'Sage', tone: 'success' },
  { name: 'Plum', tone: 'plum' },
  { name: 'Slate', tone: 'slate' },
  { name: 'Tan', tone: 'tan' },
  { name: 'Amber', tone: 'warning' },
  { name: 'Clay', tone: 'risk' },
]

export const ROOMS: Room[] = [
  { name: 'Hive 1', capacity: 8, kit: 'Screen · camera' },
  { name: 'Hive 2', capacity: 6, kit: 'Screen' },
  { name: 'Atrium', capacity: 20, kit: 'Projector · mics' },
  { name: 'Nook', capacity: 3, kit: 'No AV' },
]

export const PEOPLE: Person[] = [
  { key: 'MA', name: 'Mariyam Ahmed', role: 'Design lead', photo: avatar5 },
  { key: 'JL', name: 'Jonas Lindqvist', role: 'Product manager', photo: avatar2 },
  { key: 'PR', name: 'Priya Raman', role: 'Engineering', photo: avatar1 },
  { key: 'TK', name: 'Tom Kean', role: 'Operations' },
  { key: 'SD', name: 'Sofia Duarte', role: 'Client — Acme', photo: avatar3 },
  { key: 'AB', name: 'Adam Boyle', role: 'Engineering' },
  { key: 'HY', name: 'Hana Yusuf', role: 'Design', photo: avatar4 },
  { key: 'RC', name: 'Ruben Cole', role: 'Finance' },
  { key: 'EM', name: 'Elena Marsh', role: 'Recruiting' },
]

const today = toIso(new Date())
/** Day `d` of the design's sample month lands on today + (d − 3). */
const day = (d: number) => addDays(today, d - 3)
const at = (list: [string, Rsvp][]): Attendee[] => list.map(([person, rsvp]) => ({ person, rsvp }))
const ag = (list: [string, string][]) => list.map(([text, minutes]) => ({ text, minutes }))

export const MEETINGS: Meeting[] = [
  { id: 'm01', date: day(1), start: '09:30', end: '10:00', title: 'Design standup', calendar: 'team', room: 'Hive 2', organiser: 'MA', repeats: 'Weekdays', attendees: at([['MA', 'yes'], ['HY', 'yes'], ['PR', 'yes'], ['AB', 'maybe']]), agenda: ag([['Yesterday in one line', '5 min'], ['Blockers worth a room', '10 min'], ['What ships today', '5 min']]), notes: 'Standing 30 minutes. If a topic needs more than two replies, it leaves the standup and becomes its own meeting.' },
  { id: 'm02', date: day(1), start: '11:00', end: '12:00', title: 'Acme onboarding kickoff', calendar: 'client', room: 'Atrium', organiser: 'JL', repeats: '', attendees: at([['MA', 'yes'], ['JL', 'yes'], ['SD', 'yes'], ['TK', 'pending']]), agenda: ag([['Introductions and success criteria', '10 min'], ['Data migration plan for 4,200 SKUs', '25 min'], ['Pilot locations and timeline', '15 min'], ['Open questions', '10 min']]), notes: 'Sofia has asked for the migration plan in writing beforehand. Send the one-pager Monday so the hour goes to decisions, not catch-up.' },
  { id: 'm03', date: day(1), start: '15:00', end: '15:30', title: '1:1 Jonas', calendar: 'one', room: 'Nook', organiser: 'MA', repeats: 'Fortnightly', attendees: at([['MA', 'yes'], ['JL', 'yes']]), agenda: [], notes: 'Jonas keeps the running doc. Career items first, delivery second.' },
  { id: 'm04', date: day(2), start: '09:30', end: '10:00', title: 'Design standup', calendar: 'team', room: 'Hive 2', organiser: 'MA', repeats: 'Weekdays', attendees: at([['MA', 'yes'], ['HY', 'yes'], ['PR', 'yes']]), agenda: [], notes: '' },
  { id: 'm05', date: day(2), start: '13:00', end: '14:00', title: 'Q4 roadmap review', calendar: 'team', room: 'Hive 1', organiser: 'JL', repeats: '', attendees: at([['MA', 'yes'], ['JL', 'yes'], ['PR', 'yes'], ['TK', 'yes'], ['RC', 'maybe']]), agenda: ag([['Where Q3 landed', '10 min'], ['Three candidate bets for Q4', '30 min'], ['Headcount and cost envelope', '15 min']]), notes: 'Decision meeting, not a status update. Come with a preference and a reason.' },
  { id: 'm06', date: day(2), start: '16:00', end: '16:45', title: 'Portfolio review — S. Okafor', calendar: 'hiring', room: 'Nook', organiser: 'EM', repeats: '', attendees: at([['MA', 'yes'], ['HY', 'yes'], ['EM', 'yes']]), agenda: [], notes: 'Product design, mid-level. Focus the questions on how she handles ambiguity.' },
  { id: 'm07', date: day(3), start: '09:30', end: '10:00', title: 'Design standup', calendar: 'team', room: 'Hive 2', organiser: 'MA', repeats: 'Weekdays', attendees: at([['MA', 'yes'], ['HY', 'yes'], ['PR', 'yes']]), agenda: [], notes: '' },
  { id: 'm08', date: day(3), start: '11:30', end: '12:30', title: 'Northwind quarterly', calendar: 'client', room: 'Atrium', organiser: 'TK', repeats: 'Quarterly', attendees: at([['MA', 'pending'], ['TK', 'yes'], ['RC', 'yes'], ['SD', 'no']]), agenda: ag([['Usage and adoption since June', '15 min'], ['Two escalations still open', '20 min'], ['Renewal shape', '20 min']]), notes: 'They will ask about the scanning roadmap. Bring the mobile flow, not the slide.' },
  { id: 'm09', date: day(3), start: '14:30', end: '15:15', title: 'Inventory app handoff', calendar: 'team', room: 'Hive 2', organiser: 'MA', repeats: '', attendees: at([['MA', 'yes'], ['PR', 'yes'], ['AB', 'yes'], ['HY', 'maybe']]), agenda: ag([['Walk the built screens', '20 min'], ['Edge cases engineering flagged', '15 min'], ['Who owns what after today', '10 min']]), notes: 'Last design-side meeting before build. Anything not raised here becomes a ticket.' },
  { id: 'm10', date: day(3), start: '17:00', end: '17:30', title: '1:1 Priya', calendar: 'one', room: 'Nook', organiser: 'MA', repeats: 'Weekly', attendees: at([['MA', 'yes'], ['PR', 'yes']]), agenda: [], notes: '' },
  { id: 'm11', date: day(4), start: '09:30', end: '10:00', title: 'Design standup', calendar: 'team', room: 'Hive 2', organiser: 'MA', repeats: 'Weekdays', attendees: at([['MA', 'yes'], ['HY', 'yes'], ['PR', 'yes']]), agenda: [], notes: '' },
  { id: 'm12', date: day(4), start: '10:30', end: '11:30', title: 'Hiring panel debrief', calendar: 'hiring', room: 'Hive 1', organiser: 'EM', repeats: '', attendees: at([['MA', 'yes'], ['HY', 'yes'], ['EM', 'yes'], ['JL', 'yes']]), agenda: ag([['Independent scores, no discussion', '15 min'], ['Where we disagree', '30 min'], ['Decision', '15 min']]), notes: 'Scores go in the sheet before the meeting starts. Nobody speaks first who has already read the others.' },
  { id: 'm13', date: day(4), start: '15:00', end: '16:00', title: 'Client demo — Belltower', calendar: 'client', room: 'Atrium', organiser: 'MA', repeats: '', attendees: at([['MA', 'yes'], ['JL', 'yes'], ['SD', 'maybe'], ['TK', 'yes']]), agenda: ag([['Live walkthrough of scan-to-stock', '25 min'], ['Their questions', '25 min']]), notes: 'Demo on real data. Belltower has one warehouse and cares mostly about counting speed.' },
  { id: 'm14', date: day(7), start: '10:00', end: '11:00', title: 'Sprint planning', calendar: 'team', room: 'Hive 1', organiser: 'PR', repeats: 'Fortnightly', attendees: at([['MA', 'yes'], ['PR', 'yes'], ['AB', 'yes'], ['HY', 'yes'], ['JL', 'maybe']]), agenda: [], notes: '' },
  { id: 'm15', date: day(8), start: '09:00', end: '09:45', title: 'Interview: Senior PM', calendar: 'hiring', room: 'Nook', organiser: 'EM', repeats: '', attendees: at([['MA', 'pending'], ['EM', 'yes'], ['JL', 'yes']]), agenda: [], notes: 'Second round. Your slot covers how they work with design.' },
  { id: 'm16', date: day(8), start: '14:00', end: '15:00', title: 'Design critique', calendar: 'team', room: 'Hive 2', organiser: 'HY', repeats: 'Weekly', attendees: at([['MA', 'yes'], ['HY', 'yes'], ['AB', 'maybe']]), agenda: ag([['Calendar month view — first pass', '25 min'], ['Scan mobile empty states', '20 min']]), notes: '' },
  { id: 'm17', date: day(9), start: '11:00', end: '12:00', title: 'Acme integration review', calendar: 'client', room: 'Atrium', organiser: 'SD', repeats: '', attendees: at([['MA', 'yes'], ['SD', 'yes'], ['PR', 'yes']]), agenda: [], notes: '' },
  { id: 'm18', date: day(10), start: '13:00', end: '13:30', title: '1:1 Tom', calendar: 'one', room: 'Nook', organiser: 'MA', repeats: 'Monthly', attendees: at([['MA', 'yes'], ['TK', 'yes']]), agenda: [], notes: '' },
  { id: 'm19', date: day(11), start: '10:00', end: '11:30', title: 'Workshop: service blueprint', calendar: 'team', room: 'Atrium', organiser: 'MA', repeats: '', attendees: at([['MA', 'yes'], ['HY', 'yes'], ['TK', 'yes'], ['JL', 'yes'], ['PR', 'maybe']]), agenda: ag([['Frame the receiving journey', '20 min'], ['Map it, end to end', '45 min'], ['Pick the three worst moments', '25 min']]), notes: 'Ninety minutes with a break. Wall space booked, printed personas on the table.' },
  { id: 'm20', date: day(15), start: '14:00', end: '15:00', title: 'Board pre-read walkthrough', calendar: 'client', room: 'Hive 1', organiser: 'RC', repeats: '', attendees: at([['MA', 'pending'], ['RC', 'yes'], ['JL', 'yes']]), agenda: [], notes: '' },
  { id: 'm21', date: day(17), start: '09:30', end: '10:30', title: 'All hands', calendar: 'team', room: 'Atrium', organiser: 'RC', repeats: 'Monthly', attendees: at([['MA', 'yes'], ['JL', 'yes'], ['PR', 'yes'], ['HY', 'yes'], ['TK', 'yes'], ['AB', 'yes']]), agenda: [], notes: '' },
  { id: 'm22', date: day(22), start: '11:00', end: '12:00', title: 'Vendor negotiation — Dell', calendar: 'client', room: 'Hive 1', organiser: 'TK', repeats: '', attendees: at([['MA', 'maybe'], ['TK', 'yes'], ['RC', 'yes']]), agenda: [], notes: '' },
  { id: 'm23', date: day(24), start: '15:00', end: '16:00', title: 'Design system review', calendar: 'team', room: 'Hive 2', organiser: 'MA', repeats: 'Monthly', attendees: at([['MA', 'yes'], ['HY', 'yes'], ['AB', 'yes']]), agenda: [], notes: '' },
  { id: 'm24', date: day(29), start: '10:00', end: '11:00', title: 'Monthly retro', calendar: 'team', room: 'Hive 1', organiser: 'HY', repeats: 'Monthly', attendees: at([['MA', 'yes'], ['HY', 'yes'], ['PR', 'yes'], ['AB', 'yes']]), agenda: [], notes: '' },
]
