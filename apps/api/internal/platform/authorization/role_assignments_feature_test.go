//go:build feature

package authorization_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Feature tests (C79) for role_assignments (C170): members of tenants A and B, the
// global x-hr.admin, and each tenant's own role.

type assignWorld struct {
	appsWorld
	global, mineA, mineB, memberA, memberB string
}

func newAssignWorld(t *testing.T) assignWorld {
	t.Helper()
	w := assignWorld{appsWorld: rolesWorld(t)}
	testdb.Exec(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-hr')`, w.b)
	w.global = testdb.ID(t, w.tx, `SELECT id FROM roles WHERE key = 'x-hr.admin'`)
	w.mineA = testdb.ID(t, w.tx, `INSERT INTO roles (tenant_id, app_key, name) VALUES ($1, 'x-hr', 'A clerk') RETURNING id`, w.a)
	w.mineB = testdb.ID(t, w.tx, `INSERT INTO roles (tenant_id, app_key, name) VALUES ($1, 'x-hr', 'B clerk') RETURNING id`, w.b)
	user := func(n string) string {
		return testdb.ID(t, w.tx, `INSERT INTO users (kratos_identity_id, email, phone) VALUES ($1, $2, '+9990000000') RETURNING id`,
			"0192f6a0-0000-7000-8000-0000000a"+n, "x-authz-"+n+"@example.test")
	}
	w.memberA = testdb.ID(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, status, joined_at) VALUES ($1, $2, 'active', now()) RETURNING id`, w.a, user("0001"))
	w.memberB = testdb.ID(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, status, joined_at) VALUES ($1, $2, 'active', now()) RETURNING id`, w.b, user("0002"))
	return w
}

func TestFeatureRoleAssignmentRules(t *testing.T) {
	w := newAssignWorld(t)
	g := testdb.ID(t, w.tx, `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ($1, $2, $3) RETURNING id`, w.a, w.memberA, w.global)
	testdb.ID(t, w.tx, `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ($1, $2, $3) RETURNING id`, w.a, w.memberA, w.mineA)
	testdb.Exec(t, w.tx, `UPDATE roles SET archived_at = now() WHERE id = $1`, w.mineB)

	ins := `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ('`
	for name, sql := range map[string]string{
		"a member of another tenant": ins + w.a + `', '` + w.memberB + `', '` + w.global + `')`,
		"another tenant's role":      ins + w.a + `', '` + w.memberA + `', '` + w.mineB + `')`,
		"an archived role":           ins + w.b + `', '` + w.memberB + `', '` + w.mineB + `')`,
		"the same role twice":        ins + w.a + `', '` + w.memberA + `', '` + w.global + `')`,
		"moving it to a membership":  `UPDATE role_assignments SET membership_id = '` + w.memberB + `' WHERE id = '` + g + `'`,
		"changing its role":          `UPDATE role_assignments SET role_id = '` + w.mineA + `' WHERE id = '` + g + `'`,
	} {
		_, err := testdb.Savepoint(t, w.tx, sql)
		assert.Error(t, err, name)
	}

	// An app turned off: its roles cannot be newly assigned.
	testdb.Exec(t, w.tx, `UPDATE tenant_apps SET active_to = now() WHERE tenant_id = $1 AND app_key = 'x-hr'`, w.b)
	testdb.Exec(t, w.tx, `UPDATE roles SET archived_at = NULL WHERE id = $1`, w.mineB)
	_, err := testdb.Savepoint(t, w.tx, ins+w.b+`', '`+w.memberB+`', '`+w.global+`')`)
	assert.Error(t, err, "the app is off in B")

	// Revoked, then given again: a new row; the ended one is frozen.
	testdb.Exec(t, w.tx, `UPDATE role_assignments SET active_to = now() WHERE id = $1`, g)
	testdb.ID(t, w.tx, `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ($1, $2, $3) RETURNING id`, w.a, w.memberA, w.global)
	_, err = testdb.Savepoint(t, w.tx, `UPDATE role_assignments SET active_to = NULL WHERE id = $1`, g)
	assert.Equal(t, "23514", testdb.PgCode(err))
	assert.Equal(t, 2, testdb.Count(t, w.tx, "role_assignments", map[string]any{"membership_id": w.memberA, "role_id": w.global}))
}

