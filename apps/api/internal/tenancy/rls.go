package tenancy

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// platformTables are deliberately exempt from the tenant RLS regime:
//   - no tenant_id column at all — structurally can't be tenant-scoped (reference/classification
//     lookups, global identity, the tenant/app registries themselves).
//   - has tenant_id, but deliberately cross-tenant control-plane data (tenant_users, per
//     .claude/rules/tenancy.md), or mixes global rows (tenant_id IS NULL) with tenant-owned ones —
//     roles: NULL = a shared app-wide template, set = one tenant's own custom role
//     (00008_authorization.sql) — a blanket tenant_id = current_tenant policy would hide the global
//     templates from everyone, so roles stays outside RLS; visibility is explicit query logic
//     instead (see how GetInstitutionTypeIDByCode handles the same global-or-scoped shape).
//   - has tenant_id, genuinely tenant-owned, exempted only PRAGMATICALLY: tenant_apps/
//     tenant_settings/user_apps have no RLS and no application code queries them yet (dead schema
//     from earlier module-activation work). Add real RLS and drop them from this list the moment a
//     real feature builds on top of one — don't let this exemption become permanent by default.
var platformTables = map[string]bool{
	"currencies": true, "countries": true, "geography_levels": true, "geographies": true,
	"party_types": true, "institution_types": true,
	"users": true, "user_efaas_identities": true,
	"tenants": true, "apps": true,
	"role_capabilities": true,
	"tenant_users":      true, "roles": true,
	"tenant_apps": true, "tenant_settings": true, "user_apps": true,
}

// queryier is satisfied by both *pgxpool.Pool (startup) and pgx.Tx (tests).
type queryier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// CheckRLSCoverage fails if any non-exempt table lacks FORCE ROW LEVEL SECURITY or at least one
// policy — the guard UC-FND-06 requires. Discovers every table in the schema itself instead of
// requiring a maintained allowlist: the default is "this table needs RLS", not "needs RLS if
// someone remembered to list it" — platformTables is the one place a table opts OUT, and given most
// tables in this system are tenant-owned business data (not platform/control-plane), that's meant
// to stay a short, deliberately-reviewed list. Run at startup (refuse to serve on failure) and in CI.
func CheckRLSCoverage(ctx context.Context, db queryier) error {
	rows, err := db.Query(ctx, `
		SELECT c.relname FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname NOT LIKE 'goose%'
		ORDER BY c.relname`)
	if err != nil {
		return fmt.Errorf("tenancy: rls guard: list tables: %w", err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return fmt.Errorf("tenancy: rls guard: scan table name: %w", err)
		}
		if !platformTables[t] {
			tables = append(tables, t)
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("tenancy: rls guard: %w", err)
	}

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
