//go:build feature

package tenancy_test

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// addTypes adds the types x_tenancy_type2 and x_tenancy_type3 (sector x_tenancy).
func (w *world) addTypes(t *testing.T) {
	t.Helper()
	exec(t, w.tx, `INSERT INTO institution_types (code, sector, name)
		VALUES ('x_tenancy_type2', 'x_tenancy', 'Second type'), ('x_tenancy_type3', 'x_tenancy', 'Third type')`)
}

// commitCheck runs sql, then the commit-time checks, in a savepoint, and returns
// the error of whichever failed.
func (w *world) commitCheck(t *testing.T, sql string, args ...any) error {
	t.Helper()
	sp, err := w.tx.Begin(t.Context())
	require.NoError(t, err)
	if _, err = sp.Exec(t.Context(), sql, args...); err == nil {
		_, err = sp.Exec(t.Context(), `SET CONSTRAINTS ALL IMMEDIATE`)
	}
	if err != nil {
		require.NoError(t, sp.Rollback(t.Context()))
		return err
	}
	require.NoError(t, sp.Commit(t.Context()))
	return nil
}

func TestFeatureATenantHasSeveralTypesAndOnePrimary(t *testing.T) {
	w := newWorld(t)
	w.addTypes(t)
	a := w.tenant(t, "x-a", "XTA")
	w.activate(t, a)
	exec(t, w.tx, `INSERT INTO tenant_institution_types (tenant_id, institution_type)
		VALUES ($1, 'x_tenancy_type2'), ($1, 'x_tenancy_type3')`, a)

	var types, primaries int
	require.NoError(t, w.tx.QueryRow(t.Context(),
		`SELECT count(*), count(*) FILTER (WHERE is_primary) FROM tenant_institution_types WHERE tenant_id = $1`, a).
		Scan(&types, &primaries))
	assert.Equal(t, 3, types)
	assert.Equal(t, 1, primaries)
}

func TestFeatureTenantInstitutionTypeConstraints(t *testing.T) {
	for name, c := range map[string]struct{ sql, want string }{
		"a second primary": {`INSERT INTO tenant_institution_types (tenant_id, institution_type, is_primary)
			VALUES ('%A%', 'x_tenancy_type2', true)`, "23505"},
		"the same type twice": {`INSERT INTO tenant_institution_types (tenant_id, institution_type)
			VALUES ('%A%', 'x_tenancy_type')`, "23505"},
		"an unknown type": {`INSERT INTO tenant_institution_types (tenant_id, institution_type)
			VALUES ('%A%', 'x_none')`, "23503"},
		"an unknown tenant": {`INSERT INTO tenant_institution_types (tenant_id, institution_type)
			VALUES ('0192f6a0-0000-7000-8000-000000000000', 'x_tenancy_type')`, "23503"},
	} {
		t.Run(name, func(t *testing.T) {
			w := newWorld(t)
			w.addTypes(t)
			a := w.tenant(t, "x-a", "XTA")
			w.activate(t, a)
			_, err := savepoint(t, w.tx, strings.ReplaceAll(c.sql, "%A%", a))
			assert.Equal(t, c.want, code(t, err))
		})
	}
}

func TestFeatureAnActiveTenantAlwaysHasAPrimaryType(t *testing.T) {
	w := newWorld(t)
	w.addTypes(t)
	a := w.tenant(t, "x-a", "XTA")
	exec(t, w.tx, `UPDATE tenants SET legal_form_id = $1, timezone = 'Indian/Maldives' WHERE id = $2`, w.formXTNoDocument, a)

	err := w.commitCheck(t, `UPDATE tenants SET status = 'active', activated_at = now() WHERE id = $1`, a)
	assert.Equal(t, "23514", code(t, err), "activating without a primary type")

	w.activate(t, a)
	exec(t, w.tx, `INSERT INTO tenant_institution_types (tenant_id, institution_type) VALUES ($1, 'x_tenancy_type2')`, a)
	err = w.commitCheck(t, `DELETE FROM tenant_institution_types WHERE tenant_id = $1 AND is_primary`, a)
	assert.Equal(t, "23514", code(t, err), "removing an active tenant's primary")
	err = w.commitCheck(t, `UPDATE tenant_institution_types SET is_primary = false WHERE tenant_id = $1`, a)
	assert.Equal(t, "23514", code(t, err), "unflagging an active tenant's primary")

	require.NoError(t, w.commitCheck(t, `DELETE FROM tenant_institution_types
		WHERE tenant_id = $1 AND institution_type = 'x_tenancy_type2'`, a), "removing an additional type")
}

