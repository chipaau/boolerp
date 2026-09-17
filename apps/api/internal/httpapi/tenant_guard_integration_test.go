//go:build integration

package httpapi_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/boolmv/erp/internal/auth"
	"github.com/boolmv/erp/internal/db/sqlc"
	"github.com/boolmv/erp/internal/httpapi"
	"github.com/boolmv/erp/internal/tenancy"
)

// nonTenantRoutes are the routes that legitimately do NOT resolve a tenant from the Host, and so are
// not expected to sit behind tenancy.RequireTenant. The default is the other way round — a route is
// assumed tenant-scoped unless it is listed here — mirroring the RLS coverage guard, where every
// table needs isolation unless deliberately exempted. An exemption is a decision someone has to make
// and justify, not something a new route acquires by being forgotten.
//
//   - GET /v1/me is the caller's own identity. It is tenant-agnostic by design: a person belongs to
//     several tenants, and asking "who am I" must work before one is chosen.
//   - /v1/tenants* is the operator console (admin.bool.test), which has no tenant slug in its Host at
//     all. It is gated by auth.OperatorsOnly + auth.RequirePermission instead.
var nonTenantRoutes = map[string]bool{
	"GET /v1/me":                       true,
	"GET /v1/tenants":                  true,
	"POST /v1/tenants":                 true,
	"GET /v1/tenants/{id}":             true,
	"POST /v1/tenants/{id}/suspend":    true,
	"POST /v1/tenants/{id}/reactivate": true,
	"POST /v1/tenants/{id}/archive":    true,
}

// Every route that isn't explicitly exempt must resolve a tenant, so tenant state actually governs
// access to it. This is the guard's enforcement point: tenancy.RequireTenant exists and is correct,
// but today there is no tenant-scoped route for it to protect, so nothing would notice if the first
// one shipped without it. The check is behavioural rather than structural — it drives a real request
// as a member of a SUSPENDED tenant and requires the refusal — so it cannot be satisfied by wiring
// that merely looks right.
func TestEveryTenantScopedRouteResolvesATenant(t *testing.T) {
	suspended, memberID := setupSuspendedTenantFixture(t, "guard-suspended")
	kratos := fakeKratosFor(uuidToStringAdmin(memberID), "guard-suspended@example.test")
	defer kratos.Close()

	cerbosSrv := fakeAuthzCerbos()
	defer cerbosSrv.Close()
	deps := httpapi.PlatformDeps{
		Pool:   env.Pool,
		Kratos: auth.NewKratos(kratos.URL, kratos.URL),
		Cerbos: auth.NewCerbos(cerbosSrv.URL),
	}
	module := tenancy.Register(deps)

	discover := chi.NewRouter()
	module.Mount(discover)
	type route struct{ method, pattern string }
	var routes []route
	if err := chi.Walk(discover, func(method, pattern string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		routes = append(routes, route{method, "/v1" + pattern})
		return nil
	}); err != nil {
		t.Fatalf("walk routes: %v", err)
	}
	// /me comes from a different module; include it so a stale exemption for it is still caught.
	routes = append(routes, route{http.MethodGet, "/v1/me"})

	h := httpapi.New(deps, module)
	seen := map[string]bool{}
	for _, rt := range routes {
		key := rt.method + " " + rt.pattern
		seen[key] = true
		if nonTenantRoutes[key] {
			continue
		}
		t.Run(key, func(t *testing.T) {
			// Addressed at the suspended tenant's own host, as one of its members. If the route
			// resolves a tenant, RequireTenant refuses it; if it doesn't, the handler answers instead.
			req := httptest.NewRequest(rt.method,
				"http://"+suspended+".bool.test"+pathFor(rt.pattern, t), nil)
			req.Header.Set("Cookie", "ory_kratos_session=abc")
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != http.StatusForbidden {
				t.Fatalf("want 403 (tenant suspended), got %d: %s\n"+
					"this route is not behind tenancy.RequireTenant — mount it, or add %q to nonTenantRoutes "+
					"with a reason", rec.Code, rec.Body.String(), key)
			}
			var body struct {
				Code string `json:"code"`
			}
			_ = json.Unmarshal(rec.Body.Bytes(), &body)
			if body.Code != "tenant_suspended" {
				t.Fatalf("want the tenant_suspended code so the SPA can act, got %q", body.Code)
			}
		})
	}

	// A stale exemption is its own bug: it silently excuses a route that no longer exists, and would
	// excuse a future route that happens to reuse the pattern.
	for key := range nonTenantRoutes {
		if !seen[key] {
			t.Errorf("nonTenantRoutes exempts %q, which no route serves any more — remove it", key)
		}
	}
}

func pathFor(pattern string, t *testing.T) string {
	t.Helper()
	return replaceIDParam(pattern)
}

func replaceIDParam(pattern string) string {
	const param = "{id}"
	for {
		i := indexOf(pattern, param)
		if i < 0 {
			return pattern
		}
		pattern = pattern[:i] + "018f7d3a-0000-7000-8000-0000000000cc" + pattern[i+len(param):]
	}
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

// setupSuspendedTenantFixture commits a suspended tenant with one active member, so a request can be
// made as someone who genuinely belongs to it — the only caller RequireTenant tells the truth to.
func setupSuspendedTenantFixture(t *testing.T, slug string) (tenantSlug string, memberID pgtype.UUID) {
	t.Helper()
	ctx := context.Background()
	q := sqlc.New(env.Pool)

	treeKey, err := q.NextTenantTreeKey(ctx)
	if err != nil {
		t.Fatalf("NextTenantTreeKey: %v", err)
	}
	tenant, err := q.CreateTenant(ctx, sqlc.CreateTenantParams{
		Slug: slug, Code: fmt.Sprintf("GS%d", treeKey), Name: "Guard Suspended",
		TreeKey: treeKey, Column7: fmt.Sprintf("%d", treeKey), Country: "MV", Status: "active",
	})
	if err != nil {
		t.Fatalf("CreateTenant: %v", err)
	}
	memberID = newAdminTestUUID(t)
	if _, err := q.CreateUser(ctx, sqlc.CreateUserParams{
		ID: memberID, Email: slug + "@example.test", Name: "Member",
	}); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if _, err := q.CreateOwnerTenantUser(ctx, sqlc.CreateOwnerTenantUserParams{
		UserID: memberID, TenantID: tenant.ID,
	}); err != nil {
		t.Fatalf("CreateOwnerTenantUser: %v", err)
	}
	if _, err := env.Pool.Exec(ctx, `UPDATE tenants SET status = 'suspended' WHERE id = $1`, tenant.ID); err != nil {
		t.Fatalf("suspend tenant: %v", err)
	}
	return slug, memberID
}
