// FIXTURES — sample data for the shell chrome. Only ./queries.ts may import this file
// (lint-enforced). Delete it when the notifications / counts endpoints exist.
import avatar1 from '@workspace/assets/avatars/avatar-1.jpg'
import avatar2 from '@workspace/assets/avatars/avatar-2.jpg'
import avatar3 from '@workspace/assets/avatars/avatar-3.jpg'
import avatar4 from '@workspace/assets/avatars/avatar-4.webp'
import avatar5 from '@workspace/assets/avatars/avatar-5.jpg'
import avatar6 from '@workspace/assets/avatars/avatar-6.jpg'
import avatar7 from '@workspace/assets/avatars/avatar-7.jpg'
import type { AvatarChoice, Membership, NavCounts, Notification, SavedView, SupportLink } from './types'

export const NOTIFICATIONS: Notification[] = [
  { id: 'n8', eventKey: 'calendar.meeting_invite', recipientIds: ['EMP-017'], title: 'Northwind quarterly needs your reply', meta: 'Tom Kean · today 11:30am · Atrium', category: 'Meetings', time: '08:12 AM', group: 'Today', unread: true, to: { app: 'calendar', section: 'meetings', id: 'm08' } },
  { id: 'n9', eventKey: 'calendar.meeting_moved', recipientIds: ['EMP-017'], title: 'Priya moved your 1:1 to 5:00 pm', meta: 'Was 4:30pm · Nook', category: 'Meetings', time: '07:40 AM', group: 'Today', unread: true, to: { app: 'calendar', section: 'meetings', id: 'm10' } },
  { id: 'n1', eventKey: 'inventory.stock_below_min', recipientIds: ['EMP-003', 'EMP-010', 'EMP-017'], title: 'Printer toner is below reorder level', meta: '4 of 24 left in Malé central · 2 days of cover', category: 'Stock', time: '02:37 PM', group: 'Today', unread: true, to: { app: 'inventory', section: 'low-stock' } },
  { id: 'n2', eventKey: 'approvals.waiting', recipientIds: ['EMP-017'], title: 'Goods request awaiting your approval', meta: 'Raised by Joseph Okafor · Finance', category: 'Approvals', time: '08:05 AM', group: 'Today', unread: true, to: { app: 'inventory', section: 'requests' } },
  { id: 'n3', eventKey: 'inventory.po_overdue', recipientIds: ['EMP-010', 'EMP-017'], title: 'PO-2214 is overdue', meta: 'Northgate Office Supplies · expected 21 Jul', category: 'Orders', time: '07:10 AM', group: 'Today', unread: false, to: { app: 'inventory', section: 'purchase-orders' } },
  { id: 'n4', eventKey: 'inventory.write_off', recipientIds: ['EMP-003', 'EMP-017'], title: '3 safety helmets written off', meta: 'Marco Rahman · failed inspection', category: 'Stock', time: '04:12 PM', group: 'Yesterday', unread: false, to: { app: 'inventory', section: 'low-stock' } },
  { id: 'n10', eventKey: 'calendar.meeting_added', recipientIds: ['EMP-017'], title: 'Interview slot added for Tuesday', meta: 'Elena Marsh · Senior PM, second round', category: 'Meetings', time: '04:15 PM', group: 'Yesterday', unread: false, to: { app: 'calendar', section: 'meetings', id: 'm15' } },
  { id: 'n5', eventKey: 'inventory.reorder_rules_changed', recipientIds: ['EMP-017'], title: 'Reorder rules changed', meta: 'Auto-reorder switched on for 4 items', category: 'Orders', time: '11:40 AM', group: 'Yesterday', unread: false, to: { app: 'inventory', section: 'settings' } },
  { id: 'n11', eventKey: 'controlcentre.site_paused', recipientIds: ['EMP-001', 'EMP-002', 'EMP-013', 'EMP-017', 'EMP-022'], title: 'Eydhafushi counter paused', meta: 'Stock frozen · Jasper Klein on leave', category: 'Setup', time: '28 Jul', group: 'Earlier', unread: false, to: { app: 'control-centre', section: 'sites' } },
  { id: 'n6', eventKey: 'inventory.po_received', recipientIds: ['EMP-005', 'EMP-010', 'EMP-017'], title: '52 Logitech MX Master 3S received', meta: 'PO-2201 · into Hithadhoo overflow', category: 'Orders', time: '21 Jul', group: 'Earlier', unread: false, to: { app: 'inventory', section: 'purchase-orders' } },
  { id: 'n7', eventKey: 'inventory.item_issued', recipientIds: ['EMP-017'], title: 'MacBook Pro 14" issued to Rania Bakr', meta: 'Serial DL7742291 · Design', category: 'Stock', time: '21 Jul', group: 'Earlier', unread: false, to: { app: 'inventory', section: 'items' } },
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
    { title: 'Kulhudhuffushi · below reorder', section: 'items', search: { filter: 'Low stock', q: 'Kulhudhuffushi' }, badgeKey: 'view:site-store-below-reorder' },
    { title: 'Issued to my team', section: 'items', search: { filter: 'Issued' }, badgeKey: 'view:issued-to-my-team' },
    { title: 'On order', section: 'items', search: { filter: 'On order' }, badgeKey: 'view:on-order' },
  ],
}

export const MEMBERSHIP: Membership = { role: 'Admin', avatar: avatar5 }

/** Stand-in portraits until the workspace supplies its own Hexa set. */
export const AVATAR_CHOICES: AvatarChoice[] = [
  { id: 'a1', src: avatar1, label: 'Portrait 1' },
  { id: 'a2', src: avatar2, label: 'Portrait 2' },
  { id: 'a3', src: avatar3, label: 'Portrait 3' },
  { id: 'a4', src: avatar4, label: 'Portrait 4' },
  { id: 'a5', src: avatar5, label: 'Portrait 5' },
  { id: 'a6', src: avatar6, label: 'Portrait 6' },
  { id: 'a7', src: avatar7, label: 'Portrait 7' },
]

/** Placeholder destinations; the real help centre and support inbox replace these at integration. */
export const SUPPORT_LINKS: SupportLink[] = [
  { label: 'Help centre', href: 'https://bool.mv/help', hint: 'Guides for every app, searchable' },
  { label: 'Email support', href: 'mailto:support@bool.mv', hint: 'A person replies within one working day' },
  { label: "What's new", href: 'https://bool.mv/changelog', hint: 'Every release, in plain words' },
]
