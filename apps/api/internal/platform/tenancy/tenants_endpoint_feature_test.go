//go:build feature

package tenancy_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization/authztest"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/response"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy"
)

// Endpoint tests (C156) for the /api/v1/tenants resource: the list (GET, C179) and
// creating a tenant (POST, C197).

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
		lw.tenants[c.code] = testdb.ID(t, w.tx, `INSERT INTO tenants (slug, code, name, country, legal_form_id, timezone)
			VALUES ($1, $2, $3, 'XT', $4, 'Etc/UTC') RETURNING id`, c.slug, c.code, c.name, w.formXTNoDocument)
	}
	w.activate(t, lw.tenants["XALP"])
	w.platformDomain(t, lw.tenants["XALP"], "x-alpha.x-tenancy.test", "workspace", true)
	testdb.Exec(t, w.tx, `UPDATE tenants SET parent_id = $1 WHERE id = $2`, lw.tenants["XALP"], lw.tenants["XBRV"])
	lw.staff, lw.outsider = w.user(t, 1), w.user(t, 2)
	w.member(t, lw.operator, lw.staff, false)
	w.member(t, lw.tenants["XALP"], lw.outsider, true)
	w.enforce(t)
	return lw
}

func listRouter(w *world, authz authorization.Authorizer) http.Handler {
	logger := slog.New(slog.DiscardHandler)
	m := tenancy.New(testdb.Savepoints{Tx: w.tx}, nil, logger)
	s := chainParts(w, m, logger).Services(nil, authz, logger)
	r := chi.NewRouter()
	r.Route("/api/v1/tenants", m.TenantsRoutes(s))
	return r
}

type tenantPage = response.Paged[struct {
	ID, Slug, Code, Name, Status, Country string
	ParentID, ParentName, WorkspaceHost   *string
	CreatedAt                             string
}]

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
	authz := &authztest.Stated{Allow: true}
	rec, p := listTenants(t, listRouter(lw.world, authz), "user:"+lw.staff, "")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []string{"list tenancy:tenant"}, authz.Cans, "Cerbos decides the list")

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
	h := listRouter(lw.world, &authztest.Stated{Allow: true})
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
	rec, _ := listTenants(t, listRouter(lw.world, &authztest.Stated{Allow: true}), "user:"+lw.staff, "?pageSize=500&sort=slug&tenantId=x")
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	for _, param := range []string{`"parameter":"pageSize"`, `"parameter":"sort"`, `"parameter":"tenantId"`} {
		assert.Contains(t, rec.Body.String(), param)
	}

	rec, _ = listTenants(t, listRouter(lw.world, &authztest.Stated{Allow: false}), "user:"+lw.staff, "")
	assert.Equal(t, http.StatusForbidden, rec.Code, "without the capability")
	assert.NotContains(t, rec.Body.String(), "XALP")

	authz := &authztest.Stated{Allow: true}
	rec, _ = listTenants(t, listRouter(lw.world, authz), "user:"+lw.outsider, "")
	assert.Equal(t, http.StatusNotFound, rec.Code, "not a member of the operator tenant")
	assert.Empty(t, authz.Cans, "refused before Cerbos is asked")

	rec, _ = listTenants(t, listRouter(lw.world, authz), "client", "")
	assert.Equal(t, http.StatusForbidden, rec.Code, "a machine client")
}

// The parent's name comes from the database, not from the rows on the page. A page is a window over
// the whole table, so a tenant's parent is usually NOT on it — the console used to resolve the name
// from the loaded rows and fall back to the literal "Another tenant", which meant the Parent column
// went blank-ish exactly when the directory grew past one page.
func TestFeatureTheTenantListNamesAParentOnAnotherPage(t *testing.T) {
	lw := newListWorld(t)
	h := listRouter(lw.world, &authztest.Stated{Allow: true})

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
	_, p := listTenants(t, listRouter(lw.world, &authztest.Stated{Allow: true}), "user:"+lw.staff, "?q=x-alp")
	require.Len(t, p.Items, 1)
	assert.Nil(t, p.Items[0].ParentID)
	assert.Nil(t, p.Items[0].ParentName, "no parent, no name — not an empty string")
}

// Endpoint tests (C156) for POST /api/v1/tenants (C197) through the real Operator chain
// and PostgreSQL, with row-level security forced on tenants; authentication, Cerbos, and
// the reference lists (the reference module, read outside this transaction) are faked.

