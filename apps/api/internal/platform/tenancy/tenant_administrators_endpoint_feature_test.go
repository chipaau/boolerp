//go:build feature

package tenancy_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization/authztest"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Endpoint tests (C156) for /api/v1/tenants/{tenantID}/administrators (C228, C230, C231)
// through the real Operator chain and PostgreSQL, with row-level security forced on
// tenants and memberships; authentication and Cerbos are faked. The catalogue's
// control-centre app and its global Administrator are made as the seeds would.

type administratorBody struct {
	ID, Email, Name string
	IsOwner         bool
	InviteExpiresAt *string
}

// newAdministratorsWorld is the addresses' world with Control Centre on in the clinic, and the
// role's id; when live, the clinic is active with one owner, an invitation (owner), whom
// cancelling would leave it without.
func newAdministratorsWorld(t *testing.T, live bool) (aw addressWorld, role, owner string) {
	t.Helper()
	w := newWorld(t)
	aw = addressWorld{world: w, operator: w.operator(t)}
	w.activate(t, aw.operator)
	aw.clinic = w.tenant(t, "x-clinic", "XCLN")
	aw.staff = w.user(t, 1)
	w.member(t, aw.operator, aw.staff, false)
	testdb.Exec(t, w.tx, `INSERT INTO apps (key, name, kind, is_default, is_available)
		VALUES ('control-centre', 'Control Centre', 'workspace', true, true) ON CONFLICT (key) DO NOTHING`)
	testdb.Exec(t, w.tx, `INSERT INTO roles (app_key, key, name) VALUES ('control-centre', $1, 'Administrator')
		ON CONFLICT (key) DO NOTHING`, authorization.ControlCentreAdministrator.Key)
	testdb.Exec(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'control-centre')`, aw.clinic)
	role = testdb.ID(t, w.tx, `SELECT id FROM roles WHERE key = $1`, authorization.ControlCentreAdministrator.Key)
	if live {
		owner = testdb.ID(t, w.tx, `INSERT INTO memberships (tenant_id, invite_email, invite_name, is_owner)
			VALUES ($1, 'owner@x-tenancy.test', 'Owner', true) RETURNING id`, aw.clinic)
		testdb.Exec(t, w.tx, `INSERT INTO tenant_institution_types (tenant_id, institution_type, is_primary)
			VALUES ($1, 'x_tenancy_type', true)`, aw.clinic)
		testdb.Exec(t, w.tx, `UPDATE tenants SET status = 'active', activated_at = now() WHERE id = $1`, aw.clinic)
	}
	w.enforce(t)
	testdb.Exec(t, w.tx, `ALTER TABLE memberships FORCE ROW LEVEL SECURITY`)
	return aw, role, owner
}

func (w addressWorld) adminsPath(rest string) string {
	return "/api/v1/tenants/" + w.clinic + "/administrators" + rest
}

func TestFeatureOperatorStaffInviteATenantsAdministrators(t *testing.T) {
	w, role, _ := newAdministratorsWorld(t, false)
	authz := &authztest.Stated{Allow: true}
	h := addressRouter(w, authz)
	staff := "user:" + w.staff

	rec := call(t, h, http.MethodPost, w.adminsPath(""), staff, map[string]any{"email": "Ali@X-Tenancy.test", "name": " Ali Rasheed ", "isOwner": true})
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var a administratorBody
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &a))
	assert.Equal(t, w.adminsPath("/"+a.ID), rec.Header().Get("Location"))
	assert.Equal(t, "ali@x-tenancy.test", a.Email, "lowercase")
	assert.Equal(t, "Ali Rasheed", a.Name)
	assert.True(t, a.IsOwner)
	assert.Nil(t, a.InviteExpiresAt, "sent when the tenant is activated")
	assert.Equal(t, []string{"list tenancy:tenant"}, authz.Cans)
	require.Len(t, authz.Asked, 1)
	assert.Equal(t, authorization.Resource{Kind: "tenancy:tenant", ID: w.clinic,
		Attributes: map[string]any{"tenant_id": w.clinic, "status": "provisioning"}}, authz.Asked[0])
	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"id": a.ID, "tenant_id": w.clinic, "user_id": nil, "status": "invited",
		"invite_email": "ali@x-tenancy.test", "invite_name": "Ali Rasheed", "is_owner": true, "invited_by": w.staff})
	testdb.AssertHas(t, w.tx, "role_assignments", map[string]any{"membership_id": a.ID, "role_id": role,
		"tenant_id": w.clinic, "assigned_by": w.staff, "active_to": nil})

	// The same address again: the same invitation, still one role.
	rec = call(t, h, http.MethodPost, w.adminsPath(""), staff, map[string]any{"email": "ali@x-tenancy.test", "name": "Ali"})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var again administratorBody
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &again))
	assert.Equal(t, a.ID, again.ID)
	assert.Equal(t, 1, testdb.Count(t, w.tx, "role_assignments", map[string]any{"membership_id": a.ID}))

	require.Equal(t, http.StatusCreated, call(t, h, http.MethodPost, w.adminsPath(""), staff,
		map[string]any{"email": "sara@x-tenancy.test", "name": "Sara"}).Code)
	rec = call(t, h, http.MethodGet, w.adminsPath(""), staff, nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var page struct {
		Items []administratorBody
		Total int
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &page))
	require.Equal(t, 2, page.Total)
	assert.Equal(t, []string{"ali@x-tenancy.test", "sara@x-tenancy.test"}, []string{page.Items[0].Email, page.Items[1].Email}, "oldest first")
}

func TestFeatureOperatorStaffCancelAnInvitation(t *testing.T) {
	w, role, _ := newAdministratorsWorld(t, false)
	h := addressRouter(w, &authztest.Stated{Allow: true})
	staff := "user:" + w.staff
	rec := call(t, h, http.MethodPost, w.adminsPath(""), staff, map[string]any{"email": "ali@x-tenancy.test", "name": "Ali"})
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var a administratorBody
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &a))

	rec = call(t, h, http.MethodDelete, w.adminsPath("/"+a.ID), staff, nil)
	require.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"id": a.ID, "status": "ended"})
	testdb.AssertMissing(t, w.tx, "role_assignments", map[string]any{"membership_id": a.ID, "role_id": role, "active_to": nil})
	assert.Equal(t, http.StatusNotFound, call(t, h, http.MethodDelete, w.adminsPath("/"+a.ID), staff, nil).Code, "already cancelled")
	assert.Equal(t, http.StatusNotFound, call(t, h, http.MethodDelete, w.adminsPath("/not-a-uuid"), staff, nil).Code)
}

func TestFeatureTheLastOwnerOfALiveTenantCannotBeCancelled(t *testing.T) {
	w, _, owner := newAdministratorsWorld(t, true)
	h := addressRouter(w, &authztest.Stated{Allow: true})
	staff := "user:" + w.staff
	testdb.Exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`) // the owner check runs at commit, which a test never reaches

	rec := call(t, h, http.MethodDelete, w.adminsPath("/"+owner), staff, nil)
	assert.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())
	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"id": owner, "status": "invited", "is_owner": true})
}

