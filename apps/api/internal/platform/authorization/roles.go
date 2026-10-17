package authorization

// Role is a global role (C167): Bool's, declared in code for one app and mirrored into
// roles and role_capabilities by the authorization.roles seed file, matched by Key
// (<app key>.<name>). Changing one changes it in every tenant, which is why it is only
// ever changed here, through review.
type Role struct {
	Key, App, Name, Description string
	Capabilities                []string
}

// The admin console's global roles (the user's choice, 2026-10-07): two broad roles that
// grow as the console does; a new admin area adds its capabilities to them here.
var (
	AdminAdministrator = Role{Key: "admin.administrator", App: Admin.Key, Name: "Administrator",
		Description:  "Everything in the admin console.",
		Capabilities: []string{"tenancy:tenant:view", "tenancy:tenant:manage"}}
	AdminViewer = Role{Key: "admin.viewer", App: Admin.Key, Name: "Viewer",
		Description:  "Sees everything in the admin console and changes nothing.",
		Capabilities: []string{"tenancy:tenant:view"}}
)

// ControlCentreAdministrator is a tenant's administrator (C228): the operator hands it to the
// tenant's first administrators, and it grows with Control Centre's capabilities, declared
// here as Control Centre gains them. Until then it grants nothing beyond membership.
var ControlCentreAdministrator = Role{Key: "control-centre.administrator", App: ControlCentre.Key, Name: "Administrator",
	Description: "Runs the tenant in Control Centre: its people, roles, and settings."}
