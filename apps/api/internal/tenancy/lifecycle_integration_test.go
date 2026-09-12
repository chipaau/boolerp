//go:build integration

package tenancy_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/boolmv/erp/internal/db/sqlc"
	"github.com/boolmv/erp/internal/tenancy"
)

// createLifecycleTestTenant commits a tenant via env.Pool (owner role) — tenancy.SuspendTenant etc.
// run their DB work as the real API pool passed to them, which in production is the goerp_app pool;
// here we still pass env.Pool since that's what production wiring would hand these functions
// (cmd/api's pgxpool connects as goerp_app already — see config.go's default DSN), so this
// exercises the exact same non-superuser path the audit RLS tests needed AppTx for.
func createLifecycleTestTenant(t *testing.T, slug string) sqlc.Tenant {
	t.Helper()
	ctx := context.Background()
	q := sqlc.New(env.AppPool)
	treeKey, err := q.NextTenantTreeKey(ctx)
	if err != nil {
		t.Fatalf("NextTenantTreeKey: %v", err)
	}
	tenant, err := q.CreateTenant(ctx, sqlc.CreateTenantParams{
		Slug: slug, Code: fmt.Sprintf("LC%d", treeKey), Name: "Lifecycle Test Tenant",
		TreeKey: treeKey, Column7: fmt.Sprintf("%d", treeKey), Country: "MV", Status: "active",
	})
	if err != nil {
		t.Fatalf("CreateTenant: %v", err)
	}
	return tenant
}

func readAuditEntries(t *testing.T, tenantID, entityID pgtype.UUID, action string) []sqlc.AuditLog {
	t.Helper()
	ctx := context.Background()
	tx, err := env.AppPool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx,
		`SELECT set_config('app.current_tenant', $1, true), set_config('app.visible_tenants', $2, true)`,
		uuidToString(tenantID), "{"+uuidToString(tenantID)+"}",
	); err != nil {
		t.Fatalf("set tenant config: %v", err)
	}

	rows, err := tx.Query(ctx, `SELECT id, tenant_id, actor_user_id, acting_as_user_id, entity_type, entity_id, action, payload, request_id, ip, occurred_at
		FROM audit_log WHERE entity_id = $1 AND action = $2 ORDER BY occurred_at`, entityID, action)
	if err != nil {
		t.Fatalf("query audit_log: %v", err)
	}
	defer rows.Close()

	var out []sqlc.AuditLog
	for rows.Next() {
		var a sqlc.AuditLog
		if err := rows.Scan(&a.ID, &a.TenantID, &a.ActorUserID, &a.ActingAsUserID, &a.EntityType, &a.EntityID, &a.Action, &a.Payload, &a.RequestID, &a.Ip, &a.OccurredAt); err != nil {
			t.Fatalf("scan: %v", err)
		}
		out = append(out, a)
	}
	return out
}

func TestSuspendReactivateArchive_TransitionAndAudit(t *testing.T) {
	tenant := createLifecycleTestTenant(t, "test-lifecycle-suspend")
	actor := newTestUUID(t)
	ctx := context.Background()
	if _, err := sqlc.New(env.AppPool).CreateUser(ctx, sqlc.CreateUserParams{ID: actor, Email: "actor@example.test", Name: "Actor"}); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	suspended, err := tenancy.SuspendTenant(ctx, env.AppPool, tenant.ID, actor)
	if err != nil {
		t.Fatalf("SuspendTenant: %v", err)
	}
	if suspended.Status != "suspended" {
		t.Fatalf("want status suspended, got %q", suspended.Status)
	}
	entries := readAuditEntries(t, tenant.ID, tenant.ID, "suspend")
	if len(entries) != 1 {
		t.Fatalf("want 1 suspend audit entry, got %d", len(entries))
	}
	if entries[0].ActorUserID != actor {
		t.Fatalf("want actor %v recorded, got %v", actor, entries[0].ActorUserID)
	}

	reactivated, err := tenancy.ReactivateTenant(ctx, env.AppPool, tenant.ID, actor)
	if err != nil {
		t.Fatalf("ReactivateTenant: %v", err)
	}
	if reactivated.Status != "active" {
		t.Fatalf("want status active, got %q", reactivated.Status)
	}
	if len(readAuditEntries(t, tenant.ID, tenant.ID, "reactivate")) != 1 {
		t.Fatal("want 1 reactivate audit entry")
	}

	archived, err := tenancy.ArchiveTenant(ctx, env.AppPool, tenant.ID, actor)
	if err != nil {
		t.Fatalf("ArchiveTenant: %v", err)
	}
	if archived.Status != "archived" || !archived.ActiveTo.Valid {
		t.Fatalf("want archived + active_to set, got status=%q active_to.valid=%v", archived.Status, archived.ActiveTo.Valid)
	}
	if len(readAuditEntries(t, tenant.ID, tenant.ID, "archive")) != 1 {
		t.Fatal("want 1 archive audit entry")
	}
}
