//go:build feature

package tenancy_test

import (
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/seeds"
)

// Feature tests (C79) for the apps table and its seed file (C165), in the owner's
// rolled-back transaction with test apps (x-…).

var (
	xHR    = authorization.App{Key: "x-thr", Name: "Test HR", Kind: authorization.Workspace, Description: "People", IsDefault: true}
	xAdmin = authorization.App{Key: "x-tadmin", Name: "Test admin", Kind: authorization.Operator}
)

func seedApps(t *testing.T, tx pgx.Tx, apps ...authorization.App) {
	t.Helper()
	require.NoError(t, seeds.NewApps(tx, apps).Run(t.Context(), seed.NewEnv("test", slog.New(slog.DiscardHandler))))
}

func TestFeatureTheAppsSeederMirrorsTheCatalogue(t *testing.T) {
	tx := testdb.OwnerTx(t)
	assert.Equal(t, "tenancy.apps", seeds.NewApps(tx, nil).Name())
	seedApps(t, tx, xHR, xAdmin)
	seedApps(t, tx, xHR, xAdmin) // running again is fine

	testdb.AssertHas(t, tx, "apps", map[string]any{"key": "x-thr", "name": "Test HR", "kind": "workspace", "description": "People", "is_default": true})
	testdb.AssertHas(t, tx, "apps", map[string]any{"key": "x-tadmin", "kind": "operator", "description": nil, "is_default": false, "active_to": nil})
	assert.Equal(t, 1, testdb.Count(t, tx, "apps", map[string]any{"key": "x-thr"}))

	// A renamed app is updated; one no longer listed is retired, never deleted.
	renamed := xHR
	renamed.Name, renamed.IsDefault = "Test people", false
	seedApps(t, tx, renamed)
	testdb.AssertHas(t, tx, "apps", map[string]any{"key": "x-thr", "name": "Test people", "is_default": false, "active_to": nil})
	var retired bool
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT active_to IS NOT NULL FROM apps WHERE key = 'x-tadmin'`).Scan(&retired))
	assert.True(t, retired)

	// Listed again, it is active again.
	seedApps(t, tx, renamed, xAdmin)
	testdb.AssertHas(t, tx, "apps", map[string]any{"key": "x-tadmin", "active_to": nil})
}

func TestFeatureTheAppsSeederRefusesABadCatalogue(t *testing.T) {
	tx := testdb.OwnerTx(t)
	env := seed.NewEnv("test", slog.New(slog.DiscardHandler))
	for name, apps := range map[string][]authorization.App{
		"bad key":              {{Key: "X HR", Name: "x", Kind: authorization.Workspace}},
		"twice":                {xHR, xHR},
		"blank name":           {{Key: "x-tblank", Name: " ", Kind: authorization.Workspace}},
		"unknown kind":         {{Key: "x-tkind", Name: "x", Kind: "portal"}},
		"default operator app": {{Key: "x-top", Name: "x", Kind: authorization.Operator, IsDefault: true}},
	} {
		assert.Error(t, seeds.NewApps(tx, apps).Run(t.Context(), env), name)
	}
	testdb.AssertMissing(t, tx, "apps", map[string]any{"key": "x-thr"})
}

func TestFeatureOnlyAWorkspaceAppCanBeADefaultApp(t *testing.T) {
	tx := testdb.OwnerTx(t)
	for _, kind := range []string{"operator", "product"} {
		_, err := tx.Exec(t.Context(), `SAVEPOINT s`)
		require.NoError(t, err)
		_, err = tx.Exec(t.Context(), `INSERT INTO apps (key, name, kind, is_default) VALUES ('x-tdefault', 'x', $1, true)`, kind)
		var pgErr *pgconn.PgError
		require.ErrorAs(t, err, &pgErr, kind)
		assert.Equal(t, "23514", pgErr.Code, "a CHECK violation for a default %s app", kind)
		_, err = tx.Exec(t.Context(), `ROLLBACK TO SAVEPOINT s`)
		require.NoError(t, err)
	}
}

func TestFeatureTheRuntimeRoleOnlyReadsApps(t *testing.T) {
	tx := testdb.Tx(t)
	var n int
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT count(*) FROM apps`).Scan(&n), "everyone reads")
	tag, err := tx.Exec(t.Context(), `UPDATE apps SET name = 'changed'`)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "no write policy: nothing changes")
	_, err = tx.Exec(t.Context(), `INSERT INTO apps (key, name, kind) VALUES ('x-tmine', 'Mine', 'workspace')`)
	assert.Error(t, err, "nor is anything added")
}

func TestFeatureAppsAreAudited(t *testing.T) {
	tx := testdb.OwnerTx(t)
	seedApps(t, tx, xHR)
	_, err := tx.Exec(t.Context(), `SET LOCAL ROLE erp_audit`) // audit_log's owner reads every row
	require.NoError(t, err)
	assert.Equal(t, 1, testdb.Count(t, tx, "audit_log", map[string]any{"entity": "apps", "record_id": "x-thr", "action": "insert"}))
}