func TestFeatureThePrimaryTypeCanBeSwapped(t *testing.T) {
	w := newWorld(t)
	w.addTypes(t)
	a := w.tenant(t, "x-a", "XTA")
	w.activate(t, a)
	exec(t, w.tx, `INSERT INTO tenant_institution_types (tenant_id, institution_type) VALUES ($1, 'x_tenancy_type2')`, a)

	// Unflag the old primary, then flag the new one; the check runs at commit.
	exec(t, w.tx, `SET CONSTRAINTS ALL DEFERRED`)
	exec(t, w.tx, `UPDATE tenant_institution_types SET is_primary = false WHERE tenant_id = $1 AND is_primary`, a)
	exec(t, w.tx, `UPDATE tenant_institution_types SET is_primary = true
		WHERE tenant_id = $1 AND institution_type = 'x_tenancy_type2'`, a)
	exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)

	var primary string
	require.NoError(t, w.tx.QueryRow(t.Context(),
		`SELECT institution_type FROM tenant_institution_types WHERE tenant_id = $1 AND is_primary`, a).Scan(&primary))
	assert.Equal(t, "x_tenancy_type2", primary)
}

func TestFeatureAProvisioningTenantNeedsNoPrimaryType(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	exec(t, w.tx, `INSERT INTO tenant_institution_types (tenant_id, institution_type, is_primary) VALUES ($1, 'x_tenancy_type', true)`, a)
	require.NoError(t, w.commitCheck(t, `DELETE FROM tenant_institution_types WHERE tenant_id = $1`, a))
}

func TestFeatureTenantInstitutionTypePolicies(t *testing.T) {
	w := newWorld(t)
	w.addTypes(t)
	op := w.operator(t)
	a := w.tenant(t, "x-a", "XTA")
	b := w.tenant(t, "x-b", "XTB")
	exec(t, w.tx, `INSERT INTO tenant_institution_types (tenant_id, institution_type)
		VALUES ($1, 'x_tenancy_type'), ($2, 'x_tenancy_type2')`, a, b)
	// Only this package uses the table, so forcing row-level security on the owner is safe here.
	w.enforce(t)
	exec(t, w.tx, `ALTER TABLE tenant_institution_types FORCE ROW LEVEL SECURITY`)

	count := func() (n int) {
		require.NoError(t, w.tx.QueryRow(t.Context(),
			`SELECT count(*) FROM tenant_institution_types WHERE institution_type LIKE 'x\_tenancy%'`).Scan(&n))
		return n
	}
	w.as(t, "")
	assert.Zero(t, count(), "no tenant set: no rows")
	w.as(t, a)
	assert.Equal(t, 1, count(), "a tenant reads its own types")
	_, err := savepoint(t, w.tx, `INSERT INTO tenant_institution_types (tenant_id, institution_type) VALUES ($1, 'x_tenancy_type3')`, a)
	assert.Equal(t, "42501", code(t, err), "a tenant cannot add its own types")
	tag, err := savepoint(t, w.tx, `DELETE FROM tenant_institution_types WHERE tenant_id = $1`, a)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nor remove them")

	w.as(t, op)
	assert.Equal(t, 2, count(), "the operator reads every tenant's types")
	_, err = savepoint(t, w.tx, `INSERT INTO tenant_institution_types (tenant_id, institution_type) VALUES ($1, 'x_tenancy_type3')`, a)
	require.NoError(t, err, "the operator adds types")
	tag, err = savepoint(t, w.tx, `DELETE FROM tenant_institution_types WHERE tenant_id = $1 AND institution_type = 'x_tenancy_type3'`, a)
	require.NoError(t, err)
	assert.EqualValues(t, 1, tag.RowsAffected(), "and removes them")
}
