// Fixtures for personal notification preferences. Importable only from queries.ts (lint-enforced).
import type { NotificationPreference } from './types'

export const NOTIFICATION_PREFERENCES: NotificationPreference[] = [
  { personId: 'EMP-017', category: 'Stock', inApp: true, email: false, updatedOn: '2026-08-02' },
  { personId: 'EMP-017', category: 'Orders', inApp: false, email: true, updatedOn: '2026-08-19' },
  { personId: 'EMP-022', category: 'Meetings', inApp: true, email: false, updatedOn: '2026-07-11' },
]
