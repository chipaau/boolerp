//go:build feature

package authorization_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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
	exec(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-hr')`, w.b)
	w.global = id(t, w.tx, `SELECT id FROM roles WHERE key = 'x-hr.admin'`)
	w.mineA = id(t, w.tx, `INSERT INTO roles (tenant_id, app_key, name) VALUES ($1, 'x-hr', 'A clerk') RETURNING id`, w.a)
	w.mineB = id(t, w.tx, `INSERT INTO roles (tenant_id, app_key, name) VALUES ($1, 'x-hr', 'B clerk') RETURNING id`, w.b)
	user := func(n string) string {
		return id(t, w.tx, `INSERT INTO users (kratos_identity_id, email, phone) VALUES ($1, $2, '+9990000000') RETURNING id`,
			"0192f6a0-0000-7000-8000-0000000a"+n, "x-authz-"+n+"@example.test")
	}
	w.memberA = id(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, status, joined_at) VALUES ($1, $2, 'active', now()) RETURNING id`, w.a, user("0001"))
	w.memberB = id(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, status, joined_at) VALUES ($1, $2, 'active', now()) RETURNING id`, w.b, user("0002"))
	return w
}

func TestFeatureRoleAssignmentRules(t *testing.T) {
	w := newAssignWorld(t)
	g := id(t, w.tx, `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ($1, $2, $3) RETURNING id`, w.a, w.memberA, w.global)
	id(t, w.tx, `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ($1, $2, $3) RETURNING id`, w.a, w.memberA, w.mineA)
	exec(t, w.tx, `UPDATE roles SET archived_at = now() WHERE id = $1`, w.mineB)

	ins := `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ('`
	for name, sql := range map[string]string{
		"a member of another tenant": ins + w.a + `', '` + w.memberB + `', '` + w.global + `')`,
		"another tenant's role":      ins + w.a + `', '` + w.memberA + `', '` + w.mineB + `')`,
		"an archived role":           ins + w.b + `', '` + w.memberB + `', '` + w.mineB + `')`,
		"the same role twice":        ins + w.a + `', '` + w.memberA + `', '` + w.global + `')`,
		"moving it to a membership":  `UPDATE role_assignments SET membership_id = '` + w.memberB + `' WHERE id = '` + g + `'`,
		"changing its role":          `UPDATE role_assignments SET role_id = '` + w.mineA + `' WHERE id = '` + g + `'`,
	} {
		_, err := savepoint(t, w.tx, sql)
		assert.Error(t, err, name)
	}

	// An app turned off: its roles cannot be newly assigned.
	exec(t, w.tx, `UPDATE tenant_apps SET active_to = now() WHERE tenant_id = $1 AND app_key = 'x-hr'`, w.b)
	exec(t, w.tx, `UPDATE roles SET archived_at = NULL WHERE id = $1`, w.mineB)
	_, err := savepoint(t, w.tx, ins+w.b+`', '`+w.memberB+`', '`+w.global+`')`)
	assert.Error(t, err, "the app is off in B")

	// Revoked, then given again: a new row; the ended one is frozen.
	exec(t, w.tx, `UPDATE role_assignments SET active_to = now() WHERE id = $1`, g)
	id(t, w.tx, `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ($1, $2, $3) RETURNING id`, w.a, w.memberA, w.global)
	_, err = savepoint(t, w.tx, `UPDATE role_assignments SET active_to = NULL WHERE id = $1`, g)
	assert.Equal(t, "23514", code(err))
	assert.Equal(t, 2, testdb.Count(t, w.tx, "role_assignments", map[string]any{"membership_id": w.memberA, "role_id": w.global}))
}

func TestFeatureRoleAssignmentPolicies(t *testing.T) {
	w := newAssignWorld(t)
	exec(t, w.tx, `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ($1, $2, $3), ($4, $5, $3)`,
		w.a, w.memberA, w.global, w.b, w.memberB)
	exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
	exec(t, w.tx, `ALTER TABLE role_assignments FORCE ROW LEVEL SECURITY`)
	exec(t, w.tx, `SELECT set_config('app.tenant_id', $1, true)`, w.a)

	var n int
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT count(*) FROM role_assignments WHERE role_id = $1`, w.global).Scan(&n))
	assert.Equal(t, 1, n, "its own only")
	exec(t, w.tx, `INSERT INTO role_assignments (membership_id, role_id) VALUES ($1, $2)`, w.memberA, w.mineA) // tenant_id defaults
	testdb.AssertHas(t, w.tx, "role_assignments", map[string]any{"tenant_id": w.a, "role_id": w.mineA})
	_, err := savepoint(t, w.tx, `INSERT INTO role_assignments (tenant_id, membership_id, role_id) VALUES ($1, $2, $3)`, w.b, w.memberB, w.mineB)
	assert.Equal(t, "42501", code(err), "not in another tenant")
	tag, err := savepoint(t, w.tx, `UPDATE role_assignments SET active_to = now() WHERE tenant_id = $1`, w.b)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nor revokes there")
	tag, err = savepoint(t, w.tx, `DELETE FROM role_assignments WHERE tenant_id = $1`, w.a)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nothing deletes an assignment")
}
