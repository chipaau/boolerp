// Package store reads the reference lists from PostgreSQL. Every user may read them
// (row-level security lets everyone read every row), so the queries run on the pool,
// outside a tenant's transaction.
package store

import "github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"

// Querier is what the store needs: the pool, or a transaction in tests (C79).
type Querier = postgres.Querier

// current keeps the rows in use now: started, and not retired or retired only in the
// future (the database's is_current).
func current(alias string) string {
	return "is_current(" + alias + ".active_from, " + alias + ".active_to)"
}
