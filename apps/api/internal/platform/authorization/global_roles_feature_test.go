//go:build feature

package authorization_test

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization/seeds"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

// Feature tests (C79) for global roles from code, the team's roles, and a membership's
// capabilities (C177), in the owner's rolled-back transaction.

var xConsole = authorization.App{Key: "x-console", Name: "Test console", Kind: authorization.Operator,
	Capabilities: []authorization.Capability{{Key: "x-t:tenant:view", Name: "View"}, {Key: "x-t:tenant:manage", Name: "Manage"}}}

func seedEnv() seed.Env { return seed.NewEnv("test", slog.New(slog.DiscardHandler)) }

func roleCaps(t *testing.T, tx pgx.Tx, key string) []string {
	t.Helper()
	rows, err := tx.Query(t.Context(), `SELECT rc.capability FROM role_capabilities rc JOIN roles r ON r.id = rc.role_id
		WHERE r.key = $1 ORDER BY 1`, key)
	require.NoError(t, err)
	caps, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return caps
}

func TestFeatureTheRolesSeederMirrorsGlobalRoles(t *testing.T) {
	tx := testdb.OwnerTx(t)
	seedApps(t, tx, xConsole)
	require.NoError(t, seeds.NewCapabilities(tx, []authorization.App{xConsole}).Run(t.Context(), seedEnv()))
	admin := authorization.Role{Key: "x-console.admin", App: "x-console", Name: "Administrator",
		Capabilities: []string{"x-t:tenant:view", "x-t:tenant:manage"}}
	viewer := authorization.Role{Key: "x-console.viewer", App: "x-console", Name: "Viewer", Capabilities: []string{"x-t:tenant:view"}}
	s := seeds.NewRoles(tx, []authorization.Role{admin, viewer}, []authorization.App{xConsole})
	assert.Equal(t, "authorization.roles", s.Name())
	require.NoError(t, s.Run(t.Context(), seedEnv()))
	require.NoError(t, s.Run(t.Context(), seedEnv()), "running again is fine")

	testdb.AssertHas(t, tx, "roles", map[string]any{"key": "x-console.admin", "tenant_id": nil, "name": "Administrator", "archived_at": nil})
	assert.Equal(t, []string{"x-t:tenant:manage", "x-t:tenant:view"}, roleCaps(t, tx, "x-console.admin"))
	assert.Equal(t, []string{"x-t:tenant:view"}, roleCaps(t, tx, "x-console.viewer"))

	// Renamed, and a capability moved: the same row, its capabilities matching the code.
	admin.Name, admin.Capabilities = "Console administrator", []string{"x-t:tenant:manage"}
	require.NoError(t, seeds.NewRoles(tx, []authorization.Role{admin}, []authorization.App{xConsole}).Run(t.Context(), seedEnv()))
	testdb.AssertHas(t, tx, "roles", map[string]any{"key": "x-console.admin", "name": "Console administrator"})
	assert.Equal(t, 1, testdb.Count(t, tx, "roles", map[string]any{"key": "x-console.admin"}))
	assert.Equal(t, []string{"x-t:tenant:manage"}, roleCaps(t, tx, "x-console.admin"))
	testdb.AssertMissing(t, tx, "roles", map[string]any{"key": "x-console.viewer", "archived_at": nil})

	// Declared again: unarchived; with no capabilities: none.
	viewer.Capabilities = nil
	require.NoError(t, seeds.NewRoles(tx, []authorization.Role{admin, viewer}, []authorization.App{xConsole}).Run(t.Context(), seedEnv()))
	testdb.AssertHas(t, tx, "roles", map[string]any{"key": "x-console.viewer", "archived_at": nil})
	assert.Empty(t, roleCaps(t, tx, "x-console.viewer"))
}

