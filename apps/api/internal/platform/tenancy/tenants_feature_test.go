//go:build feature

package tenancy_test

import (
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Tests create every row they need (C135) inside a rolled-back transaction, with
// values no real data uses: ISO user-assigned countries (XT, XU), x_ codes, and
// slugs starting with x-. Other packages' tests run at the same time against the
// same database, so these values are this package's own: two uncommitted inserts
// of the same key wait on each other and can deadlock.

// world is a transaction as the table owner with the reference rows tenants need:
// countries XT and XU, a legal form of each, and the institution type x_tenancy_type.
type world struct {
	tx               pgx.Tx
	formXT, formXU   string
	formXTNoDocument string
}

func newWorld(t *testing.T) *world {
	t.Helper()
	tx := testdb.OwnerTx(t)
	w := &world{tx: tx}
	exec(t, tx, `INSERT INTO countries (code, alpha3, name, phone_prefix)
		VALUES ('XT', 'XTT', 'Testland', '+999'), ('XU', 'XUU', 'Otherland', '+998')`)
	exec(t, tx, `INSERT INTO sectors (code, name) VALUES ('x_tenancy', 'Test sector')`)
	exec(t, tx, `INSERT INTO institution_types (code, sector, name) VALUES ('x_tenancy_type', 'x_tenancy', 'Test type')`)
	w.formXT = id(t, tx, `INSERT INTO legal_forms (country, code, name, category, identity_document)
		VALUES ('XT', 'test_company', 'Test company', 'private', 'Test registration number') RETURNING id`)
	w.formXTNoDocument = id(t, tx, `INSERT INTO legal_forms (country, code, name, category)
		VALUES ('XT', 'test_ministry', 'Test ministry', 'government') RETURNING id`)
	w.formXU = id(t, tx, `INSERT INTO legal_forms (country, code, name, category)
		VALUES ('XU', 'test_company', 'Test company', 'private') RETURNING id`)
	return w
}

// tenant inserts a provisioning tenant in country XT and returns its id.
func (w *world) tenant(t *testing.T, slug, code string) string {
	t.Helper()
	return id(t, w.tx, `INSERT INTO tenants (slug, code, name, country) VALUES ($1, $2, $3, 'XT') RETURNING id`,
		slug, code, "Tenant "+code)
}

// operator inserts the operator tenant, as only the owner can.
func (w *world) operator(t *testing.T) string {
	t.Helper()
	return id(t, w.tx, `INSERT INTO tenants (slug, code, name, country, is_operator)
		VALUES ('x-operator', 'XOP', 'Test operator', 'XT', true) RETURNING id`)
}

// enforce applies the row-level security policies to the owner too, for the rest
// of the transaction, so the test sees what the runtime role sees. It locks
// tenants until the test ends, which only this package's tests (run one at a
// time) use; never do this to a table other packages' tests use.
func (w *world) enforce(t *testing.T) {
	t.Helper()
	// ALTER TABLE refuses while commit-time checks are pending: run them now.
	exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
	exec(t, w.tx, `ALTER TABLE tenants FORCE ROW LEVEL SECURITY`)
}

// as sets the transaction's tenant, as the API does per transaction ("" = none).
func (w *world) as(t *testing.T, tenant string) {
	t.Helper()
	exec(t, w.tx, `SELECT set_config('app.tenant_id', $1, true)`, tenant)
}

func (w *world) visible(t *testing.T) []string {
	t.Helper()
	rows, err := w.tx.Query(t.Context(), `SELECT code FROM tenants WHERE slug LIKE 'x-%' ORDER BY code`)
	require.NoError(t, err)
	codes, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	return codes
}

// activate classifies tenant and makes it active, with x_tenancy_type as its primary
// type, then runs the commit-time checks at once (SET CONSTRAINTS ALL IMMEDIATE),
// as the test's transaction never commits.
func (w *world) activate(t *testing.T, tenant string) {
	t.Helper()
	exec(t, w.tx, `INSERT INTO tenant_institution_types (tenant_id, institution_type, is_primary)
		VALUES ($1, 'x_tenancy_type', true)`, tenant)
	exec(t, w.tx, `UPDATE tenants SET legal_form_id = $1, timezone = 'Indian/Maldives',
		status = 'active', activated_at = now() WHERE id = $2`, w.formXTNoDocument, tenant)
	exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
}

func exec(t *testing.T, tx pgx.Tx, sql string, args ...any) {
	t.Helper()
	_, err := tx.Exec(t.Context(), sql, args...)
	require.NoError(t, err, sql)
}

func id(t *testing.T, tx pgx.Tx, sql string, args ...any) string {
	t.Helper()
	var v string
	require.NoError(t, tx.QueryRow(t.Context(), sql, args...).Scan(&v), sql)
	return v
}

// code returns the PostgreSQL error code of err, failing when it is not one.
func code(t *testing.T, err error) string {
	t.Helper()
	var pgErr *pgconn.PgError
	require.ErrorAs(t, err, &pgErr)
	return pgErr.Code
}

// savepoint runs sql in a savepoint, so a refused statement does not end the test's transaction.
func savepoint(t *testing.T, tx pgx.Tx, sql string, args ...any) (pgconn.CommandTag, error) {
	t.Helper()
	sp, err := tx.Begin(t.Context())
	require.NoError(t, err)
	tag, err := sp.Exec(t.Context(), sql, args...)
	if err != nil {
		require.NoError(t, sp.Rollback(t.Context()))
		return tag, err
	}
	require.NoError(t, sp.Commit(t.Context()))
	return tag, nil
}

func TestFeatureTheRuntimeRoleWithoutATenantSeesAndWritesNothing(t *testing.T) {
	tx := testdb.Tx(t)
	_, err := tx.Exec(t.Context(), `INSERT INTO tenants (slug, code, name, country) VALUES ('x-a', 'XTA', 'A', 'MV')`)
	assert.Equal(t, "42501", code(t, err), "no tenant: row-level security refuses the insert")

	tx = testdb.Tx(t)
	exec(t, tx, `SELECT set_config('app.tenant_id', '0192f6a0-0000-7000-8000-000000000000', true)`)
	_, err = tx.Exec(t.Context(), `INSERT INTO tenants (slug, code, name, country) VALUES ('x-a', 'XTA', 'A', 'MV')`)
	assert.Equal(t, "42501", code(t, err), "an unknown tenant is not the operator")
}

func TestFeatureATenantReadsOnlyItsOwnRow(t *testing.T) {
	w := newWorld(t)
	op := w.operator(t)
	a := w.tenant(t, "x-a", "XTA")
	w.tenant(t, "x-b", "XTB")
	w.enforce(t)

	w.as(t, "")
	assert.Empty(t, w.visible(t), "no tenant set: no rows (fail closed)")
	w.as(t, a)
	assert.Equal(t, []string{"XTA"}, w.visible(t))
	w.as(t, op)
	assert.Equal(t, []string{"XOP", "XTA", "XTB"}, w.visible(t), "the operator reads every tenant")
}

func TestFeatureOnlyTheOperatorCreatesAndChangesTenants(t *testing.T) {
	w := newWorld(t)
	op := w.operator(t)
	a := w.tenant(t, "x-a", "XTA")
	b := w.tenant(t, "x-b", "XTB")
	w.enforce(t)

	w.as(t, a)
	tag, err := savepoint(t, w.tx, `UPDATE tenants SET name = 'Renamed' WHERE id = $1`, a)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "a tenant cannot change even its own registry row")
	_, err = savepoint(t, w.tx, `INSERT INTO tenants (slug, code, name, country) VALUES ('x-c', 'XTC', 'C', 'XT')`)
	assert.Equal(t, "42501", code(t, err), "a tenant cannot create tenants")

	w.as(t, op)
	tag, err = savepoint(t, w.tx, `UPDATE tenants SET name = 'Renamed' WHERE id = $1`, a)
	require.NoError(t, err)
	assert.EqualValues(t, 1, tag.RowsAffected())
	_, err = savepoint(t, w.tx, `INSERT INTO tenants (slug, code, name, country, parent_id) VALUES ('x-c', 'XTC', 'C', 'XT', $1)`, b)
	require.NoError(t, err, "the operator creates tenants")

	tag, err = savepoint(t, w.tx, `DELETE FROM tenants WHERE id = $1`, a)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "no delete policy: tenants are archived, never deleted")
}

