// FIXTURES — sample data for the shell chrome. Only ./queries.ts may import this file
// (lint-enforced). Delete it when the notifications / counts endpoints exist.
import type { Membership, NavCounts, Notification, SavedView } from './types'

export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', text: 'Printer toner is below reorder level', time: 'Today, 02:37 PM', unread: true },
  { id: 'n2', text: 'Goods request awaiting your approval', time: 'Today, 08:05 AM', unread: true },
  { id: 'n3', text: 'Purchase order PO-2214 is 1 day overdue', time: 'Yesterday, 05:20 PM', unread: false },
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

export const MEMBERSHIP: Membership = { role: 'Admin' }
