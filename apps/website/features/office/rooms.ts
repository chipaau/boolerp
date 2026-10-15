import { Boxes, CalendarDays, FileCheck2, Laptop, Settings2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** The isometric office (public/office.webp, transparent, 1536×1024); every point below is in its pixels. */
export const OFFICE = { src: '/office.webp', lines: '/office-lines.webp', width: 1536, height: 1024 } as const

type Point = [number, number]

export type Room = {
  id: string
  title: string
  /** The step's headline, its middle part in amber. */
  headline: [string, string, string]
  body: string
  icon: LucideIcon
  /** The room's footprint, walls included, traced on the drawing. */
  outline: Point[]
  /** Where the card's leader starts, inside the room. */
  pin: Point
  card: { title: string; detail: string; status?: string }
  /** A dotted route drawn when the room is lit (Requests: from the reception desk to the store). */
  route?: Point[]
}

// UI fixtures: marketing content, not live data
export const ROOMS: Room[] = [
  {
    id: 'inventory',
    headline: ['Stock that', 'counts itself', '.'],
    title: 'Inventory',
    body: 'Stock, stores and suppliers, counted where they sit. Low stock flags itself before anyone runs out.',
    icon: Boxes,
    outline: [[55, 455], [330, 296], [545, 420], [545, 548], [300, 742], [55, 556]],
    pin: [440, 430],
    card: { title: 'Printer toner', detail: '4 left · reorder at 10', status: 'Below reorder' },
  },
  {
    id: 'requests',
    headline: ['Manage', 'requests', 'with clarity.'],
    title: 'Requests',
    body: 'Goods, services and purchases asked for, approved and delivered in one place, with every step on record.',
    icon: FileCheck2,
    outline: [[300, 690], [625, 512], [790, 612], [790, 700], [470, 880], [300, 785]],
    pin: [565, 665],
    card: { title: 'PO-0142', detail: '24 reams A4 · Finance', status: 'Approved' },
    route: [[565, 665], [470, 610], [420, 560], [330, 520], [280, 500]],
  },
  {
    id: 'assets',
    headline: ['Every asset,', 'accounted for', '.'],
    title: 'Assets',
    body: 'Every laptop, desk and chair: who has it, where it is, and when it was last checked.',
    icon: Laptop,
    outline: [[560, 425], [790, 300], [1050, 440], [1050, 470], [820, 610], [560, 470]],
    pin: [850, 500],
    card: { title: 'MacBook Pro 14"', detail: 'Assigned to Rania Bakr', status: 'Verified' },
  },
  {
    id: 'calendar',
    headline: ['Rooms that', 'book themselves', '.'],
    title: 'Calendar',
    body: 'Rooms and people in one diary. Find a free room, invite the team, and the room is held.',
    icon: CalendarDays,
    outline: [[770, 110], [930, 16], [1282, 216], [1282, 322], [1062, 432], [770, 262]],
    pin: [1010, 240],
    card: { title: 'Hive 2 · Stock review', detail: 'Today, 4:00 PM · 6 people', status: 'Booked' },
  },
  {
    id: 'control-centre',
    headline: ['Set up once,', 'used everywhere', '.'],
    title: 'Control Centre',
    body: 'Sites, people and approval chains, set up once in one office, and every app follows them.',
    icon: Settings2,
    outline: [[348, 228], [555, 106], [665, 170], [665, 268], [500, 385], [348, 298]],
    pin: [470, 235],
    card: { title: 'Approval chains', detail: 'Purchases over MVR 5,000', status: '3 steps' },
  },
]

/** A room's centre (the average of its outline), as fractions of the drawing. */
export function centreOf(room: Room) {
  const n = room.outline.length
  const x = room.outline.reduce((s, p) => s + p[0], 0) / n
  const y = room.outline.reduce((s, p) => s + p[1], 0) / n
  return { x: x / OFFICE.width, y: y / OFFICE.height }
}
