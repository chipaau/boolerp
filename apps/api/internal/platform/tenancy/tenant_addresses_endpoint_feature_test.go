//go:build feature

package tenancy_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization/authztest"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
	"github.com/boolmv/erp/apps/api/internal/platform/reference"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy"
)

// Endpoint tests (C156) for /api/v1/tenants/{tenantID}/addresses (C217) through the real
// Operator chain and PostgreSQL, with row-level security forced on tenants and their
// addresses; authentication, Cerbos, and the reference lists (CheckAddress, PlacePath) are
// faked. CheckAddress's own rules are the reference module's tests.

func (l lists) CheckAddress(_ context.Context, _, _ string, _ map[string]string) error {
	if l.down {
		return errDown
	}
	return l.address
}

func (l lists) PlacePath(_ context.Context, id string) ([]reference.Geography, error) {
	if l.down {
		return nil, errDown
	}
	return l.paths[id], nil
}

type addressWorld struct {
	*world
	operator, staff, clinic, north string
	lists                          lists
}

func newAddressWorld(t *testing.T) addressWorld {
	t.Helper()
	w := newWorld(t)
	aw := addressWorld{world: w, operator: w.operator(t)}
	w.activate(t, aw.operator)
	aw.north, _ = w.addPlaces(t)
	aw.clinic = w.tenant(t, "x-clinic", "XCLN")
	aw.staff = w.user(t, 1)
	w.member(t, aw.operator, aw.staff, false)
	w.enforce(t)
	testdb.Exec(t, w.tx, `ALTER TABLE tenant_addresses FORCE ROW LEVEL SECURITY`)
	name := "North"
	aw.lists = lists{paths: map[string][]reference.Geography{
		aw.north: {{ID: aw.north, Type: "region", TypeName: "Region", Level: 1, Name: name}},
	}}
	return aw
}

func addressRouter(w addressWorld, authz authorization.Authorizer) http.Handler {
	logger := slog.New(slog.DiscardHandler)
	m := tenancy.New(testdb.Savepoints{Tx: w.tx}, w.lists, logger)
	s := chainParts(w.world, m, logger).Services(nil, authz, logger)
	r := chi.NewRouter()
	r.Route("/api/v1/tenants", m.TenantsRoutes(s))
	return r
}

func call(t *testing.T, h http.Handler, method, path, token string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var b []byte
	if body != nil {
		var err error
		b, err = json.Marshal(body)
		require.NoError(t, err)
	}
	r := httptest.NewRequest(method, path, bytes.NewReader(b))
	r.Host = "admin.x-tenancy.test"
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, r)
	return rec
}

type addressBody struct {
	Kind, Country, Line1           string
	GeographyID, Line2, PostalCode *string
	Places                         []reference.Geography
	TypedPlaces                    map[string]string
	Latitude, Longitude            *float64
	UpdatedAt                      string
}

func (w addressWorld) path(kind string) string {
	return "/api/v1/tenants/" + w.clinic + "/addresses" + kind
}

func (w addressWorld) registered() map[string]any {
	return map[string]any{"country": "XT", "geographyId": w.north, "typedPlaces": map[string]string{"town": " Harbour "},
		"line1": " H. Sosun Villa, Sosun Magu ", "line2": "3rd floor", "postalCode": "20026", "latitude": 4.175, "longitude": 73.509}
}

func TestFeatureOperatorStaffSetATenantsAddress(t *testing.T) {
	w := newAddressWorld(t)
	authz := &authztest.Stated{Allow: true}
	h := addressRouter(w, authz)
	staff := "user:" + w.staff

	rec := call(t, h, http.MethodPut, w.path("/registered"), staff, w.registered())
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, w.path("/registered"), rec.Header().Get("Location"))
	var a addressBody
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &a))
	assert.Equal(t, "registered", a.Kind)
	assert.Equal(t, "H. Sosun Villa, Sosun Magu", a.Line1, "trimmed")
	assert.Equal(t, map[string]string{"town": "Harbour"}, a.TypedPlaces)
	require.Len(t, a.Places, 1)
	assert.Equal(t, "North", a.Places[0].Name, "its places, named")
	assert.Equal(t, []string{"list tenancy:tenant"}, authz.Cans, "first whether they may know of tenants")
	require.Len(t, authz.Asked, 1)
	assert.Equal(t, authorization.Resource{Kind: "tenancy:tenant", ID: w.clinic,
		Attributes: map[string]any{"tenant_id": w.clinic, "status": "provisioning"}}, authz.Asked[0], "Cerbos decides on the tenant")
	testdb.AssertHas(t, w.tx, "tenant_addresses", map[string]any{"tenant_id": w.clinic, "kind": "registered",
		"geography_id": w.north, "line1": "H. Sosun Villa, Sosun Magu", "line2": "3rd floor", "postal_code": "20026"})

	// The same PUT again replaces it: 200, and only what was sent is kept.
	rec = call(t, h, http.MethodPut, w.path("/registered"), staff, map[string]any{"country": "XT", "line1": "PO Box 9"})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	a = addressBody{}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &a))
	assert.Nil(t, a.GeographyID)
	assert.Empty(t, a.Places)
	assert.Empty(t, a.TypedPlaces)
	assert.Nil(t, a.Latitude)
	testdb.AssertHas(t, w.tx, "tenant_addresses", map[string]any{"tenant_id": w.clinic, "kind": "registered", "line1": "PO Box 9"})
	testdb.AssertMissing(t, w.tx, "tenant_addresses", map[string]any{"tenant_id": w.clinic, "line1": "H. Sosun Villa, Sosun Magu"})

	rec = call(t, h, http.MethodPut, w.path("/mailing"), staff, w.registered())
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	rec = call(t, h, http.MethodGet, w.path(""), staff, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var page struct {
		Items []addressBody
		Total int
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &page))
	require.Equal(t, 2, page.Total)
	assert.Equal(t, []string{"registered", "mailing"}, []string{page.Items[0].Kind, page.Items[1].Kind}, "registered first")
	assert.Equal(t, "North", page.Items[1].Places[0].Name)
}

