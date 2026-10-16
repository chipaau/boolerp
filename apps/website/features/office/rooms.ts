import type { StaticImageData } from 'next/image'
import type { LucideIcon } from 'lucide-react'
import {
  BellRing,
  ChartColumn,
  ClipboardList,
  Clock,
  DoorOpen,
  Eye,
  FileCheck,
  FileSpreadsheet,
  GitBranch,
  History,
  NotebookPen,
  PackageCheck,
  Scale,
  Send,
  Truck,
  UserCheck,
  Wrench,
} from 'lucide-react'
import analytics from '@workspace/assets/logos/analytics.png'
import asset from '@workspace/assets/logos/asset.png'
import inventory from '@workspace/assets/logos/inventory.png'
import notes from '@workspace/assets/logos/notes-glyph.png'
import procurement from '@workspace/assets/logos/procurement.png'
import task from '@workspace/assets/logos/task.png'

/**
 * The workspace map is drawn on a 1600×1000 stage: the workspace (the hub) in the middle and the
 * apps' rooms in a ring around it, each joined to the hub by a dotted walkway. Every position below
 * is in stage pixels.
 */
export const STAGE = { width: 1600, height: 1000 } as const
export const HUB = { x: 800, y: 500 } as const
/** A room's drawing (public/workspace/*.webp, 900×675) on the stage. */
export const TILE = { width: 360, height: 270 } as const

export type Tile = {
  /** public/workspace/<src>.webp */
  src: string
  /** Where it sits on the ring around the hub: degrees, clockwise from the right. */
  angle: number
}

export type Room = {
  id: string
  title: string
  /** The app's own logo, from the workspace. */
  logo: StaticImageData
  /** What it does for the team, as an outcome (the card's headline). */
  headline: string
  /** What it does, each with its own small icon. */
  features: { icon: LucideIcon; text: string }[]
  /** The rooms that are this app's (one, or a few that work together). */
  tiles: Tile[]
}

// UI fixtures: marketing content, not live data
export const ROOMS: Room[] = [
  {
    id: 'inventory',
    title: 'Inventory',
    logo: inventory,
    headline: 'Never run out of what you need',
    features: [
      { icon: PackageCheck, text: 'See what is in stock at every site, live' },
      { icon: BellRing, text: 'Get told before anything runs low' },
      { icon: Truck, text: 'Check deliveries in against the order' },
    ],
    tiles: [{ src: 'warehouse', angle: 234 }, { src: 'receiving', angle: 198 }, { src: 'transfer', angle: 162 }],
  },
  {
    id: 'purchasing',
    title: 'Purchasing',
    logo: procurement,
    headline: 'Orders that start from approved requests',
    features: [
      { icon: FileCheck, text: 'Turn an approved request into an order in a click' },
      { icon: Scale, text: 'Compare supplier quotes side by side' },
      { icon: Truck, text: 'Know when every delivery will arrive' },
    ],
    tiles: [{ src: 'purchase', angle: -90 }],
  },
  {
    id: 'requests',
    title: 'Requests',
    logo: task,
    headline: 'Every ask approved and delivered, on one record',
    features: [
      { icon: ClipboardList, text: 'Ask for anything in one form, not ten emails' },
      { icon: GitBranch, text: 'Approvals route themselves to the right people' },
      { icon: Eye, text: 'Everyone sees where a request stands' },
    ],
    tiles: [{ src: 'requests', angle: -54 }],
  },
  {
    id: 'assets',
    title: 'Assets',
    logo: asset,
    headline: 'Know who has what, and when it was checked',
    features: [
      { icon: UserCheck, text: 'Know who has every device, at a glance' },
      { icon: Wrench, text: 'Checks and servicing reminded on time' },
      { icon: History, text: 'Every item’s full history when audit asks' },
    ],
    tiles: [{ src: 'maintenance', angle: -18 }, { src: 'storage', angle: 18 }],
  },
  {
    id: 'reports',
    title: 'Reports',
    logo: analytics,
    headline: 'The whole picture, without the spreadsheets',
    features: [
      { icon: ChartColumn, text: 'Live numbers from every app, in one place' },
      { icon: Clock, text: 'Spot what is pending or overdue before it slips' },
      { icon: FileSpreadsheet, text: 'Board-ready exports to Excel' },
    ],
    tiles: [{ src: 'analytics', angle: 54 }],
  },
  {
    id: 'calendar',
    title: 'Calendar & Notes',
    logo: notes,
    headline: 'Meetings, and what was agreed, together',
    features: [
      { icon: DoorOpen, text: 'Book a room in a few keystrokes' },
      { icon: Send, text: 'Invites and replies without the back-and-forth' },
      { icon: NotebookPen, text: 'Decisions noted right beside the meeting' },
    ],
    tiles: [{ src: 'meeting', angle: 90 }, { src: 'notes', angle: 126 }],
  },
]

/** Where the camera looks for an app: the middle of its rooms (stage pixels). */
export function focusOf(room: Room) {
  const ps = room.tiles.map(placeOf)
  return { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length }
}

/** The ring the rooms sit on. */
const RING = { rx: 610, ry: 385 }

/** A room's centre on the stage. */
export function placeOf(t: Tile) {
  const a = (t.angle * Math.PI) / 180
  return { x: HUB.x + RING.rx * Math.cos(a), y: HUB.y + RING.ry * Math.sin(a) }
}

/**
 * The walkway from the hub to a room, along the drawing's two isometric directions (down-right and
 * up-right, 30° off the horizontal), as an SVG path: out along one, then along the other.
 */
export function walkway(t: Tile) {
  const to = placeOf(t)
  const dx = to.x - HUB.x
  const dy = to.y - HUB.y
  const c = Math.cos(Math.PI / 6)
  // dx = c·(a + b), dy = ½·(a − b): a along down-right, b along up-right
  const a = (dx / c + 2 * dy) / 2
  const turn = { x: HUB.x + a * c, y: HUB.y + a / 2 }
  return `M${HUB.x},${HUB.y} L${turn.x.toFixed(1)},${turn.y.toFixed(1)} L${to.x.toFixed(1)},${to.y.toFixed(1)}`
}
