//go:build feature

package tenancy_test

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization/authztest"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

// Endpoint tests (C156) for /api/v1/tenants/{tenantID}/apps (C224) through the real Operator
// chain and PostgreSQL, with authentication and Cerbos faked, over test apps of each kind:
// a default one, an optional one, an operator one, and a retired one.

type tenantAppBody struct {
	Key, Name, Kind string
	IsDefault, On   bool
	ActiveFrom      *string
}

func newTenantAppsWorld(t *testing.T) addressWorld {
	t.Helper()
	w := newAddressWorld(t)
	testdb.Exec(t, w.tx, `INSERT INTO apps (key, name, kind, is_default) VALUES
		('x-tcal', 'Test calendar', 'workspace', true), ('x-thr', 'Test HR', 'workspace', false),
		('x-tconsole', 'Test console', 'operator', false), ('x-tgone', 'Gone', 'workspace', false)`)
	testdb.Exec(t, w.tx, `UPDATE apps SET active_to = now() WHERE key = 'x-tgone'`)
	testdb.Exec(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-tcal')`, w.clinic)
	return w
}

func (w addressWorld) appsPath(key string) string {
	return "/api/v1/tenants/" + w.clinic + "/apps" + key
}

// testApps reads a tenant's apps, keeping the test's.
func testApps(t *testing.T, h http.Handler, path, token string) []tenantAppBody {
	t.Helper()
	rec := call(t, h, http.MethodGet, path+"?pageSize=100", token, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var page struct{ Items []tenantAppBody }
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &page))
	out := []tenantAppBody{}
	for _, a := range page.Items {
		if strings.HasPrefix(a.Key, "x-t") {
			out = append(out, a)
		}
	}
	return out
}

func TestFeatureOperatorStaffListATenantsApps(t *testing.T) {
	w := newTenantAppsWorld(t)
	authz := &authztest.Stated{Allow: true}
	h := addressRouter(w, authz)
	staff := "user:" + w.staff

	apps := testApps(t, h, w.appsPath(""), staff)
	require.Len(t, apps, 2, "no operator app for a customer, no retired one")
	assert.Equal(t, "x-tcal", apps[0].Key, "the default apps first")
	assert.True(t, apps[0].IsDefault)
	assert.True(t, apps[0].On, "on since it was created")
	assert.NotNil(t, apps[0].ActiveFrom)
	assert.Equal(t, "x-thr", apps[1].Key)
	assert.False(t, apps[1].On)
	assert.Nil(t, apps[1].ActiveFrom)
	assert.Equal(t, []string{"list tenancy:tenant"}, authz.Cans)
	require.Len(t, authz.Asked, 1)
	assert.Equal(t, authorization.Resource{Kind: "tenancy:tenant", ID: w.clinic,
		Attributes: map[string]any{"tenant_id": w.clinic, "status": "provisioning"}}, authz.Asked[0])

	// The operator tenant may also have the operator's apps.
	keys := []string{}
	for _, a := range testApps(t, h, "/api/v1/tenants/"+w.operator+"/apps", staff) {
		keys = append(keys, a.Key)
	}
	assert.Equal(t, []string{"x-tcal", "x-tconsole", "x-thr"}, keys)
}

func TestFeatureOperatorStaffTurnATenantsAppsOnAndOff(t *testing.T) {
	w := newTenantAppsWorld(t)
	h := addressRouter(w, &authztest.Stated{Allow: true})
	staff := "user:" + w.staff

	rec := call(t, h, http.MethodPut, w.appsPath("/x-thr"), staff, nil)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	assert.Equal(t, w.appsPath("/x-thr"), rec.Header().Get("Location"))
	var a tenantAppBody
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &a))
	assert.True(t, a.On)
	testdb.AssertHas(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.clinic, "app_key": "x-thr",
		"activated_by": w.staff, "active_to": nil})

	rec = call(t, h, http.MethodPut, w.appsPath("/x-thr"), staff, nil)
	require.Equal(t, http.StatusOK, rec.Code, "already on: left as it is")
	assert.Equal(t, "1", testdb.ID(t, w.tx, `SELECT count(*)::text FROM tenant_apps
		WHERE tenant_id = $1 AND app_key = 'x-thr'`, w.clinic), "one activation")

	// Off, a default app included; on again is a new activation.
	for _, key := range []string{"x-thr", "x-tcal"} {
		rec = call(t, h, http.MethodDelete, w.appsPath("/"+key), staff, nil)
		require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
		testdb.AssertMissing(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.clinic, "app_key": key, "active_to": nil})
	}
	assert.Equal(t, http.StatusNotFound, call(t, h, http.MethodDelete, w.appsPath("/x-thr"), staff, nil).Code, "already off")
	for _, a := range testApps(t, h, w.appsPath(""), staff) {
		assert.False(t, a.On, a.Key)
	}
	require.Equal(t, http.StatusCreated, call(t, h, http.MethodPut, w.appsPath("/x-thr"), staff, nil).Code)
	assert.Equal(t, "2", testdb.ID(t, w.tx, `SELECT count(*)::text FROM tenant_apps
		WHERE tenant_id = $1 AND app_key = 'x-thr'`, w.clinic), "the ended one is history")
}

func TestFeatureTheTenantAppRoutesRefuse(t *testing.T) {
	w := newTenantAppsWorld(t)
	staff := "user:" + w.staff
	allow := addressRouter(w, &authztest.Stated{Allow: true})

	for name, key := range map[string]string{"unknown": "x-tnope", "retired": "x-tgone", "an operator app": "x-tconsole"} {
		assert.Equal(t, http.StatusNotFound, call(t, allow, http.MethodPut, w.appsPath("/"+key), staff, nil).Code, name)
	}
	assert.Equal(t, http.StatusNotFound, call(t, allow, http.MethodGet,
		"/api/v1/tenants/0192f6a0-0000-7000-8000-000000000000/apps", staff, nil).Code, "no such tenant")

	deny := addressRouter(w, &authztest.Stated{Allow: false})
	for _, c := range []struct{ method, path string }{
		{http.MethodGet, w.appsPath("")}, {http.MethodPut, w.appsPath("/x-thr")}, {http.MethodDelete, w.appsPath("/x-tcal")},
	} {
		assert.Equal(t, http.StatusForbidden, call(t, deny, c.method, c.path, staff, nil).Code, c.method)
	}
	testdb.AssertMissing(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.clinic, "app_key": "x-thr"})
	testdb.AssertHas(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.clinic, "app_key": "x-tcal", "active_to": nil})
}

func TestFeatureTurningAnAppOnOutsideHTTPChecksTheApp(t *testing.T) {
	w := newTenantAppsWorld(t)
	m := tenancy.New(testdb.Savepoints{Tx: w.tx}, w.lists, slog.New(slog.DiscardHandler))
	ctx := tenant.With(t.Context(), tenant.Tenant{ID: w.operator, IsOperator: true})
	_, _, err := m.TurnOnApp(ctx, w.clinic, "x-tconsole")
	require.ErrorIs(t, err, tenancy.ErrNoApp, "an operator app for a customer")
	a, on, err := m.TurnOnApp(ctx, w.clinic, "x-thr")
	require.NoError(t, err)
	assert.True(t, on)
	assert.Equal(t, "Test HR", a.Name)
	testdb.AssertMissing(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.clinic, "app_key": "x-tconsole"})
}
