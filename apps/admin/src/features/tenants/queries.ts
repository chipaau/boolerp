import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CreateTenantInput, CreateTenantResult, Tenant } from './types'

const key = (...parts: string[]) => ['admin', 'tenants', ...parts] as const

export function useTenants() {
  return useQuery({ queryKey: key('list'), queryFn: () => api.get<Tenant[]>('/api/v1/admin/tenants') })
}

export function useCreateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTenantInput) => api.post<CreateTenantResult>('/api/v1/admin/tenants', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key('list') }),
  })
}

type TransitionAction = 'suspend' | 'reactivate' | 'archive'

function useTransition(action: TransitionAction) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<Tenant>(`/api/v1/admin/tenants/${id}/${action}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key('list') }),
  })
}

export const useSuspendTenant = () => useTransition('suspend')
export const useReactivateTenant = () => useTransition('reactivate')
export const useArchiveTenant = () => useTransition('archive')
