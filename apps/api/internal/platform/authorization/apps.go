package authorization

import (
	"embed"
	"io/fs"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Migrations returns the module's tables, applied by cmd/migrate as "authorization",
// after tenancy (roles belong to tenants and are assigned to memberships).
func Migrations() fs.FS {
	sub, err := fs.Sub(migrations, "migrations")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}

// App is an app tenants activate (C165): its key (the frontend manifest's slug), name,
// kind, description, and the capabilities its roles may grant (C168). Each module
// declares its own; the edition lists them, and the authorization.apps and
// authorization.capabilities seed files mirror them into the apps and capabilities tables.
type App struct {
	Key, Name, Description string
	Kind                   AppKind
	Capabilities           []Capability
}

// Capability is something a role may grant (C153, C168): <module>:<resource>:<level>.
type Capability struct {
	Key, Name, Description string
}

// AppKind is who uses an app.
type AppKind string

// The kinds of app (C165).
const (
	// Workspace apps are used by a tenant's members in its workspace.
	Workspace AppKind = "workspace"
	// Operator apps may be activated only by the operator tenant (the admin console).
	Operator AppKind = "operator"
	// Product apps are separate products across tenants on Bool's own domain (FindCare).
	Product AppKind = "product"
)

// The platform's own apps (the user's choice, 2026-10-06): the admin console, where
// the operator's staff manage tenants, and Control Centre, a tenant's own
// administration (members, roles, audit). Business apps are declared by their modules.
var (
	Admin = App{Key: "admin", Name: "Admin console", Kind: Operator,
		Description: "Bool's staff manage tenants, their domains, and their owners.",
		Capabilities: []Capability{ // C153
			{Key: "tenancy:tenant:view", Name: "View tenants", Description: "List and see every tenant."},
			{Key: "tenancy:tenant:manage", Name: "Manage tenants",
				Description: "Create, change, suspend, reactivate, and archive tenants; includes viewing them."},
		}}
	ControlCentre = App{Key: "control-centre", Name: "Control Centre", Kind: Workspace,
		Description: "A tenant's own administration: members, roles, and audit."}
)

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
