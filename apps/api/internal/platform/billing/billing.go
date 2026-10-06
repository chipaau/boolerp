// Package billing is the billing platform module (C171): what each tenant has agreed to
// pay, and later its invoices, credits, and the payments it submits with their receipts.
// Bool's operators manage it from the admin console; a tenant reads its own billing in
// Control Centre. Its tables are in migrations (C95, C122).
package billing

import (
	"embed"
	"io/fs"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Migrations returns the module's tables, applied by cmd/migrate as "billing", after
// tenancy (agreements belong to tenants).
func Migrations() fs.FS {
	sub, err := fs.Sub(migrations, "migrations")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}