// lists is the reference module faked: what it states is current.
type lists struct {
	countries map[string]bool
	forms     map[string][2]string // id → country, identity document
	types     map[string]bool
	down      bool
}

var errDown = errors.New("reference lists unavailable")

func (l lists) CountryCurrent(_ context.Context, code string) (bool, error) {
	if l.down {
		return false, errDown
	}
	return l.countries[code], nil
}

func (l lists) LegalForm(_ context.Context, id string) (string, string, bool, error) {
	if l.down {
		return "", "", false, errDown
	}
	f, ok := l.forms[id]
	return f[0], f[1], ok, nil
}

func (l lists) InstitutionTypesCurrent(_ context.Context, codes []string) (map[string]bool, error) {
	if l.down {
		return nil, errDown
	}
	out := map[string]bool{}
	for _, c := range codes {
		out[c] = l.types[c]
	}
	return out, nil
}

type createWorld struct {
	*world
	operator, staff, existing string
	lists                     lists
}

func newCreateWorld(t *testing.T) createWorld {
	t.Helper()
	w := newWorld(t)
	cw := createWorld{world: w, operator: w.operator(t)}
	w.activate(t, cw.operator)
	testdb.Exec(t, w.tx, `INSERT INTO institution_types (code, sector, name) VALUES ('x_tenancy_other', 'x_tenancy', 'Other test type')`)
	testdb.Exec(t, w.tx, `INSERT INTO apps (key, name, kind, is_default) VALUES ('x-tcreate-on', 'On', 'workspace', true),
		('x-tcreate-off', 'Off', 'workspace', false)`)
	cw.existing = w.tenant(t, "x-held", "XHELD")
	testdb.Exec(t, w.tx, `UPDATE tenants SET legal_form_id = $1, identity_number = 'C-77', tax_number = 'TIN-77' WHERE id = $2`, w.formXT, cw.existing)
	cw.staff = w.user(t, 1)
	w.member(t, cw.operator, cw.staff, false)
	w.enforce(t)
	cw.lists = lists{
		countries: map[string]bool{"XT": true, "XU": true},
		forms: map[string][2]string{
			w.formXT: {"XT", "Test registration number"}, w.formXTNoDocument: {"XT", ""}, w.formXU: {"XU", ""},
		},
		types: map[string]bool{"x_tenancy_type": true, "x_tenancy_other": true},
	}
	return cw
}

func createRouter(w createWorld, authz authorization.Authorizer) http.Handler {
	logger := slog.New(slog.DiscardHandler)
	m := tenancy.New(testdb.Savepoints{Tx: w.tx}, w.lists, logger)
	s := chainParts(w.world, m, logger).Services(nil, authz, logger)
	r := chi.NewRouter()
	r.Route("/api/v1/tenants", m.TenantsRoutes(s))
	return r
}

// valid is a request every rule accepts: a company of XT, which names a document.
func (w createWorld) valid() map[string]any {
	return map[string]any{
		"name": "New Test Clinic", "slug": "x-new-clinic", "code": "XNEW", "country": "XT",
		"legalFormId": w.formXT, "identityNumber": "C-1024/2026", "timezone": "Indian/Maldives",
		"institutionTypes": []map[string]any{{"code": "x_tenancy_type", "primary": false}, {"code": "x_tenancy_other", "primary": true}},
		"registeredOn":     "2026-01-15", "taxNumber": "TIN-1", "email": "info@new-clinic.test", "phone": "+9603324568",
	}
}

func post(t *testing.T, h http.Handler, token string, body any) *httptest.ResponseRecorder {
	t.Helper()
	b, err := json.Marshal(body)
	require.NoError(t, err)
	r := httptest.NewRequest(http.MethodPost, "/api/v1/tenants", bytes.NewReader(b))
	r.Host = "admin.x-tenancy.test"
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, r)
	return rec
}

// fieldErrors reads a 422's errors as pointer → code.
func fieldErrors(t *testing.T, rec *httptest.ResponseRecorder) map[string]string {
	t.Helper()
	require.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
	var d problem.Details
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &d))
	out := map[string]string{}
	for _, e := range d.Errors {
		out[e.Pointer] = e.Code
	}
	return out
}