func TestFeatureTheRuntimeRoleNeverSetsTheOperatorFlag(t *testing.T) {
	w := newWorld(t)
	op := w.operator(t)
	a := w.tenant(t, "x-a", "XTA")
	w.enforce(t)
	w.as(t, op)

	for name, sql := range map[string]string{
		"create an operator":      `INSERT INTO tenants (slug, code, name, country, is_operator) VALUES ('x-c', 'XTC', 'C', 'XT', true)`,
		"make a tenant operator":  `UPDATE tenants SET is_operator = true WHERE id = '` + a + `'`,
		"stop being the operator": `UPDATE tenants SET is_operator = false WHERE id = '` + op + `'`,
	} {
		_, err := savepoint(t, w.tx, sql)
		assert.Equal(t, "42501", code(t, err), name)
	}
	_, err := savepoint(t, w.tx, `UPDATE tenants SET name = 'Bool' WHERE id = $1`, op)
	require.NoError(t, err, "the operator still changes its own other fields")
}

func TestFeatureTenantConstraints(t *testing.T) {
	const insert = `INSERT INTO tenants (slug, code, name, country`
	cases := map[string]struct {
		sql  string
		want string
	}{
		"short slug":      {insert + `) VALUES ('xa', 'XTC', 'C', 'XT')`, "23514"},
		"uppercase slug":  {insert + `) VALUES ('X-C', 'XTC', 'C', 'XT')`, "23514"},
		"hyphen at end":   {insert + `) VALUES ('x-c-', 'XTC', 'C', 'XT')`, "23514"},
		"reserved slug":   {insert + `) VALUES ('admin', 'XTC', 'C', 'XT')`, "23514"},
		"duplicate slug":  {insert + `) VALUES ('x-a', 'XTC', 'C', 'XT')`, "23505"},
		"lowercase code":  {insert + `) VALUES ('x-c', 'xtc', 'C', 'XT')`, "23514"},
		"duplicate code":  {insert + `) VALUES ('x-c', 'XTA', 'C', 'XT')`, "23505"},
		"blank name":      {insert + `) VALUES ('x-c', 'XTC', ' ', 'XT')`, "23514"},
		"unknown country": {insert + `) VALUES ('x-c', 'XTC', 'C', 'XC')`, "23503"},
		"bad phone":       {insert + `, phone) VALUES ('x-c', 'XTC', 'C', 'XT', '7771234')`, "23514"},
		"blank email":     {insert + `, email) VALUES ('x-c', 'XTC', 'C', 'XT', ' ')`, "23514"},
		"unknown status":  {insert + `, status) VALUES ('x-c', 'XTC', 'C', 'XT', 'draft')`, "23514"},
		"active without classification": {insert + `, status, activated_at)
			VALUES ('x-c', 'XTC', 'C', 'XT', 'active', now())`, "23514"},
		"active without activated_at": {insert + `, status, legal_form_id, timezone)
			VALUES ('x-c', 'XTC', 'C', 'XT', 'active', '%FORM%', 'Indian/Maldives')`, "23514"},
		"suspended without suspended_at": {insert + `, status, legal_form_id, timezone, activated_at)
			VALUES ('x-c', 'XTC', 'C', 'XT', 'suspended', '%FORM%', 'Indian/Maldives', now())`, "23514"},
		"archived without archived_at":  {insert + `, status) VALUES ('x-c', 'XTC', 'C', 'XT', 'archived')`, "23514"},
		"legal form of another country": {insert + `, legal_form_id) VALUES ('x-c', 'XTC', 'C', 'XT', '%FORMXU%')`, "23503"},
		"a second operator":             {insert + `, is_operator) VALUES ('x-c', 'XTC', 'C', 'XT', true)`, "23505"},
		"duplicate identity number":     {insert + `, identity_number) VALUES ('x-c', 'XTC', 'C', 'XT', 'c-123')`, "23505"},
		"blank tax number":              {insert + `, tax_number) VALUES ('x-c', 'XTC', 'C', 'XT', ' ')`, "23514"},
		"duplicate tax number":          {insert + `, tax_number) VALUES ('x-c', 'XTC', 'C', 'XT', 'tin-9')`, "23505"},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			w := newWorld(t)
			w.operator(t)
			exec(t, w.tx, `INSERT INTO tenants (slug, code, name, country, identity_number, tax_number)
				VALUES ('x-a', 'XTA', 'A', 'XT', 'C-123', 'TIN-9')`)
			sql := c.sql
			for k, v := range map[string]string{"%FORM%": w.formXT, "%FORMXU%": w.formXU} {
				sql = strings.ReplaceAll(sql, k, v)
			}
			_, err := w.tx.Exec(t.Context(), sql)
			assert.Equal(t, c.want, code(t, err))
		})
	}
}

