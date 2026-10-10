//go:build feature

package authorization_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization/seeds"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Feature tests (C79) for tenant_apps (C166), in the owner's rolled-back transaction:
// a test country, an operator, two tenants, and test apps of each kind.

type appsWorld struct {
	tx             pgx.Tx
	operator, a, b string
}

func newAppsWorld(t *testing.T) appsWorld {
	t.Helper()
	tx := testdb.OwnerTx(t)
	exec(t, tx, `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XV', 'XVV', 'Appland', '+997')`)
	form := id(t, tx, `INSERT INTO legal_forms (country, code, name, category)
		VALUES ('XV', 'test_ministry', 'Test ministry', 'government') RETURNING id`)
	const insert = `INSERT INTO tenants (slug, code, name, country, legal_form_id, timezone, is_operator)
		VALUES ($1, $2, $3, 'XV', $4, 'Etc/UTC', $5) RETURNING id`
	w := appsWorld{tx: tx,
		operator: id(t, tx, insert, "x-authz-operator", "XAOP", "Test operator", form, true),
		a:        id(t, tx, insert, "x-authz-a", "XAA", "A", form, false),
		b:        id(t, tx, insert, "x-authz-b", "XAB", "B", form, false),
	}
	exec(t, tx, `INSERT INTO apps (key, name, kind) VALUES ('x-hr', 'Test HR', 'workspace'),
		('x-console', 'Test console', 'operator'), ('x-tasks', 'Test tasks', 'workspace'), ('x-gone', 'Gone', 'workspace')`)
	exec(t, tx, `UPDATE apps SET active_to = now() WHERE key = 'x-gone'`)
	return w
}

func TestFeatureTenantAppRules(t *testing.T) {
	w := newAppsWorld(t)
	live := id(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-hr') RETURNING id`, w.a)
	id(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-console') RETURNING id`, w.operator)

	for name, sql := range map[string]string{
		"a second live activation":  `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ('` + w.a + `', 'x-hr')`,
		"an operator app elsewhere": `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ('` + w.a + `', 'x-console')`,
		"a retired app":             `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ('` + w.a + `', 'x-gone')`,
		"an unknown app":            `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ('` + w.a + `', 'x-nope')`,
		"moving it to a tenant":     `UPDATE tenant_apps SET tenant_id = '` + w.b + `' WHERE id = '` + live + `'`,
		"changing its app":          `UPDATE tenant_apps SET app_key = 'x-console' WHERE id = '` + live + `'`,
		"ending before it began":    `UPDATE tenant_apps SET active_to = active_from - interval '1 day' WHERE id = '` + live + `'`,
	} {
		_, err := savepoint(t, w.tx, sql)
		assert.Error(t, err, name)
	}

	// Turned off, then on again: a new row, the old one frozen history.
	exec(t, w.tx, `UPDATE tenant_apps SET active_to = now() WHERE id = $1`, live)
	id(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-hr') RETURNING id`, w.a)
	_, err := savepoint(t, w.tx, `UPDATE tenant_apps SET active_to = NULL WHERE id = $1`, live)
	assert.Equal(t, "23514", code(err), "an ended activation cannot change")
	assert.Equal(t, 2, testdb.Count(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.a, "app_key": "x-hr"}))
}

func TestFeatureTenantAppPolicies(t *testing.T) {
	w := newAppsWorld(t)
	exec(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-hr'), ($2, 'x-hr')`, w.a, w.b)
	exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
	// The policies apply to the owner too, for the rest of the transaction (only this
	// package's tests use tenant_apps).
	exec(t, w.tx, `ALTER TABLE tenant_apps FORCE ROW LEVEL SECURITY`)
	as := func(tenant string) { exec(t, w.tx, `SELECT set_config('app.tenant_id', $1, true)`, tenant) }
	visible := func() int {
		var n int
		require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT count(*) FROM tenant_apps WHERE app_key LIKE 'x-%'`).Scan(&n))
		return n
	}

	as("")
	assert.Zero(t, visible(), "no tenant: nothing")

	as(w.a)
	assert.Equal(t, 1, visible(), "a tenant reads its own")
	_, err := savepoint(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-tasks')`, w.a)
	assert.Equal(t, "42501", code(err), "a tenant does not turn apps on")
	tag, err := savepoint(t, w.tx, `UPDATE tenant_apps SET active_to = now() WHERE tenant_id = $1`, w.a)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nor off")

	as(w.operator)
	assert.Equal(t, 2, visible(), "the operator reads every tenant's")
	tag, err = savepoint(t, w.tx, `UPDATE tenant_apps SET active_to = now() WHERE tenant_id = $1`, w.b)
	require.NoError(t, err)
	assert.EqualValues(t, 1, tag.RowsAffected(), "and turns them off")
	tag, err = savepoint(t, w.tx, `DELETE FROM tenant_apps WHERE tenant_id = $1`, w.a)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nothing deletes an activation")
}

func TestFeatureTheOperatorAppsSeeder(t *testing.T) {
	w := newAppsWorld(t)
	env := seed.NewEnv("prod", slog.New(slog.DiscardHandler))
	s := seeds.NewOperatorApps(w.tx, "x-console", "x-hr")
	assert.Equal(t, "authorization.operator_apps", s.Name())
	require.NoError(t, s.Run(t.Context(), env))
	require.NoError(t, s.Run(t.Context(), env), "running again is fine")
	testdb.AssertHas(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.operator, "app_key": "x-console", "active_to": nil})
	testdb.AssertHas(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.operator, "app_key": "x-hr", "activated_by": nil})
	assert.Equal(t, 2, testdb.Count(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.operator}))

	// An app the operator turned off stays off.
	exec(t, w.tx, `UPDATE tenant_apps SET active_to = now() WHERE tenant_id = $1 AND app_key = 'x-hr'`, w.operator)
	require.NoError(t, s.Run(t.Context(), env))
	testdb.AssertMissing(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.operator, "app_key": "x-hr", "active_to": nil})
}