func TestFeatureOperatorStaffRemoveAMailingAddress(t *testing.T) {
	w := newAddressWorld(t)
	h := addressRouter(w, &authztest.Stated{Allow: true})
	staff := "user:" + w.staff
	require.Equal(t, http.StatusCreated, call(t, h, http.MethodPut, w.path("/mailing"), staff, w.registered()).Code)

	rec := call(t, h, http.MethodDelete, w.path("/mailing"), staff, nil)
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	testdb.AssertMissing(t, w.tx, "tenant_addresses", map[string]any{"tenant_id": w.clinic, "kind": "mailing"})
	assert.Equal(t, http.StatusNotFound, call(t, h, http.MethodDelete, w.path("/mailing"), staff, nil).Code, "none left")
}

func TestFeatureAnAddressBreakingItsRulesIsRefused(t *testing.T) {
	w := newAddressWorld(t)
	staff := "user:" + w.staff
	h := addressRouter(w, &authztest.Stated{Allow: true})
	for name, c := range map[string]struct {
		body map[string]any
		want map[string]string
	}{
		"no line1, a bad country and place": {map[string]any{"country": "xt", "geographyId": "north"},
			map[string]string{"#/line1": "required", "#/country": "uppercase", "#/geographyId": "uuid"}},
		"a latitude alone": {map[string]any{"country": "XT", "line1": "Line", "latitude": 4.1},
			map[string]string{"#/longitude": "required_with"}},
		"a latitude past 90": {map[string]any{"country": "XT", "line1": "Line", "latitude": 91, "longitude": 73},
			map[string]string{"#/latitude": "max"}},
		"a blank typed place": {map[string]any{"country": "XT", "line1": "Line", "typedPlaces": map[string]string{"town": " "}},
			map[string]string{"#/typedPlaces/town": "notblank"}},
	} {
		rec := call(t, h, http.MethodPut, w.path("/registered"), staff, c.body)
		assert.Equal(t, c.want, fieldErrors(t, rec), name)
	}

	// What the reference module finds is the answer, as it says it.
	w.lists.address = problem.Invalid("typedPlaces/town", "required", "is required: Town is typed")
	rec := call(t, addressRouter(w, &authztest.Stated{Allow: true}), http.MethodPut, w.path("/registered"), staff,
		map[string]any{"country": "XT", "line1": "Line"})
	assert.Equal(t, map[string]string{"#/typedPlaces/town": "required"}, fieldErrors(t, rec))
	testdb.AssertMissing(t, w.tx, "tenant_addresses", map[string]any{"tenant_id": w.clinic})
}

func TestFeatureTheAddressRoutesRefuse(t *testing.T) {
	w := newAddressWorld(t)
	staff := "user:" + w.staff
	allow := addressRouter(w, &authztest.Stated{Allow: true})

	assert.Equal(t, http.StatusNotFound, call(t, allow, http.MethodPut, w.path("/billing"), staff, w.registered()).Code,
		"no such kind")
	assert.Equal(t, http.StatusNotFound, call(t, allow, http.MethodPut,
		"/api/v1/tenants/0192f6a0-0000-7000-8000-000000000000/addresses/registered", staff, w.registered()).Code, "no such tenant")
	assert.Equal(t, http.StatusNotFound, call(t, allow, http.MethodGet, "/api/v1/tenants/not-a-uuid/addresses", staff, nil).Code)

	deny := addressRouter(w, &authztest.Stated{Allow: false})
	for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
		path := w.path("/registered")
		if method == http.MethodGet {
			path = w.path("")
		}
		assert.Equal(t, http.StatusForbidden, call(t, deny, method, path, staff, w.registered()).Code, method)
	}
	testdb.AssertMissing(t, w.tx, "tenant_addresses", map[string]any{"tenant_id": w.clinic})

	w.lists.down = true
	down := addressRouter(w, &authztest.Stated{Allow: true})
	assert.Equal(t, http.StatusServiceUnavailable, call(t, down, http.MethodPut, w.path("/registered"), staff, w.registered()).Code)
	testdb.AssertMissing(t, w.tx, "tenant_addresses", map[string]any{"tenant_id": w.clinic})
}

func TestFeatureSettingAnAddressOutsideHTTPChecksItsKind(t *testing.T) {
	w := newAddressWorld(t)
	m := tenancy.New(testdb.Savepoints{Tx: w.tx}, w.lists, slog.New(slog.DiscardHandler))
	_, _, err := m.SetAddress(t.Context(), w.clinic, tenancy.Address{Kind: "billing", Country: "XT", Line1: "Line"})
	var invalid *problem.ValidationError
	require.ErrorAs(t, err, &invalid)
	assert.Equal(t, "kind", invalid.Errors[0].Pointer[2:])
}
