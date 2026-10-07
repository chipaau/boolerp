//go:build feature

package tenancy_test

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/auth"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy"
)

// Endpoint tests (C156) for GET /api/v1/tenant: the real router, the tenant chain,
// the lookups, and PostgreSQL. Rows are created in the owner's rolled-back
// transaction with row-level security forced on tenants (world.enforce), so the
// read sees what the runtime role sees; authentication and authorization are faked.

// savepoints lets the module begin its transactions inside the test's.
type savepoints struct{ pgx.Tx }

func (s savepoints) BeginTx(ctx context.Context, _ pgx.TxOptions) (pgx.Tx, error) {
	return s.Begin(ctx)
}

// actingAs is authentication faked: "Bearer user:<id>" is a person with that user,
// "Bearer client" a machine client; anything else is 401.
func actingAs(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		caller := auth.Caller{Token: auth.Token{ClientID: "bff-workspace"}}
		switch {
		case strings.HasPrefix(raw, "user:"):
			caller.Token.Subject = "0192f6a0-0000-7000-8000-0000000ac001"
			caller.User = &identity.User{ID: strings.TrimPrefix(raw, "user:")}
		case raw == "client":
			caller.Token.ClientID = "hrms-sync"
		default:
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(auth.NewContext(r.Context(), caller)))
	})
}

// stated is authorization faked: it allows or denies as the test states, notes
// the decision, and keeps what it was asked.
type stated struct {
	allow bool
	asked []authorization.Resource
	cans  []string
}

func (s *stated) Check(ctx context.Context, _ string, r authorization.Resource, _ ...authorization.Fact) error {
	authorization.NoteDecision(ctx)
	s.asked = append(s.asked, r)
	if !s.allow {
		return authorization.ErrDenied
	}
	return nil
}

func (s *stated) Can(ctx context.Context, action, kind string, _ ...authorization.Fact) error {
	authorization.NoteDecision(ctx)
	s.cans = append(s.cans, action+" "+kind)
	if !s.allow {
		return authorization.ErrDenied
	}
	return nil
}

// tenantRouter mounts the module at /api/v1/tenant behind the tenant chain, as the
// edition does, over the test's transaction.
func tenantRouter(w *world, authz authorization.Authorizer) http.Handler {
	logger := slog.New(slog.DiscardHandler)
	m := tenancy.New(savepoints{w.tx}, logger)
	s := platform.Services{Authz: authz, Logger: logger,
		TenantUser: chi.Chain(actingAs, auth.RequireUser, m.ResolveTenant, m.RequireMember, m.RequireActiveTenant,
			authorization.Enforce(logger))}
	r := chi.NewRouter()
	r.Route("/api/v1/tenant", m.Routes(s))
	return r
}

func get(h http.Handler, host, token string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodGet, "/api/v1/tenant", nil)
	r.Host = host
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, r)
	return rec
}

// cityWorld is an active tenant with a workspace host and a portal host, a member,
// an invited person, and an outsider who belongs to another tenant. change, if
// given, runs before row-level security is forced (after it, the owner's own
// writes to tenants would be filtered too).
type cityWorld struct {
	*world
	city, member, invited, outsider string
}

func newCityWorld(t *testing.T, change ...string) cityWorld {
	t.Helper()
	w := newWorld(t)
	c := cityWorld{world: w, city: w.tenant(t, "x-city", "XCITY")}
	w.activate(t, c.city)
	w.platformDomain(t, c.city, "x-city.x-tenancy.test", "workspace", true)
	w.platformDomain(t, c.city, "x-city-portal.x-tenancy.test", "academics.student", true)
	other := w.tenant(t, "x-other", "XOTH")
	c.member, c.invited, c.outsider = w.user(t, 1), w.user(t, 3), w.user(t, 2)
	w.member(t, c.city, c.member, false)
	w.invite(t, c.city, c.invited)
	w.member(t, other, c.outsider, true)
	for _, sql := range change {
		exec(t, w.tx, sql, c.city)
	}
	w.enforce(t)
	return c
}

func TestFeatureAMemberGetsTheirTenant(t *testing.T) {
	c := newCityWorld(t)
	authz := &stated{allow: true}
	rec := get(tenantRouter(c.world, authz), "X-City.x-tenancy.test:443", "user:"+c.member)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var body map[string]string
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&body))
	assert.Equal(t, map[string]string{"id": c.city, "code": "XCITY", "name": "Tenant XCITY", "status": "active"}, body)
	assert.Equal(t, []authorization.Resource{{Kind: "tenancy:tenant", ID: c.city,
		Attributes: map[string]any{"tenant_id": c.city, "status": "active"}}}, authz.asked, "Cerbos decides on the tenant read")
}

func TestFeatureTheTenantChainRefuses(t *testing.T) {
	c := newCityWorld(t)

	for name, r := range map[string]struct {
		host, token string
		want        int
	}{
		"no token":                      {"x-city.x-tenancy.test", "", http.StatusUnauthorized},
		"a machine client":              {"x-city.x-tenancy.test", "client", http.StatusForbidden},
		"an unknown host":               {"nowhere.x-tenancy.test", "user:" + c.member, http.StatusNotFound},
		"a portal host":                 {"x-city-portal.x-tenancy.test", "user:" + c.member, http.StatusNotFound},
		"a member of another tenant":    {"x-city.x-tenancy.test", "user:" + c.outsider, http.StatusNotFound},
		"an invited person, not joined": {"x-city.x-tenancy.test", "user:" + c.invited, http.StatusNotFound},
	} {
		t.Run(name, func(t *testing.T) {
			authz := &stated{allow: true}
			rec := get(tenantRouter(c.world, authz), r.host, r.token)
			assert.Equal(t, r.want, rec.Code, rec.Body.String())
			assert.Empty(t, authz.asked, "refused before the handler")
		})
	}
}

func TestFeatureMembersOfASuspendedTenantAreRefused(t *testing.T) {
	c := newCityWorld(t, `UPDATE tenants SET status = 'suspended', suspended_at = now() WHERE id = $1`)
	rec := get(tenantRouter(c.world, &stated{allow: true}), "x-city.x-tenancy.test", "user:"+c.member)
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Contains(t, rec.Body.String(), tenancy.TypeTenantSuspended)
}

func TestFeatureCerbosDecidesTheTenantRead(t *testing.T) {
	c := newCityWorld(t)
	rec := get(tenantRouter(c.world, &stated{allow: false}), "x-city.x-tenancy.test", "user:"+c.member)
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.NotContains(t, rec.Body.String(), "XCITY", "nothing of the tenant is returned")
}
