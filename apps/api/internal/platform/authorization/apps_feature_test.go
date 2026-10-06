//go:build feature

package authorization_test

import (
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization/seeds"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Feature tests (C79) for the apps table and its seed file (C165), in the owner's
// rolled-back transaction with test apps (x-…).

var (
	xHR    = authorization.App{Key: "x-hr", Name: "Test HR", Kind: authorization.Workspace, Description: "People"}
	xAdmin = authorization.App{Key: "x-admin", Name: "Test admin", Kind: authorization.Operator}
)

func seedApps(t *testing.T, tx pgx.Tx, apps ...authorization.App) {
	t.Helper()
	require.NoError(t, seeds.NewApps(tx, apps).Run(t.Context(), seed.NewEnv("test", slog.New(slog.DiscardHandler))))
}

func TestFeatureTheAppsSeederMirrorsTheCatalogue(t *testing.T) {
	tx := testdb.OwnerTx(t)
	assert.Equal(t, "authorization.apps", seeds.NewApps(tx, nil).Name())
	seedApps(t, tx, xHR, xAdmin)
	seedApps(t, tx, xHR, xAdmin) // running again is fine

	testdb.AssertHas(t, tx, "apps", map[string]any{"key": "x-hr", "name": "Test HR", "kind": "workspace", "description": "People"})
	testdb.AssertHas(t, tx, "apps", map[string]any{"key": "x-admin", "kind": "operator", "description": nil, "active_to": nil})
	assert.Equal(t, 1, testdb.Count(t, tx, "apps", map[string]any{"key": "x-hr"}))

	// A renamed app is updated; one no longer listed is retired, never deleted.
	renamed := xHR
	renamed.Name = "Test people"
	seedApps(t, tx, renamed)
	testdb.AssertHas(t, tx, "apps", map[string]any{"key": "x-hr", "name": "Test people", "active_to": nil})
	var retired bool
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT active_to IS NOT NULL FROM apps WHERE key = 'x-admin'`).Scan(&retired))
	assert.True(t, retired)

	// Listed again, it is active again.
	seedApps(t, tx, renamed, xAdmin)
	testdb.AssertHas(t, tx, "apps", map[string]any{"key": "x-admin", "active_to": nil})
}

func TestFeatureTheAppsSeederRefusesABadCatalogue(t *testing.T) {
	tx := testdb.OwnerTx(t)
	env := seed.NewEnv("test", slog.New(slog.DiscardHandler))
	for name, apps := range map[string][]authorization.App{
		"bad key":      {{Key: "X HR", Name: "x", Kind: authorization.Workspace}},
		"twice":        {xHR, xHR},
		"blank name":   {{Key: "x-blank", Name: " ", Kind: authorization.Workspace}},
		"unknown kind": {{Key: "x-kind", Name: "x", Kind: "portal"}},
	} {
		assert.Error(t, seeds.NewApps(tx, apps).Run(t.Context(), env), name)
	}
	testdb.AssertMissing(t, tx, "apps", map[string]any{"key": "x-hr"})
}

func TestFeatureTheRuntimeRoleOnlyReadsApps(t *testing.T) {
	tx := testdb.Tx(t)
	var n int
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT count(*) FROM apps`).Scan(&n), "everyone reads")
	tag, err := tx.Exec(t.Context(), `UPDATE apps SET name = 'changed'`)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "no write policy: nothing changes")
	_, err = tx.Exec(t.Context(), `INSERT INTO apps (key, name, kind) VALUES ('x-mine', 'Mine', 'workspace')`)
	assert.Error(t, err, "nor is anything added")
}

func TestFeatureAppsAreAudited(t *testing.T) {
	tx := testdb.OwnerTx(t)
	seedApps(t, tx, xHR)
	_, err := tx.Exec(t.Context(), `SET LOCAL ROLE erp_audit`) // audit_log's owner reads every row
	require.NoError(t, err)
	assert.Equal(t, 1, testdb.Count(t, tx, "audit_log", map[string]any{"entity": "apps", "record_id": "x-hr", "action": "insert"}))
}
