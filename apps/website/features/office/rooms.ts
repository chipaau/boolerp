import { Boxes, CalendarDays, FileCheck2, Laptop, Settings2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** The isometric office (public/office.webp, transparent, 2000×1333); every point below is in its pixels. */
export const OFFICE = { src: '/office.webp', width: 2000, height: 1333 } as const

type Point = [number, number]

export type Room = {
  id: string
  title: string
  body: string
  /** Small labels on the app's row, like the reference's disciplines. */
  tags: string[]
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
    tags: ['Stock', 'Stores', 'Suppliers'],
    title: 'Inventory',
    body: 'Stock, stores and suppliers, counted where they sit. Low stock flags itself before anyone runs out.',
    icon: Boxes,
    outline: [[125, 320], [455, 140], [712, 282], [712, 420], [512, 528], [505, 690], [180, 520]],
    pin: [330, 390],
    card: { title: 'Printer toner', detail: '4 left · reorder at 10', status: 'Below reorder' },
  },
  {
    id: 'requests',
    tags: ['Goods', 'Services', 'Purchases'],
    title: 'Requests',
    body: 'Goods, services and purchases asked for, approved and delivered in one place, with every step on record.',
    icon: FileCheck2,
    outline: [[595, 490], [800, 385], [1160, 590], [1160, 640], [1035, 770], [870, 800], [600, 585]],
    pin: [880, 560],
    card: { title: 'PO-0142', detail: '24 reams A4 · Finance', status: 'Approved' },
    route: [[880, 610], [700, 660], [540, 630], [430, 575]],
  },
  {
    id: 'assets',
    tags: ['Devices', 'Furniture', 'Checks'],
    title: 'Assets',
    body: 'Every laptop, desk and chair: who has it, where it is, and when it was last checked.',
    icon: Laptop,
    outline: [[1380, 575], [1500, 505], [1748, 648], [1748, 765], [1650, 795], [1380, 645]],
    pin: [1560, 620],
    card: { title: 'MacBook Pro 14"', detail: 'Assigned to Rania Bakr', status: 'Verified' },
  },
  {
    id: 'calendar',
    tags: ['Rooms', 'People', 'Invites'],
    title: 'Calendar',
    body: 'Rooms and people in one diary. Find a free room, invite the team, and the room is held.',
    icon: CalendarDays,
    outline: [[715, 115], [880, 30], [1258, 235], [1252, 410], [1065, 495], [715, 300]],
    pin: [1010, 290],
    card: { title: 'Hive 2 · Stock review', detail: 'Today, 4:00 PM · 6 people', status: 'Booked' },
  },
  {
    id: 'control-centre',
    tags: ['Sites', 'Roles', 'Approvals'],
    title: 'Control Centre',
    body: 'Sites, people and approval chains, set up once in one office, and every app follows them.',
    icon: Settings2,
    outline: [[1410, 885], [1605, 770], [1885, 922], [1880, 958], [1690, 1080], [1500, 1135], [1410, 1050]],
    pin: [1630, 930],
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