func TestFeatureTheSameIdentityNumberInAnotherCountry(t *testing.T) {
	w := newWorld(t)
	exec(t, w.tx, `INSERT INTO tenants (slug, code, name, country, identity_number) VALUES ('x-a', 'XTA', 'A', 'XT', 'C-123')`)
	exec(t, w.tx, `INSERT INTO tenants (slug, code, name, country, identity_number) VALUES ('x-b', 'XTB', 'B', 'XU', 'C-123')`)
}

func TestFeatureTheSameTaxNumberInAnotherCountry(t *testing.T) {
	w := newWorld(t)
	exec(t, w.tx, `INSERT INTO tenants (slug, code, name, country, tax_number) VALUES ('x-a', 'XTA', 'A', 'XT', 'TIN-9')`)
	exec(t, w.tx, `INSERT INTO tenants (slug, code, name, country, tax_number) VALUES ('x-b', 'XTB', 'B', 'XU', 'TIN-9')`)
	exec(t, w.tx, `INSERT INTO tenants (slug, code, name, country) VALUES ('x-c', 'XTC', 'C', 'XT')`)
	exec(t, w.tx, `INSERT INTO tenants (slug, code, name, country) VALUES ('x-d', 'XTD', 'D', 'XT')`) // many without one
}

func TestFeatureAnActiveTenantIsClassified(t *testing.T) {
	w := newWorld(t)
	w.activate(t, w.tenant(t, "x-a", "XTA"))
}

