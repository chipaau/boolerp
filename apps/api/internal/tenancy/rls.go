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

// Querier is the read-only database handle CheckRLSCoverage needs, satisfied by both *pgxpool.Pool
// (startup) and pgx.Tx (tests). Exported alongside the function that takes it, so callers can name
// the type rather than relying on structural satisfaction alone.
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// CheckRLSCoverage fails if any non-exempt table lacks FORCE ROW LEVEL SECURITY or at least one
// policy — the guard UC-FND-06 requires. Discovers every table in the schema itself instead of
// requiring a maintained allowlist: the default is "this table needs RLS", not "needs RLS if
// someone remembered to list it" — platformTables is the one place a table opts OUT, and given most
// tables in this system are tenant-owned business data (not platform/control-plane), that's meant
// to stay a short, deliberately-reviewed list. Run at startup (refuse to serve on failure) and in CI.
func CheckRLSCoverage(ctx context.Context, db Querier) error {
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

		// A policy must not only exist but actually scope by tenant_id. "Has a policy" was the whole
		// check, so a policy that never mentions tenant_id — USING (true), or one written against some
		// other column — satisfied the guard while isolating nothing.
		var policiesMentioningTenant int
		if err := db.QueryRow(ctx, `
			SELECT count(*) FROM pg_policies
			WHERE tablename = $1
			  AND (coalesce(qual, '') LIKE '%tenant_id%' OR coalesce(with_check, '') LIKE '%tenant_id%')`,
			t).Scan(&policiesMentioningTenant); err != nil {
			return fmt.Errorf("tenancy: rls guard: table %q: count policies: %w", t, err)
		}
		if policiesMentioningTenant == 0 {
			return fmt.Errorf("tenancy: rls guard: table %q has no RLS policy that scopes by tenant_id", t)
		}

		// tenant_id must default from the session, so a query never has to name it and therefore can't
		// name the wrong one (.claude/rules/tenancy.md). UC-FND-06 always said the guard checks this;
		// it didn't, and three tables had been missing the default since they were created.
		var hasTenantDefault bool
		if err := db.QueryRow(ctx, `
			SELECT coalesce(column_default, '') LIKE '%app.current_tenant%'
			FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'tenant_id'`,
			t).Scan(&hasTenantDefault); err != nil {
			return fmt.Errorf("tenancy: rls guard: table %q: read tenant_id default: %w", t, err)
		}
		if !hasTenantDefault {
			return fmt.Errorf(
				"tenancy: rls guard: table %q has no DEFAULT current_setting('app.current_tenant') on tenant_id", t)
		}
	}
	return nil
}