func TestFeatureTheAdministratorRoutesRefuse(t *testing.T) {
	w, _, _ := newAdministratorsWorld(t, false)
	staff := "user:" + w.staff
	allow := addressRouter(w, &authztest.Stated{Allow: true})

	for name, c := range map[string]struct {
		body map[string]any
		want map[string]string
	}{
		"no address or name": {map[string]any{}, map[string]string{"#/email": "required", "#/name": "required"}},
		"not an address":     {map[string]any{"email": "ali", "name": "Ali"}, map[string]string{"#/email": "email"}},
		"a blank name":       {map[string]any{"email": "ali@x-tenancy.test", "name": " "}, map[string]string{"#/name": "notblank"}},
	} {
		assert.Equal(t, c.want, fieldErrors(t, call(t, allow, http.MethodPost, w.adminsPath(""), staff, c.body)), name)
	}
	assert.Equal(t, http.StatusNotFound, call(t, allow, http.MethodGet,
		"/api/v1/tenants/0192f6a0-0000-7000-8000-000000000000/administrators", staff, nil).Code, "no such tenant")

	deny := addressRouter(w, &authztest.Stated{Allow: false})
	for _, c := range []struct{ method, path string }{
		{http.MethodGet, w.adminsPath("")}, {http.MethodPost, w.adminsPath("")}, {http.MethodDelete, w.adminsPath("/x")},
	} {
		assert.Equal(t, http.StatusForbidden, call(t, deny, c.method, c.path, staff,
			map[string]any{"email": "ali@x-tenancy.test", "name": "Ali"}).Code, c.method)
	}

	// Control Centre off: there is nothing to administer, so no one is invited.
	testdb.Exec(t, w.tx, `UPDATE tenant_apps SET active_to = now() WHERE tenant_id = $1 AND app_key = 'control-centre'`, w.clinic)
	assert.Equal(t, http.StatusConflict, call(t, allow, http.MethodPost, w.adminsPath(""), staff,
		map[string]any{"email": "ali@x-tenancy.test", "name": "Ali"}).Code)
	testdb.AssertMissing(t, w.tx, "memberships", map[string]any{"tenant_id": w.clinic, "invite_email": "ali@x-tenancy.test"})
}
