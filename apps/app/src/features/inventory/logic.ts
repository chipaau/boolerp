// Pure Inventory logic: presentation mappings and derivations over the resource types. No data
// lives here; components get data from ./queries and pass it in.
import type { Item, ItemFilter, ItemStatus } from './types'

export const STATUS_TONE: Record<ItemStatus, 'success' | 'warning' | 'risk' | 'plum'> = {
  'In stock': 'success',
  'Low stock': 'warning',
  'Out of stock': 'risk',
  'On order': 'plum',
}

export const FILTERS: ItemFilter[] = ['All', 'Low stock', 'Issued', 'On order']

export function isBelowReorder(i: Item) {
  return i.status === 'Low stock' || i.status === 'Out of stock'
}

/** Headline figures derived from the items, as the design does. */
export function summarize(items: Item[]) {
  const unitsOnHand = items.reduce((n, i) => n + i.onHand, 0)
  const issuedOut = items.reduce((n, i) => n + i.issued, 0)
  const stockValue = items.reduce((n, i) => n + i.onHand * i.unitCost, 0)
  const lowCount = items.filter(isBelowReorder).length
  const locations = [...new Set(items.map((i) => i.location))]
  return { unitsOnHand, issuedOut, stockValue, lowCount, locations, itemCount: items.length }
}

/** Compact figure for KPI tiles: 30.6k / 842. */
export function compactNumber(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n))
}

/** Compact money as text: "MVR 30.6k". Tenant currency defaults to MVR (conventions). */
export function formatMoney(n: number, currency = 'MVR') {
  return `${currency} ${compactNumber(n)}`
}

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