func TestFeatureOperatorStaffCreateATenant(t *testing.T) {
	w := newCreateWorld(t)
	authz := &authztest.Stated{Allow: true}
	rec := post(t, createRouter(w, authz), "user:"+w.staff, w.valid())
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, []string{"create tenancy:tenant"}, authz.Cans, "Cerbos decides the create")

	var got struct {
		ID, Slug, Code, Name, Status, Country string
		ParentID, WorkspaceHost               *string
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "/api/v1/tenants/"+got.ID, rec.Header().Get("Location"))
	assert.Equal(t, "x-new-clinic", got.Slug)
	assert.Equal(t, "provisioning", got.Status, "a new tenant is provisioning (C197)")
	assert.Nil(t, got.WorkspaceHost, "its host comes at activation (C203)")

	testdb.AssertHas(t, w.tx, "tenants", map[string]any{"id": got.ID, "name": "New Test Clinic", "code": "XNEW",
		"country": "XT", "legal_form_id": w.formXT, "identity_number": "C-1024/2026", "timezone": "Indian/Maldives",
		"tax_number": "TIN-1", "email": "info@new-clinic.test", "phone": "+9603324568", "status": "provisioning", "parent_id": nil})
	testdb.AssertHas(t, w.tx, "tenant_institution_types", map[string]any{"tenant_id": got.ID, "institution_type": "x_tenancy_other", "is_primary": true})
	testdb.AssertHas(t, w.tx, "tenant_institution_types", map[string]any{"tenant_id": got.ID, "institution_type": "x_tenancy_type", "is_primary": false})
	testdb.AssertHas(t, w.tx, "tenant_apps", map[string]any{"tenant_id": got.ID, "app_key": "x-tcreate-on", "activated_by": w.staff, "active_to": nil})
	testdb.AssertMissing(t, w.tx, "tenant_apps", map[string]any{"tenant_id": got.ID, "app_key": "x-tcreate-off"})
	testdb.AssertMissing(t, w.tx, "domains", map[string]any{"tenant_id": got.ID})
	testdb.AssertMissing(t, w.tx, "memberships", map[string]any{"tenant_id": got.ID})
}

func TestFeatureATenantCanBeCreatedUnderAParent(t *testing.T) {
	w := newCreateWorld(t)
	h := createRouter(w, &authztest.Stated{Allow: true})
	body := w.valid()
	body["parentId"] = w.existing
	rec := post(t, h, "user:"+w.staff, body)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var got struct{ ID, ParentName string }
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, "Tenant XHELD", got.ParentName)
	testdb.AssertHas(t, w.tx, "tenants", map[string]any{"id": got.ID, "parent_id": w.existing})

	body = w.valid()
	body["slug"], body["code"], body["identityNumber"], body["taxNumber"] = "x-other", "XOTH", "C-2", "TIN-2"
	body["parentId"] = w.operator
	assert.Equal(t, map[string]string{"#/parentId": "exists"}, fieldErrors(t, post(t, h, "user:"+w.staff, body)),
		"not under the operator")
}