func TestFeatureTheOperatorStaysActiveAndHasNoParent(t *testing.T) {
	w := newWorld(t)
	op := w.operator(t)
	a := w.tenant(t, "x-a", "XTA")
	for name, sql := range map[string]string{
		"archived":   `UPDATE tenants SET status = 'archived', archived_at = now() WHERE id = '` + op + `'`,
		"has parent": `UPDATE tenants SET parent_id = '` + a + `' WHERE id = '` + op + `'`,
	} {
		_, err := savepoint(t, w.tx, sql)
		assert.Equal(t, "23514", code(t, err), name)
	}
}

func TestFeatureParentRules(t *testing.T) {
	w := newWorld(t)
	op := w.operator(t)
	a := w.tenant(t, "x-a", "XTA")
	b := w.tenant(t, "x-b", "XTB")
	c := w.tenant(t, "x-c", "XTC")
	exec(t, w.tx, `UPDATE tenants SET parent_id = $1 WHERE id = $2`, a, b)
	exec(t, w.tx, `UPDATE tenants SET parent_id = $1 WHERE id = $2`, b, c)

	for name, sql := range map[string]string{
		"itself":          `UPDATE tenants SET parent_id = id WHERE id = '` + a + `'`,
		"a cycle":         `UPDATE tenants SET parent_id = '` + c + `' WHERE id = '` + a + `'`,
		"the operator":    `UPDATE tenants SET parent_id = '` + op + `' WHERE id = '` + a + `'`,
		"deleting parent": `DELETE FROM tenants WHERE id = '` + a + `'`,
	} {
		_, err := savepoint(t, w.tx, sql)
		assert.Contains(t, []string{"23514", "23001"}, code(t, err), name)
	}
}

