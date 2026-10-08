//go:build feature

package tenancy_test

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/auth"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy"
)

// Endpoint tests (C156) for GET /api/v1/tenants (C179) through the real Operator chain
// and PostgreSQL; authentication and Cerbos are faked. The operator's staff member
// lists the test tenants; tenants are created as the owner, with row-level security
// forced on tenants so the list reads what the runtime role would.

type listWorld struct {
	*world
	operator, staff, outsider string
	tenants                   map[string]string // code → id
}

func newListWorld(t *testing.T) listWorld {
	t.Helper()
	w := newWorld(t)
	lw := listWorld{world: w, operator: w.operator(t), tenants: map[string]string{}}
	w.activate(t, lw.operator)
	for _, c := range []struct{ slug, code, name string }{
		{"x-bravo", "XBRV", "Bravo Clinic"}, {"x-alpha", "XALP", "Alpha Hospital"}, {"x-charlie", "XCHA", "Charlie 50% Clinic"},
	} {
		lw.tenants[c.code] = id(t, w.tx, `INSERT INTO tenants (slug, code, name, country, legal_form_id, timezone)
			VALUES ($1, $2, $3, 'XT', $4, 'Etc/UTC') RETURNING id`, c.slug, c.code, c.name, w.formXTNoDocument)
	}
	w.activate(t, lw.tenants["XALP"])
	w.platformDomain(t, lw.tenants["XALP"], "x-alpha.x-tenancy.test", "workspace", true)
	exec(t, w.tx, `UPDATE tenants SET parent_id = $1 WHERE id = $2`, lw.tenants["XALP"], lw.tenants["XBRV"])
	lw.staff, lw.outsider = w.user(t, 1), w.user(t, 2)
	w.member(t, lw.operator, lw.staff, false)
	w.member(t, lw.tenants["XALP"], lw.outsider, true)
	w.enforce(t)
	return lw
}

func listRouter(w *world, authz authorization.Authorizer) http.Handler {
	logger := slog.New(slog.DiscardHandler)
	m := tenancy.New(savepoints{w.tx}, logger)
	s := platform.Services{Authz: authz, Logger: logger,
		Operator: chi.Chain(actingAs, auth.RequireUser, m.ResolveOperator, m.RequireMember, m.RequireActiveTenant,
			authorization.Enforce(logger))}
	r := chi.NewRouter()
	r.Route("/api/v1/tenants", m.TenantsRoutes(s))
	return r
}

type tenantPage struct {
	Items []struct {
		ID, Slug, Code, Name, Status, Country string
		ParentID, ParentName, WorkspaceHost   *string
		CreatedAt                             string
	}
	Page, PageSize, Total int
}

func listTenants(t *testing.T, h http.Handler, token, query string) (*httptest.ResponseRecorder, tenantPage) {
	t.Helper()
	r := httptest.NewRequest(http.MethodGet, "/api/v1/tenants"+query, nil)
	r.Host = "admin.x-tenancy.test"
	r.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, r)
	var p tenantPage
	if rec.Code == http.StatusOK {
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &p))
	}
	return rec, p
}

func codes(p tenantPage) []string {
	out := []string{}
	for _, i := range p.Items {
		if i.Code != "XOP" {
			out = append(out, i.Code)
		}
	}
	return out
}

func TestFeatureOperatorStaffListTenants(t *testing.T) {
	lw := newListWorld(t)
	authz := &stated{allow: true}
	rec, p := listTenants(t, listRouter(lw.world, authz), "user:"+lw.staff, "")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []string{"list tenancy:tenant"}, authz.cans, "Cerbos decides the list")

	assert.Equal(t, []string{"XALP", "XBRV", "XCHA"}, codes(p), "by name, the default")
	assert.Equal(t, 1, p.Page)
	assert.Equal(t, 25, p.PageSize)
	assert.Equal(t, 4, p.Total, "the three and the operator")
	for _, i := range p.Items {
		switch i.Code {
		case "XALP":
			assert.Equal(t, "x-alpha", i.Slug)
			assert.Equal(t, "active", i.Status)
			assert.Equal(t, "XT", i.Country)
			require.NotNil(t, i.WorkspaceHost)
			assert.Equal(t, "x-alpha.x-tenancy.test", *i.WorkspaceHost)
			assert.Nil(t, i.ParentID)
			assert.NotEmpty(t, i.CreatedAt)
		case "XBRV":
			require.NotNil(t, i.ParentID)
			assert.Equal(t, lw.tenants["XALP"], *i.ParentID)
			require.NotNil(t, i.ParentName)
			assert.Equal(t, "Alpha Hospital", *i.ParentName, "the list names the parent, not only its id")
			assert.Nil(t, i.WorkspaceHost)
			assert.Equal(t, "provisioning", i.Status)
		}
	}
}

