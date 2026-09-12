//go:build integration

package tenancy_test

import (
	"context"
	"crypto/rand"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/boolmv/erp/internal/auth"
	"github.com/boolmv/erp/internal/db/sqlc"
	"github.com/boolmv/erp/internal/dbtest"
	"github.com/boolmv/erp/internal/tenancy"
)

func uuidToString(id pgtype.UUID) string { return uuid.UUID(id.Bytes).String() }

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

var errRollbackOnly = fmt.Errorf("rollback: read-only check")

func TestWithTenant_SetsCurrentTenantAndVisibleTenants(t *testing.T) {
	ctx := context.Background()
	tenantID := newTestUUID(t)

	var current, visible string
	err := tenancy.WithTenant(ctx, env.Pool, tenantID, func(ctx context.Context, tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, `SELECT current_setting('app.current_tenant'), current_setting('app.visible_tenants')`).Scan(&current, &visible); err != nil {
			return err
		}
		return errRollbackOnly // this test only reads; force rollback rather than committing a no-op
	})
	if err != errRollbackOnly {
		t.Fatalf("WithTenant: unexpected error %v", err)
	}
	if current == "" || visible == "" {
		t.Fatalf("expected app.current_tenant/app.visible_tenants to be set, got %q / %q", current, visible)
	}
	if visible != "{"+current+"}" {
		t.Fatalf("app.visible_tenants: want {%s}, got %s", current, visible)
	}
}

func TestCheckRLSCoverage_CatchesMissingRLSAndPassesConfigured(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)

	if _, err := tx.Exec(ctx, `CREATE TABLE test_unprotected (id uuid PRIMARY KEY, tenant_id uuid NOT NULL)`); err != nil {
		t.Fatalf("create unprotected table: %v", err)
	}
	if err := tenancy.CheckRLSCoverage(ctx, tx, []string{"test_unprotected"}); err == nil {
		t.Fatal("want an error for a table with no RLS at all")
	}

	if _, err := tx.Exec(ctx, `CREATE TABLE test_protected (id uuid PRIMARY KEY, tenant_id uuid NOT NULL)`); err != nil {
		t.Fatalf("create protected table: %v", err)
	}
	if _, err := tx.Exec(ctx, `ALTER TABLE test_protected ENABLE ROW LEVEL SECURITY`); err != nil {
		t.Fatalf("enable rls: %v", err)
	}
	if err := tenancy.CheckRLSCoverage(ctx, tx, []string{"test_protected"}); err == nil {
		t.Fatal("want an error: RLS enabled but not FORCED and no policy yet")
	}
	if _, err := tx.Exec(ctx, `ALTER TABLE test_protected FORCE ROW LEVEL SECURITY`); err != nil {
		t.Fatalf("force rls: %v", err)
	}
	if err := tenancy.CheckRLSCoverage(ctx, tx, []string{"test_protected"}); err == nil {
		t.Fatal("want an error: forced but still no policy")
	}
	if _, err := tx.Exec(ctx, `CREATE POLICY test_protected_isolation ON test_protected USING (tenant_id = current_setting('app.current_tenant')::uuid)`); err != nil {
		t.Fatalf("create policy: %v", err)
	}
	if err := tenancy.CheckRLSCoverage(ctx, tx, []string{"test_protected"}); err != nil {
		t.Fatalf("want no error once forced + policied, got %v", err)
	}
}

func TestCheckRLSCoverage_RealScopedTablesListPasses(t *testing.T) {
	// audit_log (component 06) is the first real entry — proves the guard actually passes against
	// production migrations, not just synthetic tables. It must never mistake a platform/control-
	// plane table (tenants, roles, ... which DO carry a tenant_id-shaped column) for one of these.
	if err := tenancy.CheckRLSCoverage(context.Background(), env.Pool, tenancy.RLSScopedTables); err != nil {
		t.Fatalf("real RLSScopedTables should all be properly configured, got %v", err)
	}
}

func TestRequireTenant_UnknownSlugIsNotFound(t *testing.T) {
	mw := tenancy.NewMiddleware(env.Pool)
	h := mw.RequireTenant(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }))

	req := httptest.NewRequest(http.MethodGet, "http://no-such-tenant.bool.test/v1/x", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404 for an unknown tenant slug, got %d", rec.Code)
	}
}

