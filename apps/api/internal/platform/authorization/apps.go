package authorization

// App is an app tenants activate (C165): its key (the frontend manifest's slug), name,
// kind, description, whether every new tenant starts with it (IsDefault, C204; workspace
// apps only), and the capabilities its roles may grant (C168). Each module
// declares its own; the edition lists them, and the tenancy.apps (C206) and
// authorization.capabilities seed files mirror them into the apps and capabilities tables.
type App struct {
	Key, Name, Description string
	Kind                   AppKind
	IsDefault              bool
	// IsAvailable: a tenant may have it turned on (C225); otherwise it is listed as coming
	// soon. A default app must be available.
	IsAvailable  bool
	Capabilities []Capability
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
// administration (members, roles, audit); and Calendar (2026-10-15), declared here until
// a calendar module owns it. Control Centre and Calendar are default apps: every new
// tenant starts with them (C204). Business apps are declared by their modules.
var (
	Admin = App{Key: "admin", Name: "Admin console", Kind: Operator, IsAvailable: true,
		Description: "Bool's staff manage tenants, their domains, and their owners.",
		Capabilities: []Capability{ // C153
			{Key: "tenancy:tenant:view", Name: "View tenants", Description: "List and see every tenant."},
			{Key: "tenancy:tenant:manage", Name: "Manage tenants",
				Description: "Create, change, suspend, reactivate, and archive tenants; includes viewing them."},
		}}
	ControlCentre = App{Key: "control-centre", Name: "Control Centre", Kind: Workspace, IsDefault: true, IsAvailable: true,
		Description: "A tenant's own administration: members, roles, and audit."}
	Calendar = App{Key: "calendar", Name: "Calendar", Kind: Workspace, IsDefault: true, IsAvailable: true,
		Description: "A tenant's shared calendar: holidays, events, and each member's schedule."}
)

// The business apps coming soon (the user's choice, 2026-10-17, C225): listed in the
// catalogue so the operator sees what is on the way, but not available, so no tenant can
// have them turned on yet. Each moves to its module, and becomes available, when it ships.
var (
	Health = App{Key: "health", Name: "Health Management", Kind: Workspace,
		Description: "Patients, appointments, and clinical records for a clinic or hospital."}
	Inventory = App{Key: "inventory", Name: "Inventory Management", Kind: Workspace,
		Description: "Stock, purchase orders, and transfers across sites."}
	Tasks = App{Key: "tasks", Name: "Tasks", Kind: Workspace,
		Description: "Tasks and checklists, assigned and tracked."}
	Assets = App{Key: "assets", Name: "Asset Management", Kind: Workspace,
		Description: "Equipment and property: where it is, who has it, and its upkeep."}
	Notes = App{Key: "notes", Name: "Notes", Kind: Workspace,
		Description: "Shared and personal notes."}
	Directory = App{Key: "directory", Name: "Directory", Kind: Workspace,
		Description: "People, units, and the organisation's structure."}
	Analytics = App{Key: "analytics", Name: "Analytics", Kind: Workspace,
		Description: "Reports and dashboards across the tenant's apps."}
)
