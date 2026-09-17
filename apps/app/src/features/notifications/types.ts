// Personal notification preference shapes. Mirrors what the API will return.
import type { NotificationCategory } from '@/features/shell/types'

export type NotificationChannel = 'inApp' | 'email'

/**
 * One person's choice for one category. A missing row means "follow the organisation's rule";
 * mandatory rules ignore it.
 */
export type NotificationPreference = {
  personId: string
  category: NotificationCategory
  inApp: boolean
  email: boolean
  /** ISO date of the last change. */
  updatedOn: string
}
