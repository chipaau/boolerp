// Mirrors httpapi.tenantResponse (apps/api/internal/httpapi/admin_tenants.go).
export type TenantStatus = 'provisioning' | 'active' | 'suspended' | 'archived'

export type Tenant = {
  id: string
  slug: string
  code: string
  name: string
  country: string
  status: TenantStatus
  created_at: string
}

export type CreateTenantInput = {
  slug: string
  code: string
  name: string
  country: string
  party_type_code: string
  institution_type_code: string
  owner_email: string
  owner_name: string
}

export type CreateTenantResult = {
  tenant: Tenant
  recovery_link: string
}
