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
	//
	// Reading the tenant directory is its own capability: it is the customer list, and internal
	// membership alone used to be enough to enumerate it. Archiving is its own too — it is
	// irreversible, and was previously gated on the capability for the reversible suspend.
	CapPlatformTenantsRead      = "platform:tenants:read"
	CapPlatformTenantsProvision = "platform:tenants:provision"
	CapPlatformTenantsSuspend   = "platform:tenants:suspend"
	CapPlatformTenantsArchive   = "platform:tenants:archive"
	CapPlatformSupportAccess    = "platform:support:access"
	// CapPlatformAll is a LITERAL slug meaning "every platform capability", not a pattern Cerbos
	// expands: policies match the string, so each rule spells it out alongside its own capability.
	CapPlatformAll = "platform:*"
)
