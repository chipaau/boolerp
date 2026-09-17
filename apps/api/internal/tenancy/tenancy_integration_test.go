//go:build integration

package tenancy_test

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
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

	// Discovery is schema-driven now (no explicit table list) — a synthetic, non-exempt table with
	// a tenant_id column is found and checked automatically, same as any real business table would be.
	if _, err := tx.Exec(ctx, `CREATE TABLE test_unprotected (id uuid PRIMARY KEY, tenant_id uuid NOT NULL)`); err != nil {
		t.Fatalf("create unprotected table: %v", err)
	}
	err := tenancy.CheckRLSCoverage(ctx, tx)
	if err == nil || !strings.Contains(err.Error(), "test_unprotected") {
		t.Fatalf("want an error naming test_unprotected (no RLS at all), got %v", err)
	}

	if _, err := tx.Exec(ctx, `ALTER TABLE test_unprotected ENABLE ROW LEVEL SECURITY`); err != nil {
		t.Fatalf("enable rls: %v", err)
	}
	err = tenancy.CheckRLSCoverage(ctx, tx)
	if err == nil || !strings.Contains(err.Error(), "test_unprotected") {
		t.Fatalf("want an error: RLS enabled but not FORCED and no policy yet, got %v", err)
	}
	if _, err := tx.Exec(ctx, `ALTER TABLE test_unprotected FORCE ROW LEVEL SECURITY`); err != nil {
		t.Fatalf("force rls: %v", err)
	}
	err = tenancy.CheckRLSCoverage(ctx, tx)
	if err == nil || !strings.Contains(err.Error(), "test_unprotected") {
		t.Fatalf("want an error: forced but still no policy, got %v", err)
	}
	if _, err := tx.Exec(ctx, `CREATE POLICY test_unprotected_isolation ON test_unprotected USING (tenant_id = current_setting('app.current_tenant')::uuid)`); err != nil {
		t.Fatalf("create policy: %v", err)
	}
	if err := tenancy.CheckRLSCoverage(ctx, tx); err != nil {
		t.Fatalf("want no error once forced + policied (rest of the real schema already passes), got %v", err)
	}
}

func TestCheckRLSCoverage_RealSchemaPasses(t *testing.T) {
	// Proves the guard passes against production migrations, not just synthetic tables — and that
	// it correctly exempts platform/control-plane tables (tenants, roles, ... which DO carry a
	// tenant_id-shaped column) rather than mistaking them for tenant-isolated business data.
	if err := tenancy.CheckRLSCoverage(context.Background(), env.Pool); err != nil {
		t.Fatalf("real schema should be fully RLS-covered (or exempt), got %v", err)
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

// Membership is a validity window, not just a status flag: a row still marked 'active' whose
// active_to has passed must no longer grant access.
func TestRequireTenant_EndedMembershipIsNotFound(t *testing.T) {
	tenant, ownerID := setupMiddlewareFixture(t, "test-mw-ended")
	if _, err := env.Pool.Exec(context.Background(),
		`UPDATE tenant_users SET active_to = now() - interval '1 day' WHERE tenant_id = $1 AND user_id = $2`,
		tenant.ID, ownerID); err != nil {
		t.Fatalf("end membership: %v", err)
	}

	mw := tenancy.NewMiddleware(env.Pool)
	h := mw.RequireTenant(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }))

	req := httptest.NewRequest(http.MethodGet, "http://test-mw-ended.bool.test/v1/x", nil)
	req = req.WithContext(auth.WithPrincipal(req.Context(), &auth.Principal{ID: uuidToString(ownerID)}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404 for an ended membership, got %d", rec.Code)
	}
}

// The mirror image: a membership whose start is in the future doesn't grant access yet.
func TestRequireTenant_NotYetStartedMembershipIsNotFound(t *testing.T) {
	tenant, ownerID := setupMiddlewareFixture(t, "test-mw-future")
	if _, err := env.Pool.Exec(context.Background(),
		`UPDATE tenant_users SET active_from = now() + interval '1 day' WHERE tenant_id = $1 AND user_id = $2`,
		tenant.ID, ownerID); err != nil {
		t.Fatalf("future-date membership: %v", err)
	}

	mw := tenancy.NewMiddleware(env.Pool)
	h := mw.RequireTenant(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }))

	req := httptest.NewRequest(http.MethodGet, "http://test-mw-future.bool.test/v1/x", nil)
	req = req.WithContext(auth.WithPrincipal(req.Context(), &auth.Principal{ID: uuidToString(ownerID)}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404 for a not-yet-started membership, got %d", rec.Code)
	}
}

