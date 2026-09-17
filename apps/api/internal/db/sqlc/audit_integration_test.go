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

// setTenantConfig mirrors rls.SetCurrentTenant — this package's tests exercise the raw schema/RLS
// directly rather than through the rls/tenancy packages.
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

// These audit_log tests use env.AppTx (the erp_app role, same as the real API at runtime), not
// env.Tx (erp, the migration owner — which the Postgres Docker image also makes a superuser).
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

// attempt runs one statement inside a savepoint and returns its error, rolling the savepoint back so
// the outer transaction stays usable. Without this, the first refusal aborts the transaction and
// every later statement fails with 25P02 (transaction aborted) — which is still an error, so a test
// asserting only "err != nil" would pass without ever exercising the statements after the first.
func attempt(t *testing.T, ctx context.Context, tx pgx.Tx, sql string, args ...any) error {
	t.Helper()
	sp, err := tx.Begin(ctx) // pgx implements a nested Begin as a SAVEPOINT
	if err != nil {
		t.Fatalf("savepoint: %v", err)
	}
	defer func() { _ = sp.Rollback(ctx) }()
	_, err = sp.Exec(ctx, sql, args...)
	return err
}

// Append-only rests on two independent layers, and this checks each one on its own, because either
// alone can be lost without the other noticing: a REVOKE is invisible to a superuser, and a trigger
// can be dropped while the grants stay put.
func TestAuditLog_AppendOnly(t *testing.T) {
	ctx := context.Background()

	t.Run("the application role holds no privilege to rewrite history", func(t *testing.T) {
		tx := env.AppTx(t) // erp_app — the role the API actually runs as
		q := sqlc.New(tx)
		tenant := createTestTenant(t, ctx, q)
		setTenantConfig(t, ctx, tx, tenant)

		row, err := q.CreateAuditLogEntry(ctx, sqlc.CreateAuditLogEntryParams{
			EntityType: "tenant", EntityID: tenant, Action: "create", Payload: []byte(`{"after":{"status":"active"}}`),
		})
		if err != nil {
			t.Fatalf("CreateAuditLogEntry: %v", err)
		}

		err = attempt(t, ctx, tx, `UPDATE audit_log SET action = 'tampered' WHERE id = $1`, row.ID)
		if code := pgErrorCode(err); code != pgInsufficientPrivilege {
			t.Fatalf("want UPDATE refused for lack of privilege (%s), got %s: %v", pgInsufficientPrivilege, code, err)
		}
		err = attempt(t, ctx, tx, `DELETE FROM audit_log WHERE id = $1`, row.ID)
		if code := pgErrorCode(err); code != pgInsufficientPrivilege {
			t.Fatalf("want DELETE refused for lack of privilege (%s), got %s: %v", pgInsufficientPrivilege, code, err)
		}
	})

	// The owner bypasses grants entirely, so what stops it is the trigger — which is the layer that
	// still holds if the privileges are ever widened again.
	t.Run("the trigger refuses even the table owner", func(t *testing.T) {
		tx := env.Tx(t)
		q := sqlc.New(tx)
		tenant := createTestTenant(t, ctx, q)
		setTenantConfig(t, ctx, tx, tenant)

		row, err := q.CreateAuditLogEntry(ctx, sqlc.CreateAuditLogEntryParams{
			EntityType: "tenant", EntityID: tenant, Action: "create", Payload: []byte(`{}`),
		})
		if err != nil {
			t.Fatalf("CreateAuditLogEntry: %v", err)
		}

		if err := attempt(t, ctx, tx, `UPDATE audit_log SET action = 'tampered' WHERE id = $1`, row.ID); err == nil {
			t.Fatal("the owner updated an audit_log row — the append-only trigger is not firing")
		}
		if err := attempt(t, ctx, tx, `DELETE FROM audit_log WHERE id = $1`, row.ID); err == nil {
			t.Fatal("the owner deleted an audit_log row — the append-only trigger is not firing")
		}
		// TRUNCATE empties the table without touching a row, so a row-level trigger never sees it.
		if err := attempt(t, ctx, tx, `TRUNCATE audit_log`); err == nil {
			t.Fatal("the owner truncated audit_log — the statement-level trigger is not firing")
		}
	})
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