// setupMiddlewareFixture commits a tenant + owner membership directly via env.Pool (not a rolled-
// back tx) — the middleware queries through its own pool, so the fixture must actually be visible
// to it. The throwaway container is discarded at TestMain's end regardless.
func setupMiddlewareFixture(t *testing.T, slug string) (tenant sqlc.Tenant, ownerID pgtype.UUID) {
	t.Helper()
	ctx := context.Background()
	q := sqlc.New(env.Pool)

	treeKey, err := q.NextTenantTreeKey(ctx)
	if err != nil {
		t.Fatalf("NextTenantTreeKey: %v", err)
	}
	tenant, err = q.CreateTenant(ctx, sqlc.CreateTenantParams{
		Slug: slug, Code: fmt.Sprintf("T%d", treeKey), Name: "Test MW Tenant",
		TreeKey: treeKey, Column7: fmt.Sprintf("%d", treeKey), Country: "MV", Status: "active",
	})
	if err != nil {
		t.Fatalf("CreateTenant: %v", err)
	}
	ownerID = newTestUUID(t)
	if _, err := q.CreateUser(ctx, sqlc.CreateUserParams{ID: ownerID, Email: slug + "@example.test", Name: "Member"}); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if _, err := q.CreateOwnerTenantUser(ctx, sqlc.CreateOwnerTenantUserParams{UserID: ownerID, TenantID: tenant.ID}); err != nil {
		t.Fatalf("CreateOwnerTenantUser: %v", err)
	}
	return tenant, ownerID
}

func TestRequireTenant_ActiveMemberIsAllowedAndTenantIDIsAttached(t *testing.T) {
	tenant, ownerID := setupMiddlewareFixture(t, "test-mw-allowed")
	principalID := uuidToString(ownerID)

	mw := tenancy.NewMiddleware(env.Pool)
	var gotTenantID pgtype.UUID
	var gotOK bool
	h := mw.RequireTenant(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotTenantID, gotOK = tenancy.TenantIDFrom(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "http://test-mw-allowed.bool.test/v1/x", nil)
	req = req.WithContext(auth.WithPrincipal(req.Context(), &auth.Principal{ID: principalID}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200 for an active member, got %d: %s", rec.Code, rec.Body.String())
	}
	if !gotOK || gotTenantID != tenant.ID {
		t.Fatalf("want tenant id %v attached to context, got %v (ok=%v)", tenant.ID, gotTenantID, gotOK)
	}
}

func TestRequireTenant_NonMemberIsNotFound(t *testing.T) {
	_, _ = setupMiddlewareFixture(t, "test-mw-nonmember")
	strangerID := newTestUUID(t)
	if _, err := sqlc.New(env.Pool).CreateUser(context.Background(), sqlc.CreateUserParams{ID: strangerID, Email: "stranger@example.test", Name: "Stranger"}); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	principalID := uuidToString(strangerID)

	mw := tenancy.NewMiddleware(env.Pool)
	h := mw.RequireTenant(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }))

	req := httptest.NewRequest(http.MethodGet, "http://test-mw-nonmember.bool.test/v1/x", nil)
	req = req.WithContext(auth.WithPrincipal(req.Context(), &auth.Principal{ID: principalID}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404 for a non-member, got %d", rec.Code)
	}
}

func TestRequireTenant_SuspendedTenantIsForbidden(t *testing.T) {
	tenant, ownerID := setupMiddlewareFixture(t, "test-mw-suspended")
	if _, err := env.Pool.Exec(context.Background(), `UPDATE tenants SET status = 'suspended' WHERE id = $1`, tenant.ID); err != nil {
		t.Fatalf("suspend tenant: %v", err)
	}
	principalID := uuidToString(ownerID)

	mw := tenancy.NewMiddleware(env.Pool)
	h := mw.RequireTenant(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }))

	req := httptest.NewRequest(http.MethodGet, "http://test-mw-suspended.bool.test/v1/x", nil)
	req = req.WithContext(auth.WithPrincipal(req.Context(), &auth.Principal{ID: principalID}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("want 403 for a suspended tenant, got %d", rec.Code)
	}
}
