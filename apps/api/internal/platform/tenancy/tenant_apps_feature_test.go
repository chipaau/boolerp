//go:build feature

package tenancy_test

import (
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/seeds"
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
	testdb.Exec(t, tx, `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XW', 'XWW', 'Appland', '+997')`)
	form := testdb.ID(t, tx, `INSERT INTO legal_forms (country, code, name, category)
		VALUES ('XW', 'test_ministry', 'Test ministry', 'government') RETURNING id`)
	const insert = `INSERT INTO tenants (slug, code, name, country, legal_form_id, timezone, is_operator)
		VALUES ($1, $2, $3, 'XW', $4, 'Etc/UTC', $5) RETURNING id`
	w := appsWorld{tx: tx,
		operator: testdb.ID(t, tx, insert, "x-tapps-operator", "XPOP", "Test operator", form, true),
		a:        testdb.ID(t, tx, insert, "x-tapps-a", "XPA", "A", form, false),
		b:        testdb.ID(t, tx, insert, "x-tapps-b", "XPB", "B", form, false),
	}
	testdb.Exec(t, tx, `INSERT INTO apps (key, name, kind, is_available) VALUES ('x-thr', 'Test HR', 'workspace', true),
		('x-tconsole', 'Test console', 'operator', true), ('x-ttasks', 'Test tasks', 'workspace', true),
		('x-tgone', 'Gone', 'workspace', true), ('x-tsoon', 'Coming soon', 'workspace', false)`)
	testdb.Exec(t, tx, `UPDATE apps SET active_to = now() WHERE key = 'x-tgone'`)
	return w
}

