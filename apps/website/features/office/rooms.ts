import { BarChart3, Boxes, CalendarDays, FileCheck2, Laptop, ShoppingCart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { StaticImageData } from 'next/image'
import analytics from '@workspace/assets/logos/analytics.png'
import asset from '@workspace/assets/logos/asset.png'
import inventory from '@workspace/assets/logos/inventory.png'
import notes from '@workspace/assets/logos/notes-glyph.png'
import procurement from '@workspace/assets/logos/procurement.png'
import task from '@workspace/assets/logos/task.png'

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
  /** The app's own logo, from the workspace. */
  logo: StaticImageData
  /** The islands this step lights (one app, or a few that work together). */
  areas: Box[]
  /** What the app does, shown on its card as the step settles. */
  features: string[]
  /** Where the card stands, on the drawing. */
  pin: [number, number]
  /** Each island's walkway into the hub, island end first (one per area). */
  routes: [number, number][][]
  /** One line on what the app is worth. */
  value: string
  /** A slice of the real app: a screenshot and the box to show (px, on its 1600×1000 image). */
  ui: { src: string; box: [number, number, number, number] }
}

// UI fixtures: marketing content, not live data
export const ROOMS: Room[] = [
  {
    id: 'stock',
    routes: [[[1060, 540], [1200, 600], [1280, 645]], [[2330, 650], [2120, 780], [2020, 840]], [[1900, 1540], [1760, 1470]]],
    value: 'Know what you have, where it is, before anyone runs out.',
    ui: { src: '/apps/inventory.webp', box: [300, 230, 1560, 440] },
    title: 'Inventory',
    tags: ['Stock', 'Receiving', 'Transfers'],
    body: 'Stock, stores and suppliers, counted where they sit, received at the door and moved between sites.',
    icon: Boxes,
    logo: inventory,
    areas: [[563, 28, 1284, 600], [2091, 159, 2841, 722], [1406, 1491, 2156, 1988]],
    features: ['Stock levels per site', 'Low-stock alerts', 'Receiving against orders', 'Transfers between stores'],
    pin: [1330, 760],
  },
  {
    id: 'requests',
    routes: [[[1000, 1380], [1100, 1310], [1160, 1260]], [[2280, 1450], [2160, 1380], [2020, 1290]]],
    value: 'Every ask approved, ordered and delivered on one record.',
    ui: { src: '/apps/home.webp', box: [64, 440, 844, 882] },
    title: 'Requests',
    tags: ['Goods', 'Services'],
    body: 'Goods and services asked for, approved and delivered in one place, with every step on record.',
    icon: FileCheck2,
    logo: task,
    areas: [[544, 1369, 1200, 1875], [2194, 1294, 2822, 1809]],
    features: ['Goods and service requests', 'Approval chains', 'Status at every step'],
    pin: [860, 1400],
  },
  {
    id: 'purchasing',
    routes: [[[1700, 470], [1720, 560]]],
    value: 'Purchase orders that start from approved requests, not emails.',
    ui: { src: '/apps/inventory.webp', box: [1154, 476, 1536, 834] },
    title: 'Purchasing',
    tags: ['Orders', 'Suppliers'],
    body: 'Purchase orders raised from approved requests and tracked to delivery.',
    icon: ShoppingCart,
    logo: procurement,
    areas: [[1369, 9, 1959, 459]],
    features: ['Orders from approved requests', 'Supplier quotes', 'Delivery tracking'],
    pin: [1960, 470],
  },
  {
    id: 'assets',
    routes: [[[2360, 1045], [2210, 1100]]],
    value: 'Who has what, where, and when it was last checked.',
    ui: { src: '/apps/directory.webp', box: [284, 350, 1560, 680] },
    title: 'Assets',
    tags: ['Devices', 'Checks'],
    body: 'Every laptop, desk and chair: who has it, where it is, and when it was last checked.',
    icon: Laptop,
    logo: asset,
    areas: [[2353, 769, 2981, 1294]],
    features: ['Assigned to people and sites', 'Verification rounds', 'Full history'],
    pin: [2560, 820],
  },
  {
    id: 'calendar',
    routes: [[[600, 880], [800, 990]], [[1920, 830], [1880, 770]]],
    value: 'Rooms, people and what was agreed, in one diary.',
    ui: { src: '/apps/calendar.webp', box: [1224, 246, 1560, 704] },
    title: 'Calendar & Notes',
    tags: ['Rooms', 'People', 'Notes'],
    body: 'Rooms and people in one diary, and the notes that come out of the meeting.',
    icon: CalendarDays,
    logo: notes,
    areas: [[84, 469, 759, 994], [1509, 459, 1969, 769]],
    features: ['Room booking', 'Invites and replies', 'Shared notes'],
    pin: [380, 500],
  },
  {
    id: 'reports',
    routes: [[[790, 1220], [870, 1180]]],
    value: 'The numbers from every app, without stitching spreadsheets.',
    ui: { src: '/apps/inventory.webp', box: [314, 476, 1124, 864] },
    title: 'Reports',
    tags: ['Insight', 'Exports'],
    body: 'Low stock, pending items and spend, from every app at once.',
    icon: BarChart3,
    logo: analytics,
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
