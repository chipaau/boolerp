// Package reference owns the platform's shared reference data (C122): so far the
// countries Bool is offered in. Platform capabilities (identity, tenancy) and
// business modules (HRMS) reference it instead of keeping their own lists. Its
// tables are in migrations (C48, C95).
package reference

import (
	"embed"
	"io/fs"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Migrations returns the package's tables, applied by cmd/migrate as "reference".
func Migrations() fs.FS {
	sub, err := fs.Sub(migrations, "migrations")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}
