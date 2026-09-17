// Admin user shapes from the Bool Admin design. Pending SRS/data-model review.
import type { InviteState, Nationality } from '@/features/tenants/types'

export type { InviteState, Nationality, Undo } from '@/features/tenants/types'

export type AdminRole = 'Platform admin' | 'Tenant admin' | 'Support' | 'Read only'

export type RoleDef = { key: AdminRole; note: string }

export type AdminUser = {
  /** National ID or passport number; the key. */
  idNo: string
  name: string
  email: string
  contact: string
  role: AdminRole
  /** 'All tenants', or a tenant abbreviation (e.g. 'NCIT') for tenant admins. */
  scope: string
  invite: InviteState
  /** '—' until accepted. */
  activeFrom: string
  nationality: Nationality
}

export type AdminUserInput = Omit<AdminUser, 'invite' | 'activeFrom'> & { activeFrom?: string }

export type AdminUserSummary = { total: number; platformAdmins: number; pendingInvites: number; expiredInvites: number }
