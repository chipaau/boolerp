//go:build integration

package sqlc_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/boolmv/erp/internal/db/sqlc"
)

// pgInsufficientPrivilege is what Postgres raises when a row fails a policy's WITH CHECK.
const pgInsufficientPrivilege = "42501"

// The three authorization tables carry real RLS (00010_authorization_rls.sql) and, until this test,
// nothing proved it. Every other test in this package runs through env.Tx — the migration owner,
// which the Postgres image also makes a superuser, and a superuser bypasses RLS unconditionally
// regardless of FORCE ROW LEVEL SECURITY. So the policies could have been wrong, or absent, and the
// suite would have stayed green.
//
// user_roles is the table that decides what a principal may do (auth.BuildOperatorPrincipal reads it
// to assemble capabilities), so a hole here is silent cross-tenant privilege escalation rather than
// mere data disclosure.
//
// Each table is checked for three things, because any one alone can pass while isolation is broken:
//
//  1. a row written for tenant A is INVISIBLE under tenant B  (the USING clause)
//  2. a row for tenant A cannot be WRITTEN while acting as B  (the WITH CHECK clause) — these tables
//     have no tenant_id column default, so the application supplies it and a bug supplying the wrong
//     one is the realistic failure this guards
//  3. the row IS visible under its own tenant                 (positive control — without it a policy
//     of USING (false) would hide everything and still "pass" isolation)
func TestAuthorizationTables_TenantIsolation(t *testing.T) {
	ctx := context.Background()

	for _, tc := range []struct {
		table string
		// insert returns the statement and args writing one row for the given tenant, with a caller-
		// chosen primary key so the row can be looked up by id rather than by tenant — proving RLS
		// hides it, not a WHERE clause.
		insert func(rowID, tenantID, userID, roleID pgtype.UUID) (string, []any)
	}{
		{
			table: "user_roles",
			insert: func(rowID, tenantID, userID, roleID pgtype.UUID) (string, []any) {
				return `INSERT INTO user_roles (id, tenant_id, user_id, role_id) VALUES ($1,$2,$3,$4)`,
					[]any{rowID, tenantID, userID, roleID}
			},
		},
		{
			table: "role_requests",
			insert: func(rowID, tenantID, userID, roleID pgtype.UUID) (string, []any) {
				return `INSERT INTO role_requests (id, tenant_id, target_user_id, role_id, requested_by, reason)
				        VALUES ($1,$2,$3,$4,$3,'isolation test')`,
					[]any{rowID, tenantID, userID, roleID}
			},
		},
		{
			table: "support_access_grants",
			insert: func(rowID, tenantID, userID, _ pgtype.UUID) (string, []any) {
				return `INSERT INTO support_access_grants (id, tenant_id, target_user_id, reason, proposed_by)
				        VALUES ($1,$2,$3,'isolation test',$3)`,
					[]any{rowID, tenantID, userID}
			},
		},
	} {
		t.Run(tc.table, func(t *testing.T) {
			// AppTx, not Tx: erp_app is the non-superuser role the API actually runs as, and the only
			// one RLS applies to.
			tx := env.AppTx(t)
			q := sqlc.New(tx)

			tenantA := createTestTenant(t, ctx, q)
			tenantB := createTestTenant(t, ctx, q)
			user := createTestUser(t, ctx, q, fmt.Sprintf("rls-%s@example.test", tc.table))
			role := createGlobalTestRole(t, ctx, q, "rls-"+tc.table)
			rowID := newTestUUID(t)

			// (1) Write A's row while acting as A.
			setTenantConfig(t, ctx, tx, tenantA)
			stmt, args := tc.insert(rowID, tenantA, user, role)
			if _, err := tx.Exec(ctx, stmt, args...); err != nil {
				t.Fatalf("insert for tenant A: %v", err)
			}

			// (3) Positive control — A can see its own row.
			if got := countByID(t, ctx, tx, tc.table, rowID); got != 1 {
				t.Fatalf("tenant A cannot see its OWN %s row (count=%d) — the policy hides everything", tc.table, got)
			}

			// (2) Switch to B: A's row must be invisible.
			setTenantConfig(t, ctx, tx, tenantB)
			if got := countByID(t, ctx, tx, tc.table, rowID); got != 0 {
				t.Fatalf("tenant B can see tenant A's %s row (count=%d) — cross-tenant leak", tc.table, got)
			}

			// (2b) And B must not be able to write a row belonging to A.
			smuggledID := newTestUUID(t)
			stmt, args = tc.insert(smuggledID, tenantA, user, role)
			_, err := tx.Exec(ctx, stmt, args...)
			if err == nil {
				t.Fatalf("acting as tenant B, wrote a %s row owned by tenant A — WITH CHECK is not enforced", tc.table)
			}
			if code := pgErrorCode(err); code != pgInsufficientPrivilege {
				t.Fatalf("want the write refused by the row policy (%s), got %s: %v",
					pgInsufficientPrivilege, code, err)
			}
		})
	}
}

func countByID(t *testing.T, ctx context.Context, tx interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, table string, rowID pgtype.UUID) int {
	t.Helper()
	var n int
	// table is a constant from this test's own table-driven cases, never caller input.
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM `+table+` WHERE id = $1`, rowID).Scan(&n); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	return n
}

// createGlobalTestRole makes an app-wide role template (roles.tenant_id NULL), so the same role can
// be referenced by both tenants. roles itself is deliberately outside the RLS regime precisely
// because of this global/shared case — see internal/tenancy/rls.go.
func createGlobalTestRole(t *testing.T, ctx context.Context, q *sqlc.Queries, code string) pgtype.UUID {
	t.Helper()
	app, err := q.GetAppByCode(ctx, "control-centre")
	if err != nil {
		t.Fatalf("GetAppByCode: %v", err)
	}
	role, err := q.CreateRole(ctx, sqlc.CreateRoleParams{
		AppID: app.ID, Code: code, Name: "RLS Test Role",
	})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	return role.ID
}