func TestFeatureTenantAppRules(t *testing.T) {
	w := newAppsWorld(t)
	live := testdb.ID(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-thr') RETURNING id`, w.a)
	testdb.ID(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-tconsole') RETURNING id`, w.operator)

	for name, sql := range map[string]string{
		"a second live activation":  `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ('` + w.a + `', 'x-thr')`,
		"an operator app elsewhere": `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ('` + w.a + `', 'x-tconsole')`,
		"a retired app":             `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ('` + w.a + `', 'x-tgone')`,
		"an app coming soon":        `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ('` + w.a + `', 'x-tsoon')`,
		"an unknown app":            `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ('` + w.a + `', 'x-tnope')`,
		"moving it to a tenant":     `UPDATE tenant_apps SET tenant_id = '` + w.b + `' WHERE id = '` + live + `'`,
		"changing its app":          `UPDATE tenant_apps SET app_key = 'x-tconsole' WHERE id = '` + live + `'`,
		"ending before it began":    `UPDATE tenant_apps SET active_to = active_from - interval '1 day' WHERE id = '` + live + `'`,
	} {
		_, err := testdb.Savepoint(t, w.tx, sql)
		assert.Error(t, err, name)
	}

	// Turned off, then on again: a new row, the old one frozen history.
	testdb.Exec(t, w.tx, `UPDATE tenant_apps SET active_to = now() WHERE id = $1`, live)
	testdb.ID(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-thr') RETURNING id`, w.a)
	_, err := testdb.Savepoint(t, w.tx, `UPDATE tenant_apps SET active_to = NULL WHERE id = $1`, live)
	assert.Equal(t, "23514", testdb.PgCode(err), "an ended activation cannot change")
	assert.Equal(t, 2, testdb.Count(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.a, "app_key": "x-thr"}))
}

func TestFeatureTenantAppPolicies(t *testing.T) {
	w := newAppsWorld(t)
	testdb.Exec(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-thr'), ($2, 'x-thr')`, w.a, w.b)
	testdb.Exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
	// The policies apply to the owner too, for the rest of the transaction.
	testdb.Exec(t, w.tx, `ALTER TABLE tenant_apps FORCE ROW LEVEL SECURITY`)
	as := func(tenant string) { testdb.Exec(t, w.tx, `SELECT set_config('app.tenant_id', $1, true)`, tenant) }
	visible := func() int {
		var n int
		require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT count(*) FROM tenant_apps WHERE app_key LIKE 'x-%'`).Scan(&n))
		return n
	}

	as("")
	assert.Zero(t, visible(), "no tenant: nothing")

	as(w.a)
	assert.Equal(t, 1, visible(), "a tenant reads its own")
	_, err := testdb.Savepoint(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-ttasks')`, w.a)
	assert.Equal(t, "42501", testdb.PgCode(err), "a tenant does not turn apps on")
	tag, err := testdb.Savepoint(t, w.tx, `UPDATE tenant_apps SET active_to = now() WHERE tenant_id = $1`, w.a)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nor off")

	as(w.operator)
	assert.Equal(t, 2, visible(), "the operator reads every tenant's")
	tag, err = testdb.Savepoint(t, w.tx, `UPDATE tenant_apps SET active_to = now() WHERE tenant_id = $1`, w.b)
	require.NoError(t, err)
	assert.EqualValues(t, 1, tag.RowsAffected(), "and turns them off")
	tag, err = testdb.Savepoint(t, w.tx, `DELETE FROM tenant_apps WHERE tenant_id = $1`, w.a)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nothing deletes an activation")
}

// tenant_apps_on is what other modules read (C134, C206): each tenant's live activations,
// under the reader's own row-level security, and nothing can be written through it.
func TestFeatureTenantAppsOnPublishesTheLiveActivations(t *testing.T) {
	w := newAppsWorld(t)
	testdb.Exec(t, w.tx, `INSERT INTO tenant_apps (tenant_id, app_key) VALUES ($1, 'x-thr'), ($1, 'x-ttasks'), ($2, 'x-thr')`, w.a, w.b)
	testdb.Exec(t, w.tx, `UPDATE tenant_apps SET active_to = now() WHERE tenant_id = $1 AND app_key = 'x-ttasks'`, w.a)
	testdb.Exec(t, w.tx, `ALTER TABLE tenant_apps FORCE ROW LEVEL SECURITY`)
	as := func(tenant string) { testdb.Exec(t, w.tx, `SELECT set_config('app.tenant_id', $1, true)`, tenant) }
	on := func() []string {
		rows, err := w.tx.Query(t.Context(), `SELECT app_key || '@' || CASE tenant_id WHEN $1 THEN 'a' WHEN $2 THEN 'b' END
			FROM tenant_apps_on WHERE app_key LIKE 'x-t%' ORDER BY 1`, w.a, w.b)
		require.NoError(t, err)
		keys, err := pgx.CollectRows(rows, pgx.RowTo[string])
		require.NoError(t, err)
		return keys
	}

	as(w.a)
	assert.Equal(t, []string{"x-thr@a"}, on(), "a tenant's own live apps; the ended one is not on")
	as(w.operator)
	assert.Equal(t, []string{"x-thr@a", "x-thr@b"}, on(), "the operator reads every tenant's")

	_, err := testdb.Savepoint(t, w.tx, `INSERT INTO tenant_apps_on (tenant_id, app_key) VALUES ($1, 'x-ttasks')`, w.a)
	assert.Error(t, err, "nothing is written through the view")

	var readable bool
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT has_table_privilege($1, 'tenant_apps_on', 'SELECT')`,
		testdb.Settings(t, testdb.RuntimeRole).User).Scan(&readable))
	assert.True(t, readable, "the runtime role reads it")
}

func TestFeatureTheOperatorAppsSeeder(t *testing.T) {
	w := newAppsWorld(t)
	env := seed.NewEnv("prod", slog.New(slog.DiscardHandler))
	s := seeds.NewOperatorApps(w.tx, "x-tconsole", "x-thr")
	assert.Equal(t, "tenancy.operator_apps", s.Name())
	require.NoError(t, s.Run(t.Context(), env))
	require.NoError(t, s.Run(t.Context(), env), "running again is fine")
	testdb.AssertHas(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.operator, "app_key": "x-tconsole", "active_to": nil})
	testdb.AssertHas(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.operator, "app_key": "x-thr", "activated_by": nil})
	assert.Equal(t, 2, testdb.Count(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.operator}))

	// An app the operator turned off stays off.
	testdb.Exec(t, w.tx, `UPDATE tenant_apps SET active_to = now() WHERE tenant_id = $1 AND app_key = 'x-thr'`, w.operator)
	require.NoError(t, s.Run(t.Context(), env))
	testdb.AssertMissing(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.operator, "app_key": "x-thr", "active_to": nil})
}

func TestFeatureTheOperatorAppsSeederNeedsTheOperator(t *testing.T) {
	tx := testdb.OwnerTx(t)
	err := seeds.NewOperatorApps(tx, "x-thr").Run(t.Context(), seed.NewEnv("prod", slog.New(slog.DiscardHandler)))
	assert.ErrorContains(t, err, "find the operator")
}

func TestFeatureTheSampleAppsSeeder(t *testing.T) {
	w := newAppsWorld(t)
	s := seeds.NewSampleApps(w.tx, []string{"x-tapps-a", "x-tapps-b"}, "x-thr")
	assert.Equal(t, "tenancy.sample_apps", s.Name())

	require.NoError(t, s.Run(t.Context(), seed.NewEnv("staging", slog.New(slog.DiscardHandler))))
	testdb.AssertMissing(t, w.tx, "tenant_apps", map[string]any{"app_key": "x-thr"})

	require.NoError(t, s.Run(t.Context(), seed.NewEnv("dev", slog.New(slog.DiscardHandler))))
	testdb.AssertHas(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.a, "app_key": "x-thr"})
	testdb.AssertHas(t, w.tx, "tenant_apps", map[string]any{"tenant_id": w.b, "app_key": "x-thr"})

	err := seeds.NewSampleApps(w.tx, []string{"x-tapps-none"}, "x-thr").Run(t.Context(), seed.NewEnv("dev", slog.New(slog.DiscardHandler)))
	assert.ErrorContains(t, err, "sample tenant x-tapps-none")
}