func TestFeatureTheSlugIsLockedOnceActive(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	exec(t, w.tx, `UPDATE tenants SET slug = 'x-a2' WHERE id = $1`, a)
	w.activate(t, a)
	_, err := savepoint(t, w.tx, `UPDATE tenants SET slug = 'x-a3' WHERE id = $1`, a)
	assert.Equal(t, "23514", code(t, err))
}

func TestFeatureReferencedClassificationCannotBeDeleted(t *testing.T) {
	for name, sql := range map[string]string{
		"its legal form":       `DELETE FROM legal_forms WHERE code = 'test_ministry'`,
		"its institution type": `DELETE FROM institution_types WHERE code = 'x_tenancy_type'`,
		"its country":          `DELETE FROM countries WHERE code = 'XT'`,
	} {
		t.Run(name, func(t *testing.T) {
			w := newWorld(t)
			a := w.tenant(t, "x-a", "XTA")
			exec(t, w.tx, `UPDATE tenants SET legal_form_id = $1 WHERE id = $2`, w.formXTNoDocument, a)
			exec(t, w.tx, `INSERT INTO tenant_institution_types (tenant_id, institution_type) VALUES ($1, 'x_tenancy_type')`, a)
			_, err := w.tx.Exec(t.Context(), sql)
			assert.Contains(t, []string{"23001", "23503"}, code(t, err))
		})
	}
}

func TestFeatureTenantUpdatedAtFollowsChanges(t *testing.T) {
	w := newWorld(t)
	// The trigger runs on updates only, so a backdated insert keeps its updated_at.
	a := id(t, w.tx, `INSERT INTO tenants (slug, code, name, country, updated_at)
		VALUES ('x-a', 'XTA', 'A', 'XT', '2000-01-01') RETURNING id`)
	exec(t, w.tx, `UPDATE tenants SET name = 'Renamed' WHERE id = $1`, a)
	var setToNow bool
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT updated_at = now() FROM tenants WHERE id = $1`, a).Scan(&setToNow))
	assert.True(t, setToNow)
}

// The policies call lookup.is_operator_tenant as the runtime role; without its
// grants every policy would fail with "permission denied", which looks like a
// refusal. The function itself must work for the runtime role.
func TestFeatureTheRuntimeRoleCallsTheOperatorCheck(t *testing.T) {
	var isOperator bool
	require.NoError(t, testdb.Tx(t).QueryRow(t.Context(),
		`SELECT lookup.is_operator_tenant('0192f6a0-0000-7000-8000-000000000000')`).Scan(&isOperator))
	assert.False(t, isOperator)
}

func TestFeatureTheLookupRoleCannotLogIn(t *testing.T) {
	var canLogin, bypassesRLS bool
	require.NoError(t, testdb.Tx(t).QueryRow(t.Context(),
		`SELECT rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname = 'erp_lookup'`).Scan(&canLogin, &bypassesRLS))
	assert.False(t, canLogin)
	assert.True(t, bypassesRLS)
}
