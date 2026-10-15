import { BarChart3, Boxes, CalendarDays, FileCheck2, Laptop, ShoppingCart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * The workspace map (public/office.webp, 3000×2000, transparent): the workspace as a hub in the
 * middle, each app an island around it, joined by walkways. Every box below is in its pixels.
 */
export const OFFICE = { src: '/office.webp', width: 3000, height: 2000 } as const

type Box = [number, number, number, number] // left, top, right, bottom

/** The hub, always in colour: the workspace every app connects to. */
export const HUB: Box = [750, 581, 2250, 1556]

export type Room = {
  id: string
  title: string
  body: string
  /** Small labels on the app's row. */
  tags: string[]
  icon: LucideIcon
  /** The islands this step lights (one app, or a few that work together). */
  areas: Box[]
  /** What the app does, shown on its card as the step settles. */
  features: string[]
  /** Where the card stands, on the drawing. */
  pin: [number, number]
}

// UI fixtures: marketing content, not live data
export const ROOMS: Room[] = [
  {
    id: 'stock',
    title: 'Inventory',
    tags: ['Stock', 'Receiving', 'Transfers'],
    body: 'Stock, stores and suppliers, counted where they sit, received at the door and moved between sites.',
    icon: Boxes,
    areas: [[563, 28, 1284, 600], [2091, 159, 2841, 722], [1406, 1491, 2156, 1988]],
    features: ['Stock levels per site', 'Low-stock alerts', 'Receiving against orders', 'Transfers between stores'],
    pin: [1290, 640],
  },
  {
    id: 'requests',
    title: 'Requests',
    tags: ['Goods', 'Services'],
    body: 'Goods and services asked for, approved and delivered in one place, with every step on record.',
    icon: FileCheck2,
    areas: [[544, 1369, 1200, 1875], [2194, 1294, 2822, 1809]],
    features: ['Goods and service requests', 'Approval chains', 'Status at every step'],
    pin: [860, 1400],
  },
  {
    id: 'purchasing',
    title: 'Purchasing',
    tags: ['Orders', 'Suppliers'],
    body: 'Purchase orders raised from approved requests and tracked to delivery.',
    icon: ShoppingCart,
    areas: [[1369, 9, 1959, 459]],
    features: ['Orders from approved requests', 'Supplier quotes', 'Delivery tracking'],
    pin: [1960, 470],
  },
  {
    id: 'assets',
    title: 'Assets',
    tags: ['Devices', 'Checks'],
    body: 'Every laptop, desk and chair: who has it, where it is, and when it was last checked.',
    icon: Laptop,
    areas: [[2353, 769, 2981, 1294]],
    features: ['Assigned to people and sites', 'Verification rounds', 'Full history'],
    pin: [2560, 820],
  },
  {
    id: 'calendar',
    title: 'Calendar & Notes',
    tags: ['Rooms', 'People', 'Notes'],
    body: 'Rooms and people in one diary, and the notes that come out of the meeting.',
    icon: CalendarDays,
    areas: [[84, 469, 759, 994], [1509, 459, 1969, 769]],
    features: ['Room booking', 'Invites and replies', 'Shared notes'],
    pin: [380, 500],
  },
  {
    id: 'reports',
    title: 'Reports',
    tags: ['Insight', 'Exports'],
    body: 'Low stock, pending items and spend, from every app at once.',
    icon: BarChart3,
    areas: [[113, 994, 806, 1509]],
    features: ['Across every app', 'Pending and overdue', 'Export to Excel'],
    pin: [420, 1030],
  },
]

/** The middle of a step's islands, as fractions of the drawing. */
export function centreOf(room: Room) {
  const l = Math.min(...room.areas.map((a) => a[0]))
  const t = Math.min(...room.areas.map((a) => a[1]))
  const r = Math.max(...room.areas.map((a) => a[2]))
  const b = Math.max(...room.areas.map((a) => a[3]))
  return { x: (l + r) / 2 / OFFICE.width, y: (t + b) / 2 / OFFICE.height }
}
