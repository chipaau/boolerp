// Static mock data for the Inventory app, lifted from the design file so the screens carry the
// same numbers. Obviously fake; each block maps to a future API resource of the same shape.

export type ItemStatus = 'In stock' | 'Low stock' | 'Out of stock' | 'On order'
export type Item = {
  name: string
  sku: string
  location: string
  onHand: number
  issued: number
  status: ItemStatus
}

export const ITEMS: Item[] = [
  { name: 'Dell UltraSharp U2723QE', sku: 'SKU-4471-A', location: 'Warehouse A', onHand: 18, issued: 7, status: 'In stock' },
  { name: 'HP 26X toner cartridge', sku: 'SKU-2210-C', location: 'Warehouse A', onHand: 4, issued: 0, status: 'Low stock' },
  { name: 'CalDigit TS4 dock', sku: 'SKU-8802-B', location: 'Warehouse B', onHand: 11, issued: 24, status: 'Low stock' },
  { name: 'Safety helmet, size M', sku: 'SKU-1140-S', location: 'Site store', onHand: 0, issued: 12, status: 'Out of stock' },
  { name: 'MacBook Pro 14" M4', sku: 'SKU-9001-A', location: 'Warehouse A', onHand: 6, issued: 41, status: 'In stock' },
  { name: 'Logitech MX Master 3S', sku: 'SKU-3320-B', location: 'Warehouse B', onHand: 52, issued: 63, status: 'In stock' },
  { name: 'A4 copier paper, box', sku: 'SKU-0071-C', location: 'Warehouse A', onHand: 9, issued: 0, status: 'Low stock' },
  { name: 'Hi-vis vest, large', sku: 'SKU-1188-S', location: 'Site store', onHand: 34, issued: 29, status: 'In stock' },
  { name: 'Sit-stand desk frame', sku: 'SKU-6600-F', location: 'Warehouse B', onHand: 3, issued: 18, status: 'On order' },
  { name: 'First aid kit, workplace', sku: 'SKU-1201-S', location: 'Site store', onHand: 22, issued: 4, status: 'In stock' },
]

const COST: Record<string, number> = {
  'SKU-4471-A': 380,
  'SKU-2210-C': 90,
  'SKU-8802-B': 320,
  'SKU-1140-S': 26,
  'SKU-9001-A': 2100,
  'SKU-3320-B': 85,
  'SKU-0071-C': 25,
  'SKU-1188-S': 18,
  'SKU-6600-F': 420,
  'SKU-1201-S': 34,
}

export const STATUS_TONE: Record<ItemStatus, 'success' | 'warning' | 'risk' | 'plum'> = {
  'In stock': 'success',
  'Low stock': 'warning',
  'Out of stock': 'risk',
  'On order': 'plum',
}

export function isBelowReorder(i: Item) {
  return i.status === 'Low stock' || i.status === 'Out of stock'
}

/** Headline figures derived from the items, as the design does. */
export function summary() {
  const unitsOnHand = ITEMS.reduce((n, i) => n + i.onHand, 0)
  const issuedOut = ITEMS.reduce((n, i) => n + i.issued, 0)
  const stockValue = ITEMS.reduce((n, i) => n + i.onHand * (COST[i.sku] ?? 0), 0)
  const lowCount = ITEMS.filter(isBelowReorder).length
  const locations = [...new Set(ITEMS.map((i) => i.location))]
  return { unitsOnHand, issuedOut, stockValue, lowCount, locations, itemCount: ITEMS.length }
}

export function money(n: number) {
  return '£' + (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)))
}

export type Period = '7d' | '30d' | '90d'
export type Series = { labels: string[]; inn: number[]; out: number[]; onHand: number[]; low: number[]; issued: number[] }
export const SERIES: Record<Period, Series> = {
  '7d': {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    inn: [42, 18, 66, 31, 74, 12, 6],
    out: [28, 51, 34, 62, 45, 9, 4],
    onHand: [1246, 1238, 1259, 1252, 1274, 1279, 1284],
    low: [8, 10, 9, 12, 11, 13, 12],
    issued: [196, 201, 199, 207, 210, 212, 213],
  },
  '30d': {
    labels: ['1 Jul', '4', '7', '10', '13', '16', '19', '22', '25', '28'],
    inn: [58, 96, 41, 120, 74, 62, 138, 88, 54, 112],
    out: [72, 64, 88, 96, 131, 58, 84, 122, 96, 70],
    onHand: [1198, 1214, 1188, 1226, 1241, 1233, 1268, 1252, 1246, 1284],
    low: [15, 13, 16, 12, 11, 14, 10, 12, 13, 12],
    issued: [178, 183, 190, 188, 196, 201, 205, 208, 211, 213],
  },
  '90d': {
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'],
    inn: [164, 212, 138, 246, 188, 274, 152, 231, 296, 174, 208, 262],
    out: [188, 156, 224, 172, 261, 198, 244, 186, 218, 272, 164, 226],
    onHand: [1102, 1148, 1092, 1164, 1108, 1182, 1096, 1146, 1218, 1128, 1174, 1284],
    low: [22, 18, 24, 17, 21, 15, 23, 19, 14, 20, 16, 12],
    issued: [142, 151, 158, 163, 171, 176, 184, 191, 197, 203, 208, 213],
  },
}

