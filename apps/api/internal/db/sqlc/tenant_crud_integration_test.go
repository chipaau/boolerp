//go:build integration

package sqlc_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/Bool-Maldives/erp/internal/db/sqlc"
)

func createTestTenantForCRUD(t *testing.T, ctx context.Context, q *sqlc.Queries, slugPrefix string) sqlc.Tenant {
	t.Helper()
	treeKey, err := q.NextTenantTreeKey(ctx)
	if err != nil {
		t.Fatalf("NextTenantTreeKey: %v", err)
	}
	tenant, err := q.CreateTenant(ctx, sqlc.CreateTenantParams{
		Slug: fmt.Sprintf("%s-%d", slugPrefix, treeKey), Code: fmt.Sprintf("C%d", treeKey), Name: "CRUD Test Tenant",
		TreeKey: treeKey, Column7: fmt.Sprintf("%d", treeKey), Country: "MV", Status: "active",
	})
	if err != nil {
		t.Fatalf("CreateTenant: %v", err)
	}
	return tenant
}

func TestListAndGetTenant(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	tenant := createTestTenantForCRUD(t, ctx, q, "list-test")

	got, err := q.GetTenantByID(ctx, tenant.ID)
	if err != nil {
		t.Fatalf("GetTenantByID: %v", err)
	}
	if got.Slug != tenant.Slug {
		t.Fatalf("want slug %q, got %q", tenant.Slug, got.Slug)
	}

	all, err := q.ListTenants(ctx)
	if err != nil {
		t.Fatalf("ListTenants: %v", err)
	}
	found := false
	for _, tn := range all {
		if tn.ID == tenant.ID {
			found = true
		}
	}
	if !found {
		t.Fatal("ListTenants: created tenant not present")
	}
}

func TestSetTenantStatus_SuspendAndReactivate(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	tenant := createTestTenantForCRUD(t, ctx, q, "suspend-test")

	suspended, err := q.SetTenantStatus(ctx, sqlc.SetTenantStatusParams{ID: tenant.ID, Status: "suspended"})
	if err != nil {
		t.Fatalf("SetTenantStatus(suspended): %v", err)
	}
	if suspended.Status != "suspended" {
		t.Fatalf("want status suspended, got %q", suspended.Status)
	}
	if suspended.ActiveTo.Valid {
		t.Fatalf("suspend must not set active_to (reversible) — got %v", suspended.ActiveTo)
	}

	reactivated, err := q.SetTenantStatus(ctx, sqlc.SetTenantStatusParams{ID: tenant.ID, Status: "active"})
	if err != nil {
		t.Fatalf("SetTenantStatus(active): %v", err)
	}
	if reactivated.Status != "active" {
		t.Fatalf("want status active, got %q", reactivated.Status)
	}
}

func TestArchiveTenant_SetsActiveToAndIsIrreversibleInThisPass(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	tenant := createTestTenantForCRUD(t, ctx, q, "archive-test")

	archived, err := q.ArchiveTenant(ctx, tenant.ID)
	if err != nil {
		t.Fatalf("ArchiveTenant: %v", err)
	}
	if archived.Status != "archived" {
		t.Fatalf("want status archived, got %q", archived.Status)
	}
	if !archived.ActiveTo.Valid {
		t.Fatal("archive must set active_to (marks the tenant as ceased)")
	}
}
