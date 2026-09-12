package tenancy

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// RLSScopedTables lists BUSINESS tables that must carry FORCE ROW LEVEL SECURITY + an isolation
// policy — never platform/control-plane tables (tenants, tenant_users, roles, ...), which are
// deliberately cross-tenant by nature and outside the RLS regime (see tenancy.md). Empty today:
// Phase 1 ships no business/tenant-scoped tables yet. Grows with the first business module.
var RLSScopedTables = []string{}

// queryRower is satisfied by both *pgxpool.Pool (startup) and pgx.Tx (tests).
type queryRower interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// CheckRLSCoverage fails if any named table lacks FORCE ROW LEVEL SECURITY or at least one policy —
// the guard UC-FND-06 requires. Run at startup (refuse to serve on failure) and in CI.
func CheckRLSCoverage(ctx context.Context, db queryRower, tables []string) error {
	for _, t := range tables {
		var forced bool
		if err := db.QueryRow(ctx, `SELECT relforcerowsecurity FROM pg_class WHERE relname = $1`, t).Scan(&forced); err != nil {
			return fmt.Errorf("tenancy: rls guard: table %q: %w", t, err)
		}
		if !forced {
			return fmt.Errorf("tenancy: rls guard: table %q does not have FORCE ROW LEVEL SECURITY", t)
		}

		var policyCount int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM pg_policies WHERE tablename = $1`, t).Scan(&policyCount); err != nil {
			return fmt.Errorf("tenancy: rls guard: table %q: count policies: %w", t, err)
		}
		if policyCount == 0 {
			return fmt.Errorf("tenancy: rls guard: table %q has no RLS policy", t)
		}
	}
	return nil
}
