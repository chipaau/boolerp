package auth

// Capability keys — the Phase-1 capability catalog (FR-AUTHZ-02), confirmed 2026-09-02. Code-seeded
// (single source), not a DB table; role_capabilities.capability must be one of these.
const (
	CapMembersInvite            = "members:invite"
	CapMembersManage            = "members:manage"
	CapMembersTransferOwnership = "members:transfer-ownership"
	CapRolesManage              = "roles:manage"
	CapRolesAssign              = "roles:assign"
	CapTenantManageSettings     = "tenant:manage-settings"
	CapTenantManageVisibility   = "tenant:manage-visibility"
	CapTenantManageHierarchy    = "tenant:manage-hierarchy" // operator
	CapAuditView                = "audit:view"

	// Platform capabilities act platform-wide only when held via a role on the internal tenant
	// (Cerbos's is_internal_member principal attribute is the sole enforcement — see srs.md).
	CapPlatformTenantsProvision = "platform:tenants:provision"
	CapPlatformTenantsSuspend   = "platform:tenants:suspend"
	CapPlatformSupportAccess    = "platform:support:access"
	CapPlatformAll              = "platform:*"
)