func TestFeatureTheRolesSeederRefusesABadCatalogue(t *testing.T) {
	tx := testdb.OwnerTx(t)
	apps := []authorization.App{xConsole}
	for name, roles := range map[string][]authorization.Role{
		"a key of another app":      {{Key: "x-other.admin", App: "x-console", Name: "A"}},
		"a key without a name part": {{Key: "x-console", App: "x-console", Name: "A"}},
		"an app not in the edition": {{Key: "x-nope.admin", App: "x-nope", Name: "A"}},
		"twice":                     {{Key: "x-console.a", App: "x-console", Name: "A"}, {Key: "x-console.a", App: "x-console", Name: "B"}},
		"a repeated name":           {{Key: "x-console.a", App: "x-console", Name: "Same"}, {Key: "x-console.b", App: "x-console", Name: "same"}},
		"a blank name":              {{Key: "x-console.a", App: "x-console", Name: " "}},
		"another app's capability":  {{Key: "x-console.a", App: "x-console", Name: "A", Capabilities: []string{"x-hrms:employee:view"}}},
	} {
		assert.Error(t, seeds.NewRoles(tx, roles, apps).Run(t.Context(), seedEnv()), name)
	}
}

// capsWorldFor is tenant A with x-hr on, a member, the global x-hr.admin granting view,
// and A's own role granting manage, each assigned to the member.
type capsFixture struct {
	appsWorld
	member, global, mine string
}

