// Package audit is the audit platform module (C146-C148, C164): the append-only
// audit_log, the capture trigger every table enables in its migration, and the
// monthly partitions. Who acted, through which operation, comes from the actor
// context (kit/actor), which every entry point applies to its transactions.
package audit

import (
	"embed"
	"io/fs"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/embedded"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Migrations returns the module's tables, applied by cmd/migrate as "audit", before
// every other module, so their migrations can call audit.enable.
func Migrations() fs.FS {
	return embedded.Dir(migrations, "migrations")
}
