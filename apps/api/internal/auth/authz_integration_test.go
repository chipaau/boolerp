//go:build integration

package auth_test

import (
	"context"
	"crypto/rand"
	"fmt"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/boolmv/goerp/internal/auth"
	"github.com/boolmv/goerp/internal/db/sqlc"
	"github.com/boolmv/goerp/internal/dbtest"
)

var env *dbtest.Env

func TestMain(m *testing.M) {
	ctx := context.Background()
	e, err := dbtest.Start(ctx)
	if err != nil {
		fmt.Fprintln(os.Stderr, "dbtest start:", err)
		os.Exit(1)
	}
	env = e
	code := m.Run()
	env.Close(ctx)
	os.Exit(code)
}

func newTestUUID(t *testing.T) pgtype.UUID {
	t.Helper()
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		t.Fatalf("rand: %v", err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return pgtype.UUID{Bytes: b, Valid: true}
}

func TestBuildOperatorPrincipal_InternalMemberWithCapabilities(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	treeKey, err := q.NextTenantTreeKey(ctx)
	if err != nil {
		t.Fatalf("NextTenantTreeKey: %v", err)
	}
	internalTenant, err := q.CreateTenant(ctx, sqlc.CreateTenantParams{
		Slug: fmt.Sprintf("test-internal-%d", treeKey), Code: fmt.Sprintf("TI%d", treeKey), Name: "Test Internal",
		TreeKey: treeKey, Column7: fmt.Sprintf("%d", treeKey), Country: "MV", Status: "active", IsInternal: true,
	})
	if err != nil {
		t.Fatalf("CreateTenant(internal): %v", err)
	}

	app, err := q.GetAppByCode(ctx, "control-centre")
	if err != nil {
		t.Fatalf("GetAppByCode: %v", err)
	}
	role, err := q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, TenantID: internalTenant.ID, Code: "test-operator", Name: "Test Operator"})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	if _, err := q.CreateRoleCapability(ctx, sqlc.CreateRoleCapabilityParams{RoleID: role.ID, Capability: "platform:tenants:provision"}); err != nil {
		t.Fatalf("CreateRoleCapability: %v", err)
	}

	userID := newTestUUID(t)
	if _, err := q.CreateUser(ctx, sqlc.CreateUserParams{ID: userID, Email: "operator@example.test", Name: "Operator"}); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if _, err := q.CreateOwnerTenantUser(ctx, sqlc.CreateOwnerTenantUserParams{UserID: userID, TenantID: internalTenant.ID}); err != nil {
		t.Fatalf("CreateOwnerTenantUser: %v", err)
	}
	if _, err := q.CreateUserRole(ctx, sqlc.CreateUserRoleParams{TenantID: internalTenant.ID, UserID: userID, RoleID: role.ID}); err != nil {
		t.Fatalf("CreateUserRole: %v", err)
	}

	// BuildOperatorPrincipal reads through the tx (same connection/transaction), proving it against
	// the fixture just built without needing a separate commit.
	p, err := auth.BuildOperatorPrincipal(ctx, tx, userID)
	if err != nil {
		t.Fatalf("BuildOperatorPrincipal: %v", err)
	}
	if !p.IsInternalMember {
		t.Fatal("want IsInternalMember true for a member of the internal tenant")
	}
	found := false
	for _, c := range p.Capabilities {
		if c == "platform:tenants:provision" {
			found = true
		}
	}
	if !found {
		t.Fatalf("want platform:tenants:provision in capabilities, got %v", p.Capabilities)
	}
}

func TestBuildOperatorPrincipal_NonMemberHasNoCapabilities(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	userID := newTestUUID(t)
	if _, err := q.CreateUser(ctx, sqlc.CreateUserParams{ID: userID, Email: "outsider@example.test", Name: "Outsider"}); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	p, err := auth.BuildOperatorPrincipal(ctx, tx, userID)
	if err != nil {
		t.Fatalf("BuildOperatorPrincipal: %v", err)
	}
	if p.IsInternalMember {
		t.Fatal("want IsInternalMember false for a non-member")
	}
	if len(p.Capabilities) != 0 {
		t.Fatalf("want no capabilities, got %v", p.Capabilities)
	}
}
