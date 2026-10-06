//go:build feature

package authorization_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Feature tests (C79) for roles (C167): global roles (no tenant, a key) and a tenant's
// own, in the owner's rolled-back transaction. x-hr is on in tenant A only.

func rolesWorld(t *testing.T) appsWorld {
	t.Helper()
	w := newAppsWorld(t)
	exec(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-hr')`, w.a)
	exec(t, w.tx, `INSERT INTO roles (app_key, key, name) VALUES ('x-hr', 'x-hr.admin', 'HR admin')`)
	return w
}

func TestFeatureRoleRules(t *testing.T) {
	w := rolesWorld(t)
	mine := id(t, w.tx, `INSERT INTO roles (tenant_id, app_key, name) VALUES ($1, 'x-hr', 'Payroll clerk') RETURNING id`, w.a)

	for name, sql := range map[string]string{
		"a global role without a key":      `INSERT INTO roles (app_key, name) VALUES ('x-hr', 'Viewer')`,
		"a tenant role with a key":         `INSERT INTO roles (tenant_id, app_key, key, name) VALUES ('` + w.a + `', 'x-hr', 'x-hr.mine', 'Mine')`,
		"a key of another app":             `INSERT INTO roles (app_key, key, name) VALUES ('x-hr', 'x-tasks.admin', 'Tasks admin')`,
		"a malformed key":                  `INSERT INTO roles (app_key, key, name) VALUES ('x-hr', 'x-hr', 'Bare')`,
		"a repeated key":                   `INSERT INTO roles (app_key, key, name) VALUES ('x-hr', 'x-hr.admin', 'Another')`,
		"a blank name":                     `INSERT INTO roles (tenant_id, app_key, name) VALUES ('` + w.a + `', 'x-hr', ' ')`,
		"an app that is off in the tenant": `INSERT INTO roles (tenant_id, app_key, name) VALUES ('` + w.b + `', 'x-hr', 'Clerk')`,
		"a global role's name":             `INSERT INTO roles (tenant_id, app_key, name) VALUES ('` + w.a + `', 'x-hr', 'hr ADMIN')`,
		"a name the tenant already uses":   `INSERT INTO roles (tenant_id, app_key, name) VALUES ('` + w.a + `', 'x-hr', 'payroll clerk')`,
		"a second global name":             `INSERT INTO roles (app_key, key, name) VALUES ('x-hr', 'x-hr.boss', 'HR Admin')`,
		"moving a role to another tenant":  `UPDATE roles SET tenant_id = '` + w.b + `' WHERE id = '` + mine + `'`,
		"moving a role to another app":     `UPDATE roles SET app_key = 'x-tasks' WHERE id = '` + mine + `'`,
		"renaming a global role's key":     `UPDATE roles SET key = 'x-hr.chief' WHERE key = 'x-hr.admin'`,
	} {
		_, err := savepoint(t, w.tx, sql)
		assert.Error(t, err, name)
	}

	// Archived, a name is free again; unarchived, the clash is refused again.
	exec(t, w.tx, `UPDATE roles SET archived_at = now() WHERE id = $1`, mine)
	id(t, w.tx, `INSERT INTO roles (tenant_id, app_key, name) VALUES ($1, 'x-hr', 'Payroll clerk') RETURNING id`, w.a)
	_, err := savepoint(t, w.tx, `UPDATE roles SET archived_at = NULL WHERE id = $1`, mine)
	assert.Error(t, err, "two live roles with one name")

	// Another tenant may use the same name for its own role.
	exec(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-hr')`, w.b)
	id(t, w.tx, `INSERT INTO roles (tenant_id, app_key, name) VALUES ($1, 'x-hr', 'Payroll clerk') RETURNING id`, w.b)
}

func TestFeatureRolePolicies(t *testing.T) {
	w := rolesWorld(t)
	exec(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-hr')`, w.b)
	exec(t, w.tx, `INSERT INTO roles (tenant_id, app_key, name) VALUES ($1, 'x-hr', 'A clerk'), ($2, 'x-hr', 'B clerk')`, w.a, w.b)
	exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
	exec(t, w.tx, `ALTER TABLE roles FORCE ROW LEVEL SECURITY`) // only this package's tests use roles
	as := func(tenant string) { exec(t, w.tx, `SELECT set_config('app.tenant_id', $1, true)`, tenant) }
	names := func() []string {
		rows, err := w.tx.Query(t.Context(), `SELECT name FROM roles WHERE app_key = 'x-hr' ORDER BY name`)
		require.NoError(t, err)
		defer rows.Close()
		var out []string
		for rows.Next() {
			var n string
			require.NoError(t, rows.Scan(&n))
			out = append(out, n)
		}
		return out
	}

	as("")
	assert.Equal(t, []string{"HR admin"}, names(), "no tenant: the global roles only")

	as(w.a)
	assert.Equal(t, []string{"A clerk", "HR admin"}, names(), "its own and the global ones, never B's")
	id(t, w.tx, `INSERT INTO roles (tenant_id, app_key, name) VALUES ($1, 'x-hr', 'A viewer') RETURNING id`, w.a)
	_, err := savepoint(t, w.tx, `INSERT INTO roles (tenant_id, app_key, name) VALUES ($1, 'x-hr', 'Sneaky')`, w.b)
	assert.Equal(t, "42501", code(err), "not for another tenant")
	_, err = savepoint(t, w.tx, `INSERT INTO roles (app_key, key, name) VALUES ('x-hr', 'x-hr.mine', 'Mine')`)
	assert.Equal(t, "42501", code(err), "nor a global role")
	tag, err := savepoint(t, w.tx, `UPDATE roles SET description = 'changed' WHERE tenant_id IS NULL OR tenant_id = $1`, w.b)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "global and other tenants' roles are not its to change")
	tag, err = savepoint(t, w.tx, `DELETE FROM roles WHERE tenant_id = $1`, w.a)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nothing deletes a role")
	testdb.AssertHas(t, w.tx, "roles", map[string]any{"tenant_id": w.a, "name": "A viewer"})
}
