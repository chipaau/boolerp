//go:build feature

package authorization_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Feature tests (C79) for role_capabilities (C169), on rolesWorld's roles: the global
// x-hr.admin, and tenant A's own role.

func capsWorld(t *testing.T) (appsWorld, string, string) {
	t.Helper()
	w := rolesWorld(t)
	exec(t, w.tx, `INSERT INTO capabilities (key, app_key, name) VALUES
		('x-hrms:employee:view', 'x-hr', 'View'), ('x-hrms:employee:manage', 'x-hr', 'Manage'),
		('x-tasks:task:view', 'x-tasks', 'Tasks'), ('x-hrms:old:view', 'x-hr', 'Old')`)
	exec(t, w.tx, `UPDATE capabilities SET active_to = now() WHERE key = 'x-hrms:old:view'`)
	global := id(t, w.tx, `SELECT id FROM roles WHERE key = 'x-hr.admin'`)
	mine := id(t, w.tx, `INSERT INTO roles (tenant_id, app_key, name) VALUES ($1, 'x-hr', 'Clerk') RETURNING id`, w.a)
	return w, global, mine
}

func TestFeatureRoleCapabilityRules(t *testing.T) {
	w, global, mine := capsWorld(t)
	// The caller's tenant_id is ignored: the role's is used.
	exec(t, w.tx, `INSERT INTO role_capabilities (role_id, capability, tenant_id) VALUES ($1, 'x-hrms:employee:view', $2)`, mine, w.b)
	exec(t, w.tx, `INSERT INTO role_capabilities (role_id, capability) VALUES ($1, 'x-hrms:employee:manage')`, global)
	testdb.AssertHas(t, w.tx, "role_capabilities", map[string]any{"role_id": mine, "tenant_id": w.a})
	testdb.AssertHas(t, w.tx, "role_capabilities", map[string]any{"role_id": global, "tenant_id": nil})

	for name, sql := range map[string]string{
		"another app's capability": `INSERT INTO role_capabilities (role_id, capability) VALUES ('` + mine + `', 'x-tasks:task:view')`,
		"a retired capability":     `INSERT INTO role_capabilities (role_id, capability) VALUES ('` + mine + `', 'x-hrms:old:view')`,
		"an unknown capability":    `INSERT INTO role_capabilities (role_id, capability) VALUES ('` + mine + `', 'x-hrms:nope:view')`,
		"granted twice":            `INSERT INTO role_capabilities (role_id, capability) VALUES ('` + mine + `', 'x-hrms:employee:view')`,
		"changing a row":           `UPDATE role_capabilities SET capability = 'x-hrms:employee:manage' WHERE role_id = '` + mine + `'`,
	} {
		_, err := savepoint(t, w.tx, sql)
		assert.Error(t, err, name)
	}
	exec(t, w.tx, `DELETE FROM role_capabilities WHERE role_id = $1`, mine)
	testdb.AssertMissing(t, w.tx, "role_capabilities", map[string]any{"role_id": mine})
}

func TestFeatureRoleCapabilityPolicies(t *testing.T) {
	w, global, mine := capsWorld(t)
	exec(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-hr')`, w.b)
	theirs := id(t, w.tx, `INSERT INTO roles (tenant_id, app_key, name) VALUES ($1, 'x-hr', 'B clerk') RETURNING id`, w.b)
	exec(t, w.tx, `INSERT INTO role_capabilities (role_id, capability) VALUES ($1, 'x-hrms:employee:manage'),
		($2, 'x-hrms:employee:view'), ($3, 'x-hrms:employee:view')`, global, mine, theirs)
	exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
	exec(t, w.tx, `ALTER TABLE role_capabilities FORCE ROW LEVEL SECURITY`)
	exec(t, w.tx, `SELECT set_config('app.tenant_id', $1, true)`, w.a)

	var n int
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT count(*) FROM role_capabilities WHERE capability LIKE 'x-%'`).Scan(&n))
	assert.Equal(t, 2, n, "its own role's and the global role's, never B's")

	exec(t, w.tx, `INSERT INTO role_capabilities (role_id, capability) VALUES ($1, 'x-hrms:employee:manage')`, mine)
	_, err := savepoint(t, w.tx, `INSERT INTO role_capabilities (role_id, capability) VALUES ($1, 'x-hrms:employee:view')`, global)
	assert.Equal(t, "42501", code(err), "not a global role's")
	_, err = savepoint(t, w.tx, `INSERT INTO role_capabilities (role_id, capability) VALUES ($1, 'x-hrms:employee:manage')`, theirs)
	assert.Equal(t, "42501", code(err), "nor another tenant's")
	tag, err := savepoint(t, w.tx, `DELETE FROM role_capabilities WHERE role_id IN ($1, $2)`, global, theirs)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "it removes only its own roles' capabilities")
	tag, err = savepoint(t, w.tx, `DELETE FROM role_capabilities WHERE role_id = $1 AND capability = 'x-hrms:employee:view'`, mine)
	require.NoError(t, err)
	assert.EqualValues(t, 1, tag.RowsAffected())
}