func newCapsFixture(t *testing.T) capsFixture {
	t.Helper()
	w, global, mine := capsWorld(t)
	user := id(t, w.tx, `INSERT INTO users (kratos_identity_id, email, phone) VALUES ('0192f6a0-0000-7000-8000-0000000ac0a1',
		'x-authz-caps@example.test', '+9990000000') RETURNING id`)
	f := capsFixture{appsWorld: w, global: global, mine: mine,
		member: id(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, status, joined_at) VALUES ($1, $2, 'active', now()) RETURNING id`, w.a, user)}
	exec(t, w.tx, `INSERT INTO role_capabilities (role_id, capability) VALUES ($1, 'x-hrms:employee:view'), ($2, 'x-hrms:employee:manage')`, global, mine)
	exec(t, w.tx, `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ($1, $2, $3), ($1, $2, $4)`, w.a, f.member, global, mine)
	return f
}

// loadCaps runs LoadCapabilities for the membership in tenant A, inside the test's
// transaction, and returns what it put in the context and the status.
func loadCaps(t *testing.T, f capsFixture) ([]string, int) {
	t.Helper()
	var got []string
	h := authorization.LoadCapabilities(savepoints{f.tx}, slog.New(slog.DiscardHandler))(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) { got = authorization.CapabilitiesFrom(r.Context()) }))
	ctx := tenant.WithMembership(tenant.With(context.Background(), tenant.Tenant{ID: f.a}), tenant.Membership{ID: f.member})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx))
	return got, rec.Code
}

// savepoints lets tenant.ReadTx begin its transaction inside the test's.
type savepoints struct{ pgx.Tx }

func (s savepoints) BeginTx(ctx context.Context, _ pgx.TxOptions) (pgx.Tx, error) {
	return s.Begin(ctx)
}

func TestFeatureAMembershipsCapabilities(t *testing.T) {
	f := newCapsFixture(t)
	got, code := loadCaps(t, f)
	require.Equal(t, http.StatusOK, code)
	assert.Equal(t, []string{"x-hrms:employee:manage", "x-hrms:employee:view"}, got, "global and own roles together")

	steps := []struct {
		name, sql string
		want      []string
	}{
		{"an archived role grants nothing", `UPDATE roles SET archived_at = now() WHERE id = '` + f.mine + `'`, []string{"x-hrms:employee:view"}},
		{"a retired capability counts for nothing", `UPDATE capabilities SET active_to = now() WHERE key = 'x-hrms:employee:view'`, nil},
	}
	for _, s := range steps {
		exec(t, f.tx, s.sql)
		got, _ = loadCaps(t, f)
		if s.want == nil {
			assert.Empty(t, got, s.name)
			continue
		}
		assert.Equal(t, s.want, got, s.name)
	}
}

func TestFeatureAssignmentsCountOnlyWhileLiveAndTheAppIsOn(t *testing.T) {
	f := newCapsFixture(t)
	exec(t, f.tx, `UPDATE role_assignments SET active_to = now() WHERE role_id = $1`, f.mine) // revoked
	got, _ := loadCaps(t, f)
	assert.Equal(t, []string{"x-hrms:employee:view"}, got, "a revoked assignment grants nothing")

	exec(t, f.tx, `INSERT INTO role_assignments (tenant_id, membership_id, role_id, active_from) VALUES ($1, $2, $3, now() + interval '7 days')`,
		f.a, f.member, f.mine)
	got, _ = loadCaps(t, f)
	assert.Equal(t, []string{"x-hrms:employee:view"}, got, "an acting appointment starting next week grants nothing yet")

	exec(t, f.tx, `UPDATE tenant_apps SET active_to = now() WHERE tenant_id = $1 AND app_key = 'x-hr'`, f.a)
	got, _ = loadCaps(t, f)
	assert.Empty(t, got, "the app is off: its roles grant nothing")
}

func TestFeatureLoadCapabilitiesWithoutAMembership(t *testing.T) {
	called := false
	h := authorization.LoadCapabilities(nil, slog.New(slog.DiscardHandler))(http.HandlerFunc(
		func(_ http.ResponseWriter, r *http.Request) {
			called = authorization.CapabilitiesFrom(r.Context()) == nil
		}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	assert.True(t, called, "no membership: no capabilities, and no query")
}

func TestFeatureTheTeamRolesSeeder(t *testing.T) {
	w := newAppsWorld(t)
	exec(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-console')`, w.operator)
	role := id(t, w.tx, `INSERT INTO roles (app_key, key, name) VALUES ('x-console', 'x-console.admin', 'Administrator') RETURNING id`)
	for i, email := range []string{"x-team-1@example.test", "X-Team-2@example.test"} {
		u := id(t, w.tx, `INSERT INTO users (kratos_identity_id, email, phone) VALUES ($1, $2, '+9990000000') RETURNING id`,
			[]string{"0192f6a0-0000-7000-8000-0000000ae001", "0192f6a0-0000-7000-8000-0000000ae002"}[i], email)
		exec(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, status, joined_at) VALUES ($1, $2, 'active', now())`, w.operator, u)
	}
	s := seeds.NewTeamRoles(w.tx, []string{"x-team-1@example.test", "x-team-2@example.test"}, "x-console.admin")
	assert.Equal(t, "authorization.team_roles", s.Name())
	require.NoError(t, s.Run(t.Context(), seedEnv()))
	require.NoError(t, s.Run(t.Context(), seedEnv()), "running again is fine")
	assert.Equal(t, 2, testdb.Count(t, w.tx, "role_assignments", map[string]any{"role_id": role}))

	// A revoked assignment is an operator's decision: left as it is.
	exec(t, w.tx, `UPDATE role_assignments SET active_to = now() WHERE role_id = $1`, role)
	require.NoError(t, s.Run(t.Context(), seedEnv()))
	assert.Equal(t, 2, testdb.Count(t, w.tx, "role_assignments", map[string]any{"role_id": role}))
	testdb.AssertMissing(t, w.tx, "role_assignments", map[string]any{"role_id": role, "active_to": nil})

	err := seeds.NewTeamRoles(w.tx, []string{"x-nobody@example.test"}, "x-console.admin").Run(t.Context(), seedEnv())
	require.ErrorContains(t, err, "team member 1")
	assert.NotContains(t, err.Error(), "x-nobody", "the email is personal data")
	assert.ErrorContains(t, seeds.NewTeamRoles(w.tx, nil, "x-console.none").Run(t.Context(), seedEnv()), "x-console.none")
}