func TestFeatureCreatingATenantChecksItsRules(t *testing.T) {
	w := newCreateWorld(t)
	h := createRouter(w, &authztest.Stated{Allow: true})
	for name, c := range map[string]struct {
		change func(b map[string]any)
		want   map[string]string
	}{
		"missing fields": {func(b map[string]any) { delete(b, "name"); delete(b, "timezone"); delete(b, "institutionTypes") },
			map[string]string{"#/name": "required", "#/timezone": "required", "#/institutionTypes": "required"}},
		"bad slug and code": {func(b map[string]any) { b["slug"], b["code"] = "X_Bad", "x" },
			map[string]string{"#/slug": "slug", "#/code": "min"}},
		"a lowercase code":                  {func(b map[string]any) { b["code"] = "xnew" }, map[string]string{"#/code": "uppercase"}},
		"a reserved slug":                   {func(b map[string]any) { b["slug"] = "admin" }, map[string]string{"#/slug": "reserved"}},
		"no such time zone":                 {func(b map[string]any) { b["timezone"] = "Mars/Olympus" }, map[string]string{"#/timezone": "timezone"}},
		"Local is not a zone":               {func(b map[string]any) { b["timezone"] = "Local" }, map[string]string{"#/timezone": "timezone"}},
		"a phone not in international form": {func(b map[string]any) { b["phone"] = "3324568" }, map[string]string{"#/phone": "phone"}},
		"a blank name":                      {func(b map[string]any) { b["name"] = "   " }, map[string]string{"#/name": "notblank"}},
		"an unknown country": {func(b map[string]any) { b["country"] = "XZ" },
			map[string]string{"#/country": "exists", "#/legalFormId": "country"}},
		"another country's legal form": {func(b map[string]any) { b["legalFormId"] = w.formXU },
			map[string]string{"#/legalFormId": "country"}},
		"a retired legal form": {func(b map[string]any) { b["legalFormId"] = "0192f6a0-0000-7000-8000-00000000dead" },
			map[string]string{"#/legalFormId": "exists"}},
		"the document's number missing": {func(b map[string]any) { delete(b, "identityNumber") },
			map[string]string{"#/identityNumber": "required"}},
		"a number for a form that names none": {func(b map[string]any) { b["legalFormId"] = w.formXTNoDocument },
			map[string]string{"#/identityNumber": "excluded"}},
		"no primary type": {func(b map[string]any) {
			b["institutionTypes"] = []map[string]any{{"code": "x_tenancy_type"}, {"code": "x_tenancy_other"}}
		}, map[string]string{"#/institutionTypes": "primary"}},
		"two primary types": {func(b map[string]any) {
			b["institutionTypes"] = []map[string]any{{"code": "x_tenancy_type", "primary": true}, {"code": "x_tenancy_other", "primary": true}}
		}, map[string]string{"#/institutionTypes": "primary"}},
		"a type twice": {func(b map[string]any) {
			b["institutionTypes"] = []map[string]any{{"code": "x_tenancy_type", "primary": true}, {"code": "x_tenancy_type"}}
		}, map[string]string{"#/institutionTypes/1/code": "unique"}},
		"an unknown type": {func(b map[string]any) {
			b["institutionTypes"] = []map[string]any{{"code": "x_tenancy_type", "primary": true}, {"code": "x_nope"}}
		}, map[string]string{"#/institutionTypes/1/code": "exists"}},
		"values another tenant holds": {func(b map[string]any) {
			b["slug"], b["code"], b["identityNumber"], b["taxNumber"] = "x-held", "XHELD", "c-77", "tin-77"
		}, map[string]string{"#/slug": "unique", "#/code": "unique", "#/identityNumber": "unique", "#/taxNumber": "unique"}},
	} {
		t.Run(name, func(t *testing.T) {
			b := w.valid()
			c.change(b)
			assert.Equal(t, c.want, fieldErrors(t, post(t, h, "user:"+w.staff, b)))
		})
	}
	testdb.AssertMissing(t, w.tx, "tenants", map[string]any{"slug": "x-new-clinic"})
}

func TestFeatureATakenValueNamesItsTenant(t *testing.T) {
	w := newCreateWorld(t)
	b := w.valid()
	b["slug"] = "x-held"
	rec := post(t, createRouter(w, &authztest.Stated{Allow: true}), "user:"+w.staff, b)
	assert.Contains(t, rec.Body.String(), "is already used by Tenant XHELD")
}

func TestFeatureCreatingATenantRefuses(t *testing.T) {
	w := newCreateWorld(t)
	rec := post(t, createRouter(w, &authztest.Stated{Allow: false}), "user:"+w.staff, w.valid())
	assert.Equal(t, http.StatusForbidden, rec.Code, "Cerbos denies")

	down := w
	down.lists.down = true
	rec = post(t, createRouter(down, &authztest.Stated{Allow: true}), "user:"+w.staff, w.valid())
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code, "the reference lists cannot be read")

	rec = post(t, createRouter(w, &authztest.Stated{Allow: true}), "client", w.valid())
	assert.Equal(t, http.StatusForbidden, rec.Code, "a machine client is not operator staff")
	testdb.AssertMissing(t, w.tx, "tenants", map[string]any{"slug": "x-new-clinic"})
}

// The request refuses every slug the tenants table's CHECK reserves, with its own field
// error (C208): the Go list and the database's must not drift apart.
func TestFeatureEverySlugTheDatabaseReservesIsRefusedFirst(t *testing.T) {
	w := newCreateWorld(t)
	var def string
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
		WHERE c.conrelid = 'tenants'::regclass AND pg_get_constraintdef(c.oid) LIKE '%''operator''%'`).Scan(&def))
	reserved := regexp.MustCompile(`'([a-z]+)'`).FindAllStringSubmatch(def, -1)
	require.NotEmpty(t, reserved)
	h := createRouter(w, &authztest.Stated{Allow: true})
	for _, m := range reserved {
		b := w.valid()
		b["slug"] = m[1]
		assert.Equal(t, map[string]string{"#/slug": "reserved"}, fieldErrors(t, post(t, h, "user:"+w.staff, b)), m[1])
	}
}