// A MEMBER of a non-active tenant already knows it exists, so they get a machine-readable code the
// SPA can branch on — offering "switch tenant" or "sign out" instead of a dead end. Sessions are NOT
// revoked: they're per identity, so revoking would sign a multi-tenant member out of tenants that
// are still perfectly active.
func TestRequireTenant_MemberOfInactiveTenantGetsACode(t *testing.T) {
	for _, tc := range []struct{ status, wantCode string }{
		{"suspended", "tenant_suspended"},
		{"archived", "tenant_archived"},
	} {
		t.Run(tc.status, func(t *testing.T) {
			tenant, ownerID := setupMiddlewareFixture(t, "test-mw-"+tc.status)
			if _, err := env.Pool.Exec(context.Background(),
				`UPDATE tenants SET status = $2 WHERE id = $1`, tenant.ID, tc.status); err != nil {
				t.Fatalf("set status: %v", err)
			}

			mw := tenancy.NewMiddleware(env.Pool)
			h := mw.RequireTenant(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))

			req := httptest.NewRequest(http.MethodGet, "http://test-mw-"+tc.status+".bool.test/v1/x", nil)
			req = req.WithContext(auth.WithPrincipal(req.Context(), &auth.Principal{ID: uuidToString(ownerID)}))
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != http.StatusForbidden {
				t.Fatalf("want 403 for a %s tenant, got %d", tc.status, rec.Code)
			}
			var body struct {
				Code      string `json:"code"`
				RequestID string `json:"request_id"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode %q: %v", rec.Body.String(), err)
			}
			if body.Code != tc.wantCode {
				t.Fatalf("want code %q so the SPA can act on it, got %q", tc.wantCode, body.Code)
			}
		})
	}
}

// The disclosure rule: a NON-member must not be able to tell a suspended tenant from one that never
// existed. Checking status before membership answered 403 here, confirming the slug to anyone who
// asked — which is precisely what the 404s elsewhere in this middleware exist to prevent.
func TestRequireTenant_NonMemberCannotTellSuspendedFromNonexistent(t *testing.T) {
	tenant, _ := setupMiddlewareFixture(t, "test-mw-suspended-private")
	if _, err := env.Pool.Exec(context.Background(),
		`UPDATE tenants SET status = 'suspended' WHERE id = $1`, tenant.ID); err != nil {
		t.Fatalf("suspend tenant: %v", err)
	}
	stranger := newTestUUID(t)
	if _, err := sqlc.New(env.Pool).CreateUser(context.Background(), sqlc.CreateUserParams{
		ID: stranger, Email: "stranger-suspended@example.test", Name: "Stranger",
	}); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	mw := tenancy.NewMiddleware(env.Pool)
	h := mw.RequireTenant(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))

	suspended := httptest.NewRequest(http.MethodGet, "http://test-mw-suspended-private.bool.test/v1/x", nil)
	suspended = suspended.WithContext(auth.WithPrincipal(suspended.Context(), &auth.Principal{ID: uuidToString(stranger)}))
	suspendedRec := httptest.NewRecorder()
	h.ServeHTTP(suspendedRec, suspended)

	absent := httptest.NewRequest(http.MethodGet, "http://test-mw-no-such-tenant-at-all.bool.test/v1/x", nil)
	absent = absent.WithContext(auth.WithPrincipal(absent.Context(), &auth.Principal{ID: uuidToString(stranger)}))
	absentRec := httptest.NewRecorder()
	h.ServeHTTP(absentRec, absent)

	if suspendedRec.Code != http.StatusNotFound {
		t.Fatalf("a non-member must get 404 for a suspended tenant, got %d: %s",
			suspendedRec.Code, suspendedRec.Body.String())
	}
	if suspendedRec.Code != absentRec.Code {
		t.Fatalf("suspended (%d) and nonexistent (%d) must be indistinguishable to a non-member",
			suspendedRec.Code, absentRec.Code)
	}
}
