// Package tenancy is the tenancy module (C115): the registry of tenants, the
// customer organisations that are each one data boundary, and the single
// operator tenant. Its tables are in migrations (C95, C122) and its Cerbos policies
// in policies (C151); its use cases come with the operations that need them.
package tenancy

import (
	"embed"
	"io/fs"
)

//go:embed migrations/*.sql
var migrations embed.FS

//go:embed all:policies
var policies embed.FS

// Migrations returns the module's tables, applied by cmd/migrate as "tenancy".
func Migrations() fs.FS {
	sub, err := fs.Sub(migrations, "migrations")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}

// Policies returns the module's Cerbos policies, their tests, and their schemas
// (C151), assembled as "tenancy".
func Policies() fs.FS {
	sub, err := fs.Sub(policies, "policies")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}
