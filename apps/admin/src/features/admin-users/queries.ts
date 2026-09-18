// The admin users data seam (operators + tenant admins). Fixture-backed; mutations update the cache
// in place and return an undo.
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import * as mock from './mock'
import type { AdminUser, AdminUserInput, AdminUserSummary, Undo } from './types'

const key = (...parts: string[]) => ['admin', 'admin-users', ...parts] as const

export const adminUsersQuery = () =>
  queryOptions({ queryKey: key('list'), queryFn: async () => mock.ADMIN_USERS, initialData: mock.ADMIN_USERS, staleTime: Infinity })

export const useAdminUsers = () => useQuery(adminUsersQuery()).data
export const useAdminUser = (idNo: string) => useAdminUsers().find((u) => u.idNo === idNo)
export const useAdminRoles = () => mock.ROLES

export function useAdminUserSummary(): AdminUserSummary {
  const users = useAdminUsers()
  return useMemo(
    () => ({
      total: users.length,
      platformAdmins: users.filter((u) => u.role === 'Platform admin').length,
      pendingInvites: users.filter((u) => u.invite !== 'Accepted').length,
      expiredInvites: users.filter((u) => u.invite === 'Expired').length,
    }),
    [users]
  )
}

export function useAdminUserActions() {
  const qc = useQueryClient()
  const swap = useCallback((fn: (l: AdminUser[]) => AdminUser[]): Undo => {
    const before = qc.getQueryData<AdminUser[]>(key('list'))
    qc.setQueryData<AdminUser[]>(key('list'), (l) => fn(l ?? []))
    return () => qc.setQueryData<AdminUser[]>(key('list'), before)
  }, [qc])

  return {
    /** "Send invite": adds as Invited. Replaces an existing row with the same idNo. */
    invite: (input: AdminUserInput): Undo =>
      swap((l) => [...l.filter((u) => u.idNo !== input.idNo), { ...input, invite: 'Invited', activeFrom: input.activeFrom || '—' }]),
    /** "Save changes" on an existing user (role, scope, contact…). */
    update: (idNo: string, changes: Partial<Omit<AdminUser, 'idNo'>>): Undo =>
      swap((l) => l.map((u) => (u.idNo === idNo ? { ...u, ...changes } : u))),
    /** "Resend": sets the invite back to Invited. */
    resendInvite: (idNo: string): Undo => swap((l) => l.map((u) => (u.idNo === idNo ? { ...u, invite: 'Invited' } : u))),
  }
}
