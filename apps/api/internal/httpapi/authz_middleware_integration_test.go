//go:build integration

package httpapi_test

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/boolmv/erp/internal/auth"
	"github.com/boolmv/erp/internal/db/sqlc"
	"github.com/boolmv/erp/internal/httpapi"
	"github.com/boolmv/erp/internal/tenancy"
)

// fakeAuthzCerbos mirrors resource_tenant.yaml's actual rule shape in Go, so this test proves
// AdminRoute threads the right principal/resource/action through to Cerbos — it does not re-test
// Cerbos's own policy engine (docker/cerbos/policies loading cleanly is verified separately).
func fakeAuthzCerbos() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Principal struct {
				Roles []string       `json:"roles"`
				Attr  map[string]any `json:"attr"`
			} `json:"principal"`
			Resources []struct {
				Actions []string `json:"actions"`
			} `json:"resources"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		action := req.Resources[0].Actions[0]
		isInternal, _ := req.Principal.Attr["is_internal_member"].(bool)
		has := func(role string) bool {
			for _, r := range req.Principal.Roles {
				if r == role {
					return true
				}
			}
			return false
		}

		// Mirrors docker/cerbos/policies/resource_tenant.yaml. Every action needs the operator
		// derived role AND a specific capability — internal membership alone grants nothing.
		allowed := false
		switch action {
		case "list", "get":
			allowed = isInternal && (has("platform:tenants:read") || has("platform:*"))
		case "provision":
			allowed = isInternal && (has("platform:tenants:provision") || has("platform:*"))
		case "suspend", "reactivate":
			allowed = isInternal && (has("platform:tenants:suspend") || has("platform:*"))
		case "archive":
			allowed = isInternal && (has("platform:tenants:archive") || has("platform:*"))
		}
		effect := "EFFECT_DENY"
		if allowed {
			effect = "EFFECT_ALLOW"
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"results": []map[string]any{{"actions": map[string]string{action: effect}}},
		})
	}))
}

func newAdminTestUUID(t *testing.T) pgtype.UUID {
	t.Helper()
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		t.Fatalf("rand: %v", err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return pgtype.UUID{Bytes: b, Valid: true}
}

// sharedInternalTenant returns the ONE internal tenant (uq_tenants_one_internal allows at most one
// ever), creating it the first time any test in this file needs it and reusing it after — these
// fixtures commit via env.Pool (AdminRoute reads through the real pool, not a rolled-back tx), so a
// second internal tenant from another test would violate that constraint.
func sharedInternalTenant(t *testing.T) sqlc.Tenant {
	t.Helper()
	ctx := context.Background()
	q := sqlc.New(env.Pool)

	tenant, err := q.GetInternalTenant(ctx)
	if err == nil {
		return tenant
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("GetInternalTenant: %v", err)
	}
	treeKey, err := q.NextTenantTreeKey(ctx)
	if err != nil {
		t.Fatalf("NextTenantTreeKey: %v", err)
	}
	tenant, err = q.CreateTenant(ctx, sqlc.CreateTenantParams{
		Slug: "test-adminroute-internal", Code: fmt.Sprintf("ARI%d", treeKey), Name: "Test Internal",
		TreeKey: treeKey, Column7: fmt.Sprintf("%d", treeKey), Country: "MV", Status: "active", IsInternal: true,
	})
	if err != nil {
		t.Fatalf("CreateTenant(internal): %v", err)
	}
	return tenant
}

// setupNonMemberFixture creates a plain user with NO membership in the internal tenant at all.
func setupNonMemberFixture(t *testing.T, slugSuffix string) pgtype.UUID {
	t.Helper()
	userID := newAdminTestUUID(t)
	if _, err := sqlc.New(env.Pool).CreateUser(context.Background(), sqlc.CreateUserParams{ID: userID, Email: slugSuffix + "@example.test", Name: "Outsider"}); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	return userID
}

// setupOperatorFixture adds a user as a plain (non-owner — only one owner is allowed per tenant,
// and several tests share one internal tenant) active member of the shared internal tenant,
// optionally with a role granting the given capability.
func setupOperatorFixture(t *testing.T, slugSuffix string, capabilities ...string) (userID pgtype.UUID) {
	t.Helper()
	ctx := context.Background()
	q := sqlc.New(env.Pool)
	tenant := sharedInternalTenant(t)

	userID = newAdminTestUUID(t)
	if _, err := q.CreateUser(ctx, sqlc.CreateUserParams{ID: userID, Email: slugSuffix + "@example.test", Name: "Operator"}); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if _, err := env.Pool.Exec(ctx,
		`INSERT INTO tenant_users (user_id, tenant_id, status, is_owner, active_from) VALUES ($1, $2, 'active', false, now())`,
		userID, tenant.ID,
	); err != nil {
		t.Fatalf("insert active membership: %v", err)
	}

	if len(capabilities) > 0 {
		app, err := q.GetAppByCode(ctx, "control-centre")
		if err != nil {
			t.Fatalf("GetAppByCode: %v", err)
		}
		role, err := q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, TenantID: tenant.ID, Code: "test-role-" + slugSuffix, Name: "Test Role"})
		if err != nil {
			t.Fatalf("CreateRole: %v", err)
		}
		for _, capability := range capabilities {
			if capability == "" {
				continue
			}
			if _, err := q.CreateRoleCapability(ctx, sqlc.CreateRoleCapabilityParams{RoleID: role.ID, Capability: capability}); err != nil {
				t.Fatalf("CreateRoleCapability(%s): %v", capability, err)
			}
		}
		if _, err := q.CreateUserRole(ctx, sqlc.CreateUserRoleParams{TenantID: tenant.ID, UserID: userID, RoleID: role.ID}); err != nil {
			t.Fatalf("CreateUserRole: %v", err)
		}
	}
	return userID
}

// buildGatedTestHandler wires one route behind the real authorization middleware — OperatorsOnly to
// resolve the principal and gate on internal membership, then RequirePermission for the (resource,
// action) decision — against a fake Cerbos mirroring resource_tenant.yaml's rules. Runs the handler
// directly (ServeHTTP, no network hop) so the request's context, carrying the injected Principal,
// reaches the middleware.
func buildGatedTestHandler(t *testing.T, action string) (http.Handler, *bool) {
	t.Helper()
	cerbosSrv := fakeAuthzCerbos()
	t.Cleanup(cerbosSrv.Close)

	cerbos := auth.NewCerbos(cerbosSrv.URL)
	called := false
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(auth.OperatorsOnly(env.Pool))
		r.With(auth.RequirePermission(cerbos, "tenant", action)).Get("/test", func(w http.ResponseWriter, _ *http.Request) {
			called = true
			w.WriteHeader(http.StatusOK)
		})
	})
	return r, &called
}

func doAdminRequest(handler http.Handler, userID pgtype.UUID) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req = req.WithContext(auth.WithPrincipal(req.Context(), &auth.Principal{ID: uuidToStringAdmin(userID)}))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func uuidToStringAdmin(id pgtype.UUID) string {
	// mirrors auth.ParseUUID's inverse; duplicated locally to avoid exporting a uuid helper just for tests
	const hex = "0123456789abcdef"
	b := id.Bytes
	buf := make([]byte, 36)
	pos := 0
	for i, byt := range b {
		if i == 4 || i == 6 || i == 8 || i == 10 {
			buf[pos] = '-'
			pos++
		}
		buf[pos] = hex[byt>>4]
		buf[pos+1] = hex[byt&0x0f]
		pos += 2
	}
	return string(buf)
}

func TestAuthzMiddleware_DeniesNonInternalMember(t *testing.T) {
	userID := setupNonMemberFixture(t, "nonmember")
	h, called := buildGatedTestHandler(t, "list")

	rec := doAdminRequest(h, userID)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("want 403, got %d", rec.Code)
	}
	if *called {
		t.Fatal("handler must not run when authz denies")
	}
}

func TestAuthzMiddleware_AllowsInternalMemberForListAction(t *testing.T) {
	userID := setupOperatorFixture(t, "list-ok", "platform:tenants:read")
	h, called := buildGatedTestHandler(t, "list")

	rec := doAdminRequest(h, userID)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	if !*called {
		t.Fatal("handler should run when authz allows")
	}
}

func TestAuthzMiddleware_DeniesInternalMemberWithoutMatchingCapability(t *testing.T) {
	userID := setupOperatorFixture(t, "wrong-cap", "platform:tenants:suspend")
	h, called := buildGatedTestHandler(t, "provision") // only holds suspend, not provision

	rec := doAdminRequest(h, userID)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("want 403 for a capability mismatch, got %d", rec.Code)
	}
	if *called {
		t.Fatal("handler must not run when authz denies")
	}
}

func TestAuthzMiddleware_AllowsMatchingCapability(t *testing.T) {
	userID := setupOperatorFixture(t, "right-cap", "platform:tenants:provision")
	h, called := buildGatedTestHandler(t, "provision")

	rec := doAdminRequest(h, userID)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	if !*called {
		t.Fatal("handler should run when the specific capability matches")
	}
}

// Every route this module mounts must be gated by the authorization middleware. Nothing in the type
// system enforces that any more: handlers are ordinary http.HandlerFunc, so a route registered
// outside the OperatorsOnly group compiles perfectly and is simply open. That makes this audit the
// only guard, so it asserts the property directly rather than trusting the registration style — walk
// the module's real route tree and prove every route denies a caller holding no capabilities.
//
// It deliberately audits ALL of the module's routes rather than some privileged path prefix: the URL
// no longer says who may call a route, so "is it under /admin?" is not a question worth asking.
func TestEveryModuleRouteIsAuthorizationGated(t *testing.T) {
	userID := setupNonMemberFixture(t, "route-tree-audit")
	kratos := fakeKratosFor(uuidToStringAdmin(userID), "route-tree-audit@example.test")
	defer kratos.Close()

	cerbosSrv := fakeAuthzCerbos()
	defer cerbosSrv.Close()
	deps := httpapi.PlatformDeps{
		Pool:   env.Pool,
		Kratos: auth.NewKratos(kratos.URL, kratos.URL),
		Cerbos: auth.NewCerbos(cerbosSrv.URL),
	}
	module := tenancy.Register(deps)

	// Discover what the module actually mounts, rather than hardcoding a list a new route could be
	// added without touching.
	discover := chi.NewRouter()
	module.Mount(discover)
	type route struct{ method, pattern string }
	var routes []route
	if err := chi.Walk(discover, func(method, pattern string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		routes = append(routes, route{method, pattern})
		return nil
	}); err != nil {
		t.Fatalf("walk routes: %v", err)
	}
	if len(routes) == 0 {
		t.Fatal("no routes discovered — the walk found nothing to audit")
	}

	// Exercise each discovered route through the REAL router (session middleware included), as a
	// signed-in user who is not an operator.
	h := httpapi.New(deps, module)
	for _, rt := range routes {
		path := "/v1" + strings.ReplaceAll(rt.pattern, "{id}", uuidToStringAdmin(newAdminTestUUID(t)))
		t.Run(rt.method+" "+rt.pattern, func(t *testing.T) {
			rec := doAsOperator(t, h, rt.method, path, nil)
			if rec.Code != http.StatusForbidden {
				t.Fatalf("want 403 for a caller with no capabilities, got %d: %s\n"+
					"this route is not behind auth.OperatorsOnly / auth.RequirePermission", rec.Code, rec.Body.String())
			}
		})
	}
}