func TestFeatureTheTenantListSearchesFiltersSortsAndPages(t *testing.T) {
	lw := newListWorld(t)
	h := listRouter(lw.world, &stated{allow: true})
	staff := "user:" + lw.staff
	for query, want := range map[string][]string{
		"?q=clinic":                  {"XBRV", "XCHA"},
		"?q=x-alp":                   {"XALP"},
		"?q=xcha":                    {"XCHA"},
		"?q=50%25":                   {"XCHA"},
		"?q=5_%25":                   {},
		"?status=active&q=x-":        {"XALP"},
		"?sort=-code&q=x-":           {"XCHA", "XBRV", "XALP"},
		"?sort=-createdAt,name&q=x-": {"XALP", "XBRV", "XCHA"},
		"?q=x-&pageSize=2":           {"XALP", "XBRV"},
		"?q=x-&pageSize=2&page=2":    {"XCHA"},
	} {
		rec, p := listTenants(t, h, staff, query)
		require.Equal(t, http.StatusOK, rec.Code, query)
		assert.Equal(t, want, codes(p), query)
	}
	_, p := listTenants(t, h, staff, "?q=x-&pageSize=2&page=2")
	assert.Equal(t, 4, p.Total, "every match (the three and x-operator), not the page")
	_, p = listTenants(t, h, staff, "?q=x-&page=9")
	assert.Empty(t, p.Items)
	assert.Equal(t, 4, p.Total, "past the last page, still the total")
}

func TestFeatureTheTenantListRefuses(t *testing.T) {
	lw := newListWorld(t)
	rec, _ := listTenants(t, listRouter(lw.world, &stated{allow: true}), "user:"+lw.staff, "?pageSize=500&sort=slug&tenantId=x")
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	for _, param := range []string{`"parameter":"pageSize"`, `"parameter":"sort"`, `"parameter":"tenantId"`} {
		assert.Contains(t, rec.Body.String(), param)
	}

	rec, _ = listTenants(t, listRouter(lw.world, &stated{allow: false}), "user:"+lw.staff, "")
	assert.Equal(t, http.StatusForbidden, rec.Code, "without the capability")
	assert.NotContains(t, rec.Body.String(), "XALP")

	authz := &stated{allow: true}
	rec, _ = listTenants(t, listRouter(lw.world, authz), "user:"+lw.outsider, "")
	assert.Equal(t, http.StatusNotFound, rec.Code, "not a member of the operator tenant")
	assert.Empty(t, authz.cans, "refused before Cerbos is asked")

	rec, _ = listTenants(t, listRouter(lw.world, authz), "client", "")
	assert.Equal(t, http.StatusForbidden, rec.Code, "a machine client")
}

// The parent's name comes from the database, not from the rows on the page. A page is a window over
// the whole table, so a tenant's parent is usually NOT on it — the console used to resolve the name
// from the loaded rows and fall back to the literal "Another tenant", which meant the Parent column
// went blank-ish exactly when the directory grew past one page.
func TestFeatureTheTenantListNamesAParentOnAnotherPage(t *testing.T) {
	lw := newListWorld(t)
	h := listRouter(lw.world, &stated{allow: true})

	// Alphabetically XALP (the parent) is first and XBRV (its child) second, so a page holding the
	// child and not the parent is page 2 of 1.
	rec, p := listTenants(t, h, "user:"+lw.staff, "?q=x-&pageSize=1&page=2")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Equal(t, []string{"XBRV"}, codes(p), "only the child is on this page")

	child := p.Items[0]
	require.NotNil(t, child.ParentID, "the child still reports its parent")
	assert.Equal(t, lw.tenants["XALP"], *child.ParentID)
	require.NotNil(t, child.ParentName, "and names it, though the parent is on another page")
	assert.Equal(t, "Alpha Hospital", *child.ParentName)
}

// A root tenant has no parent, and says so rather than naming something.
func TestFeatureTheTenantListLeavesARootsParentEmpty(t *testing.T) {
	lw := newListWorld(t)
	_, p := listTenants(t, listRouter(lw.world, &stated{allow: true}), "user:"+lw.staff, "?q=x-alp")
	require.Len(t, p.Items, 1)
	assert.Nil(t, p.Items[0].ParentID)
	assert.Nil(t, p.Items[0].ParentName, "no parent, no name — not an empty string")
}
