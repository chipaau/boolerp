// Package tenancy is the tenancy module (C115): the registry of tenants, the
// customer organisations that are each one data boundary, and the single
// operator tenant. Its tables are in migrations (C95, C122); its use cases come
// with the operations that need them.
package tenancy

import (
	"embed"
	"io/fs"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Migrations returns the module's tables, applied by cmd/migrate as "tenancy".
func Migrations() fs.FS {
	sub, err := fs.Sub(migrations, "migrations")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}