export const LOW_STOCK = [
  { name: 'Safety helmet, size M', meta: 'Site store · 0 of 20 · reorder now', tag: 'Critical' as const },
  { name: 'HP 26X toner cartridge', meta: 'Warehouse A · 4 of 24', tag: 'Critical' as const },
  { name: 'A4 copier paper, box', meta: 'Warehouse A · 9 of 40', tag: 'Low' as const },
  { name: 'CalDigit TS4 dock', meta: 'Warehouse B · 11 of 30', tag: 'Low' as const },
]

export const CATEGORIES = [
  { name: 'IT equipment', value: 486, pct: 86, risk: 0 },
  { name: 'Consumables', value: 351, pct: 62, risk: 14 },
  { name: 'Facilities', value: 232, pct: 41, risk: 5 },
  { name: 'Safety gear', value: 147, pct: 26, risk: 9 },
  { name: 'Furniture', value: 68, pct: 12, risk: 0 },
]

export const APPROVALS = [
  { id: 'a0', title: 'Reorder · HP 26X toner ×24', meta: 'Joseph Okafor · Finance', who: 'Joseph Okafor', age: '2d', urgent: true },
  { id: 'a1', title: 'Issue MacBook Pro to R. Bakr', meta: 'Raised by IT · needs Manager sign-off', who: 'IT', age: '6h', urgent: false },
  { id: 'a2', title: 'Write-off · 3 damaged helmets', meta: 'Marco Rahman · Site ops', who: 'Marco Rahman', age: '1d', urgent: false },
  { id: 'a3', title: 'Transfer · 12 hi-vis vests to Site store', meta: 'Ana Silva · Warehouse B', who: 'Ana Silva', age: '4h', urgent: false },
  { id: 'a4', title: 'Reorder · Sit-stand desk frames ×6', meta: 'Dana Whitfield · Facilities', who: 'Dana Whitfield', age: '3d', urgent: true },
]

export const MOVEMENTS = [
  { text: '24 units of A4 copier paper received into Warehouse A', time: 'Today, 02:37 PM' },
  { text: 'MacBook Pro 14" issued to Rania Bakr', time: 'Today, 11:04 AM' },
  { text: '3 safety helmets written off after inspection', time: 'Yesterday, 04:12 PM' },
  { text: 'Stock count correction on CalDigit TS4 dock (−2)', time: 'Yesterday, 09:50 AM' },
  { text: '52 Logitech MX Master 3S received into Warehouse B', time: '21 Jul, 03:20 PM' },
  { text: '8 hi-vis vests transferred from Warehouse B to Site store', time: '21 Jul, 10:15 AM' },
]

export type ItemFilter = 'All' | 'Low stock' | 'Issued' | 'On order'
export const FILTERS: ItemFilter[] = ['All', 'Low stock', 'Issued', 'On order']

export function filterItems(items: Item[], filter: ItemFilter, query: string) {
  const q = query.trim().toLowerCase()
  return items.filter((i) => {
    if (filter === 'Low stock' && !isBelowReorder(i)) return false
    if (filter === 'Issued' && i.issued === 0) return false
    if (filter === 'On order' && i.status !== 'On order') return false
    if (!q) return true
    return `${i.name} ${i.sku} ${i.location}`.toLowerCase().includes(q)
  })
}

/** The saved views under "My views" in the sidebar, with live counts. */
export const SAVED_VIEWS: { label: string; filter: ItemFilter; q?: string }[] = [
  { label: 'Site store · below reorder', filter: 'Low stock', q: 'Site store' },
  { label: 'Issued to my team', filter: 'Issued' },
  { label: 'On order', filter: 'On order' },
]

export const PENDING_ORDERS = 4
export const PENDING_REQUESTS = 5