func TestFeatureTheOperatorAppsSeederNeedsTheOperator(t *testing.T) {
	tx := testdb.OwnerTx(t)
	err := seeds.NewOperatorApps(tx, "x-hr").Run(t.Context(), seed.NewEnv("prod", slog.New(slog.DiscardHandler)))
	assert.ErrorContains(t, err, "find the operator")
}

func TestFeatureTheSampleAppsSeeder(t *testing.T) {
	w := newAppsWorld(t)
	s := seeds.NewSampleApps(w.tx, []string{"x-authz-a", "x-authz-b"}, "x-hr")
	assert.Equal(t, "authorization.sample_apps", s.Name())

	require.NoError(t, s.Run(t.Context(), seed.NewEnv("staging", slog.New(slog.DiscardHandler))))
	testdb.AssertMissing(t, w.tx, "tenant_apps", map[string]any{"app_key": "x-hr"})

	require.NoError(t, s.Run(t.Context(), seed.NewEnv("dev", slog.New(slog.DiscardHandler))))
	testdb.AssertHas(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.a, "app_key": "x-hr"})
	testdb.AssertHas(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.b, "app_key": "x-hr"})

	err := seeds.NewSampleApps(w.tx, []string{"x-authz-none"}, "x-hr").Run(t.Context(), seed.NewEnv("dev", slog.New(slog.DiscardHandler)))
	assert.ErrorContains(t, err, "sample tenant x-authz-none")
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

// savepoint runs sql in a savepoint, so a failure leaves the test's transaction usable.
func savepoint(t *testing.T, tx pgx.Tx, sql string, args ...any) (pgconn.CommandTag, error) {
	t.Helper()
	sp, err := tx.Begin(t.Context())
	require.NoError(t, err)
	defer func() { _ = sp.Rollback(context.Background()) }()
	tag, err := sp.Exec(t.Context(), sql, args...)
	if err == nil {
		err = sp.Commit(t.Context())
	}
	return tag, err
}

func code(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}
