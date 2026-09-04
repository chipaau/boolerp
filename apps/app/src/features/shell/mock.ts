// FIXTURES — sample data for the shell chrome. Only ./queries.ts may import this file
// (lint-enforced). Delete it when the notifications / counts endpoints exist.
import avatar5 from '@workspace/assets/avatars/avatar-5.jpg'
import type { Membership, NavCounts, Notification, SavedView } from './types'

export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', title: 'Printer toner is below reorder level', meta: '4 of 24 left in Warehouse A · 2 days of cover', category: 'Stock', time: '02:37 PM', group: 'Today', unread: true, to: { app: 'inventory', section: 'low-stock' } },
  { id: 'n2', title: 'Goods request awaiting your approval', meta: 'Raised by Joseph Okafor · Finance', category: 'Approvals', time: '08:05 AM', group: 'Today', unread: true, to: { app: 'inventory', section: 'requests' } },
  { id: 'n3', title: 'PO-2214 is overdue', meta: 'Northgate Office Supplies · expected 21 Jul', category: 'Orders', time: '07:10 AM', group: 'Today', unread: false, to: { app: 'inventory', section: 'purchase-orders' } },
  { id: 'n4', title: '3 safety helmets written off', meta: 'Marco Rahman · failed inspection', category: 'Stock', time: '04:12 PM', group: 'Yesterday', unread: false, to: { app: 'inventory', section: 'low-stock' } },
  { id: 'n5', title: 'Reorder rules changed', meta: 'Auto-reorder switched on for 4 items', category: 'Orders', time: '11:40 AM', group: 'Yesterday', unread: false, to: { app: 'inventory', section: 'settings' } },
  { id: 'n6', title: '52 Logitech MX Master 3S received', meta: 'PO-2201 · into Warehouse B', category: 'Orders', time: '21 Jul', group: 'Earlier', unread: false, to: { app: 'inventory', section: 'purchase-orders' } },
  { id: 'n7', title: 'MacBook Pro 14" issued to Rania Bakr', meta: 'Serial DL7742291 · Design', category: 'Stock', time: '21 Jul', group: 'Earlier', unread: false, to: { app: 'inventory', section: 'items' } },
]

/** Per app slug; keys match `badge.key` on the registry's menu items. */
export const NAV_COUNTS: Record<string, NavCounts> = {
  inventory: {
    items: 10,
    'low-stock': 4,
    'purchase-orders': 4,
    requests: 5,
    'view:site-store-below-reorder': 1,
    'view:issued-to-my-team': 8,
    'view:on-order': 1,
  },
}

/** Per app slug: the "My views" rail group. */
export const SAVED_VIEWS: Record<string, SavedView[]> = {
  inventory: [
    { title: 'Site store · below reorder', section: 'items', search: { filter: 'Low stock', q: 'Site store' }, badgeKey: 'view:site-store-below-reorder' },
    { title: 'Issued to my team', section: 'items', search: { filter: 'Issued' }, badgeKey: 'view:issued-to-my-team' },
    { title: 'On order', section: 'items', search: { filter: 'On order' }, badgeKey: 'view:on-order' },
  ],
}

export const MEMBERSHIP: Membership = { role: 'Admin', avatar: avatar5 }
