//go:build integration

package sqlc_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/boolmv/erp/internal/db/sqlc"
)

func uuidStr(id pgtype.UUID) string { return uuid.UUID(id.Bytes).String() }

// setTenantConfig mirrors tenancy.setCurrentTenant (unexported, different package) — this package's
// tests exercise the raw schema/RLS directly rather than through the tenancy package.
func setTenantConfig(t *testing.T, ctx context.Context, tx pgx.Tx, id pgtype.UUID) {
	t.Helper()
	s := uuidStr(id)
	if _, err := tx.Exec(ctx,
		`SELECT set_config('app.current_tenant', $1, true), set_config('app.visible_tenants', $2, true)`,
		s, "{"+s+"}",
	); err != nil {
		t.Fatalf("set tenant config: %v", err)
	}
}

// These audit_log tests use env.AppTx (the goerp_app role, same as the real API at runtime), not
// env.Tx (goerp, the migration owner — which the Postgres Docker image also makes a superuser).
// A superuser bypasses Row-Level Security unconditionally regardless of FORCE ROW LEVEL SECURITY,
// so testing RLS enforcement through the owner connection would silently prove nothing.

func TestAuditLog_RequiresCurrentTenantToInsert(t *testing.T) {
	ctx := context.Background()
	tx := env.AppTx(t)
	q := sqlc.New(tx)

	// No setTenantConfig call — app.current_tenant was never set in this fresh transaction.
	_, err := q.CreateAuditLogEntry(ctx, sqlc.CreateAuditLogEntryParams{
		EntityType: "tenant", EntityID: newTestUUID(t), Action: "create", Payload: []byte(`{}`),
	})
	if err == nil {
		t.Fatal("want an error inserting into audit_log with no current tenant set")
	}
}

func TestAuditLog_AppendOnly(t *testing.T) {
	ctx := context.Background()
	tx := env.AppTx(t)
	q := sqlc.New(tx)
	tenant := createTestTenant(t, ctx, q)
	setTenantConfig(t, ctx, tx, tenant)

	row, err := q.CreateAuditLogEntry(ctx, sqlc.CreateAuditLogEntryParams{
		EntityType: "tenant", EntityID: tenant, Action: "create", Payload: []byte(`{"after":{"status":"active"}}`),
	})
	if err != nil {
		t.Fatalf("CreateAuditLogEntry: %v", err)
	}

	if _, err := tx.Exec(ctx, `UPDATE audit_log SET action = 'tampered' WHERE id = $1`, row.ID); err == nil {
		t.Fatal("want an error updating an audit_log row — it must be append-only")
	}
	if _, err := tx.Exec(ctx, `DELETE FROM audit_log WHERE id = $1`, row.ID); err == nil {
		t.Fatal("want an error deleting an audit_log row — it must be append-only")
	}
}

func TestAuditLog_TenantIsolation(t *testing.T) {
	ctx := context.Background()
	tx := env.AppTx(t)
	q := sqlc.New(tx)

	tenantA := createTestTenant(t, ctx, q)
	tenantB := createTestTenant(t, ctx, q)

	setTenantConfig(t, ctx, tx, tenantA)
	if _, err := q.CreateAuditLogEntry(ctx, sqlc.CreateAuditLogEntryParams{
		EntityType: "tenant", EntityID: tenantA, Action: "create", Payload: []byte(`{}`),
	}); err != nil {
		t.Fatalf("insert for tenant A: %v", err)
	}

	// Switch context to B and confirm A's row is invisible under B's visible-tenants set.
	setTenantConfig(t, ctx, tx, tenantB)
	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM audit_log WHERE entity_id = $1`, tenantA).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 0 {
		t.Fatalf("want tenant A's audit row invisible under tenant B's context, got count=%d", count)
	}

	if _, err := q.CreateAuditLogEntry(ctx, sqlc.CreateAuditLogEntryParams{
		EntityType: "tenant", EntityID: tenantB, Action: "create", Payload: []byte(`{}`),
	}); err != nil {
		t.Fatalf("insert for tenant B: %v", err)
	}
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM audit_log WHERE entity_id = $1`, tenantB).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Fatalf("want tenant B's own row visible under its own context, got count=%d", count)
	}
}
