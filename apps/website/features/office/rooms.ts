import type { StaticImageData } from 'next/image'
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
  /** Small labels under the title. */
  tags: string[]
  /** The app's own logo, from the workspace. */
  logo: StaticImageData
  /** One line on what the app is worth. */
  value: string
  features: string[]
  /** The rooms that are this app's (one, or a few that work together). */
  tiles: Tile[]
}

// UI fixtures: marketing content, not live data
export const ROOMS: Room[] = [
  {
    id: 'inventory',
    title: 'Inventory',
    tags: ['Stock', 'Receiving', 'Transfers'],
    logo: inventory,
    value: 'Know what you have, where it is, before anyone runs out.',
    features: ['Stock levels per site', 'Low-stock alerts', 'Receiving against orders', 'Transfers between stores'],
    tiles: [{ src: 'warehouse', angle: 234 }, { src: 'receiving', angle: 198 }, { src: 'transfer', angle: 162 }],
  },
  {
    id: 'purchasing',
    title: 'Purchasing',
    tags: ['Orders', 'Suppliers'],
    logo: procurement,
    value: 'Purchase orders that start from approved requests, not emails.',
    features: ['Orders from approved requests', 'Supplier quotes', 'Delivery tracking'],
    tiles: [{ src: 'purchase', angle: -90 }],
  },
  {
    id: 'requests',
    title: 'Requests',
    tags: ['Goods', 'Services'],
    logo: task,
    value: 'Every ask approved, ordered and delivered on one record.',
    features: ['Goods and service requests', 'Approval chains', 'Status at every step'],
    tiles: [{ src: 'requests', angle: -54 }],
  },
  {
    id: 'assets',
    title: 'Assets',
    tags: ['Devices', 'Upkeep'],
    logo: asset,
    value: 'Who has what, where, and when it was last looked after.',
    features: ['Assigned to people and sites', 'Maintenance and checks', 'Full history'],
    tiles: [{ src: 'maintenance', angle: -18 }, { src: 'storage', angle: 18 }],
  },
  {
    id: 'reports',
    title: 'Reports',
    tags: ['Insight', 'Exports'],
    logo: analytics,
    value: 'The numbers from every app, without stitching spreadsheets.',
    features: ['Across every app', 'Pending and overdue', 'Export to Excel'],
    tiles: [{ src: 'analytics', angle: 54 }],
  },
  {
    id: 'calendar',
    title: 'Calendar & Notes',
    tags: ['Rooms', 'People', 'Notes'],
    logo: notes,
    value: 'Rooms, people and what was agreed, in one diary.',
    features: ['Room booking', 'Invites and replies', 'Shared notes'],
    tiles: [{ src: 'meeting', angle: 90 }, { src: 'notes', angle: 126 }],
  },
]

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