func TestFeatureRoleAssignmentPolicies(t *testing.T) {
	w := newAssignWorld(t)
	testdb.Exec(t, w.tx, `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ($1, $2, $3), ($4, $5, $3)`,
		w.a, w.memberA, w.global, w.b, w.memberB)
	testdb.Exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
	testdb.Exec(t, w.tx, `ALTER TABLE role_assignments FORCE ROW LEVEL SECURITY`)
	testdb.Exec(t, w.tx, `SELECT set_config('app.tenant_id', $1, true)`, w.a)

	var n int
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT count(*) FROM role_assignments WHERE role_id = $1`, w.global).Scan(&n))
	assert.Equal(t, 1, n, "its own only")
	testdb.Exec(t, w.tx, `INSERT INTO role_assignments (membership_id, role_id) VALUES ($1, $2)`, w.memberA, w.mineA) // tenant_id defaults
	testdb.AssertHas(t, w.tx, "role_assignments", map[string]any{"tenant_id": w.a, "role_id": w.mineA})
	_, err := testdb.Savepoint(t, w.tx, `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ($1, $2, $3)`, w.b, w.memberB, w.mineB)
	assert.Equal(t, "42501", testdb.PgCode(err), "not in another tenant")
	tag, err := testdb.Savepoint(t, w.tx, `UPDATE role_assignments SET active_to = now() WHERE tenant_id = $1`, w.b)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nor revokes there")
	tag, err = testdb.Savepoint(t, w.tx, `DELETE FROM role_assignments WHERE tenant_id = $1`, w.a)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nothing deletes an assignment")
}

// controlCentreAdministrator ensures the catalogue's control-centre app and its global
// Administrator (the code's, C228) exist in the test's transaction, as the seeds would make
// them, turns the app on in tenant, and returns the role's id.
func (w assignWorld) controlCentreAdministrator(t *testing.T, tenant string) string {
	t.Helper()
	testdb.Exec(t, w.tx, `INSERT INTO apps (key, name, kind, is_default, is_available)
		VALUES ('control-centre', 'Control Centre', 'workspace', true, true) ON CONFLICT (key) DO NOTHING`)
	testdb.Exec(t, w.tx, `INSERT INTO roles (app_key, key, name) VALUES ('control-centre', $1, 'Administrator')
		ON CONFLICT (key) DO NOTHING`, authorization.ControlCentreAdministrator.Key)
	testdb.Exec(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) SELECT $1, 'control-centre'
		WHERE NOT EXISTS (SELECT 1 FROM tenant_apps WHERE tenant_id = $1 AND app_key = 'control-centre' AND active_to IS NULL)`, tenant)
	return testdb.ID(t, w.tx, `SELECT id FROM roles WHERE key = $1`, authorization.ControlCentreAdministrator.Key)
}

// The operator hands a tenant's administrators Control Centre's Administrator (C228), and no
// other role outside its own tenant.
func TestFeatureTheOperatorAssignsOnlyControlCentresAdministratorElsewhere(t *testing.T) {
	w := newAssignWorld(t)
	admin := w.controlCentreAdministrator(t, w.b)
	testdb.Exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
	testdb.Exec(t, w.tx, `ALTER TABLE role_assignments FORCE ROW LEVEL SECURITY`)
	testdb.Exec(t, w.tx, `SELECT set_config('app.tenant_id', $1, true)`, w.operator)

	ins := `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ($1, $2, $3)`
	given := testdb.ID(t, w.tx, ins+` RETURNING id`, w.b, w.memberB, admin)
	testdb.AssertHas(t, w.tx, "role_assignments", map[string]any{"id": given, "tenant_id": w.b})
	for name, role := range map[string]string{"a global role of another app": w.global, "the tenant's own role": w.mineB} {
		_, err := testdb.Savepoint(t, w.tx, ins, w.b, w.memberB, role)
		assert.Equal(t, "42501", testdb.PgCode(err), name)
	}
	tag, err := testdb.Savepoint(t, w.tx, `UPDATE role_assignments SET active_to = now() WHERE id = $1`, given)
	require.NoError(t, err)
	assert.Equal(t, int64(1), tag.RowsAffected(), "and ends it")
}

func TestFeatureAPlatformModuleAssignsAGlobalRoleInItsTransaction(t *testing.T) {
	w := newAssignWorld(t)
	ctx := t.Context()
	admin := w.controlCentreAdministrator(t, w.b)

	require.NoError(t, authorization.AssignGlobalRole(ctx, w.tx, w.b, w.memberB, authorization.ControlCentreAdministrator.Key))
	require.NoError(t, authorization.AssignGlobalRole(ctx, w.tx, w.b, w.memberB, authorization.ControlCentreAdministrator.Key),
		"already given: left as it is")
	assert.Equal(t, 1, testdb.Count(t, w.tx, "role_assignments", map[string]any{"membership_id": w.memberB, "role_id": admin}))

	require.ErrorIs(t, authorization.AssignGlobalRole(ctx, w.tx, w.a, w.memberA, "x-hr.nobody"), authorization.ErrNoRole)
	require.ErrorIs(t, authorization.AssignGlobalRole(ctx, w.tx, w.a, w.memberA, authorization.ControlCentreAdministrator.Key),
		authorization.ErrAppOff, "Control Centre is not on in A")

	require.NoError(t, authorization.EndGlobalRole(ctx, w.tx, w.memberB, authorization.ControlCentreAdministrator.Key))
	testdb.AssertMissing(t, w.tx, "role_assignments", map[string]any{"membership_id": w.memberB, "role_id": admin, "active_to": nil})
	require.NoError(t, authorization.EndGlobalRole(ctx, w.tx, w.memberB, authorization.ControlCentreAdministrator.Key),
		"nothing open: left as it is")
}
