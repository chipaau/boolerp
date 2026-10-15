// Package seeds holds the authorization module's seed files (C135): the capabilities
// each app declares (C168), Bool's global roles (C167), and the team's roles in the
// operator tenant, mirrored from code on every cmd/deploy and cmd/seed. The app catalogue
// itself is tenancy's (C206).
package seeds

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// DB is what the seeders need: a pool, or a transaction in tests (C79).
type DB interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}
