//go:build feature

package authorization_test

import (
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization/seeds"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Feature tests (C79) for the capabilities table and its seed file (C168).

func TestFeatureTheCapabilitiesSeederMirrorsTheApps(t *testing.T) {
	tx := testdb.OwnerTx(t)
	env := seed.NewEnv("test", slog.New(slog.DiscardHandler))
	hr := authorization.App{Key: "x-hr", Name: "Test HR", Kind: authorization.Workspace, Capabilities: []authorization.Capability{
		{Key: "x-hrms:employee:view", Name: "View employees"},
		{Key: "x-hrms:employee:manage", Name: "Manage employees", Description: "Add and change"},
	}}
	seedApps(t, tx, hr)
	s := seeds.NewCapabilities(tx, []authorization.App{hr})
	assert.Equal(t, "authorization.capabilities", s.Name())
	require.NoError(t, s.Run(t.Context(), env))
	require.NoError(t, s.Run(t.Context(), env), "running again is fine")

	testdb.AssertHas(t, tx, "capabilities", map[string]any{"key": "x-hrms:employee:view", "app_key": "x-hr",
		"name": "View employees", "description": nil, "active_to": nil})
	testdb.AssertHas(t, tx, "capabilities", map[string]any{"key": "x-hrms:employee:manage", "description": "Add and change"})

	// Dropped from the code: retired, never deleted; declared again: active again.
	hr.Capabilities = hr.Capabilities[:1]
	require.NoError(t, seeds.NewCapabilities(tx, []authorization.App{hr}).Run(t.Context(), env))
	testdb.AssertMissing(t, tx, "capabilities", map[string]any{"key": "x-hrms:employee:manage", "active_to": nil})
	assert.Equal(t, 1, testdb.Count(t, tx, "capabilities", map[string]any{"key": "x-hrms:employee:manage"}))
	hr.Capabilities = append(hr.Capabilities, authorization.Capability{Key: "x-hrms:employee:manage", Name: "Manage employees"})
	require.NoError(t, seeds.NewCapabilities(tx, []authorization.App{hr}).Run(t.Context(), env))
	testdb.AssertHas(t, tx, "capabilities", map[string]any{"key": "x-hrms:employee:manage", "active_to": nil})

	// No capabilities at all: every one is retired.
	require.NoError(t, seeds.NewCapabilities(tx, nil).Run(t.Context(), env))
	testdb.AssertMissing(t, tx, "capabilities", map[string]any{"app_key": "x-hr", "active_to": nil})
}

func TestFeatureTheCapabilitiesSeederRefusesABadCatalogue(t *testing.T) {
	tx := testdb.OwnerTx(t)
	env := seed.NewEnv("test", slog.New(slog.DiscardHandler))
	app := func(caps ...authorization.Capability) authorization.App {
		return authorization.App{Key: "x-hr", Name: "x", Kind: authorization.Workspace, Capabilities: caps}
	}
	other := authorization.App{Key: "x-other", Name: "y", Kind: authorization.Workspace,
		Capabilities: []authorization.Capability{{Key: "x:a:view", Name: "A"}}}
	for name, apps := range map[string][]authorization.App{
		"two parts":        {app(authorization.Capability{Key: "x:view", Name: "A"})},
		"an unknown level": {app(authorization.Capability{Key: "x:a:edit", Name: "A"})},
		"declared twice":   {app(authorization.Capability{Key: "x:a:view", Name: "A"}), other},
		"a blank name":     {app(authorization.Capability{Key: "x:a:view", Name: " "})},
	} {
		assert.Error(t, seeds.NewCapabilities(tx, apps).Run(t.Context(), env), name)
	}
	// An app the catalogue does not have is refused by the foreign key.
	assert.Error(t, seeds.NewCapabilities(tx, []authorization.App{other}).Run(t.Context(), env))
}

func TestFeatureTheRuntimeRoleOnlyReadsCapabilities(t *testing.T) {
	tx := testdb.Tx(t)
	var n int
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT count(*) FROM capabilities`).Scan(&n))
	_, err := savepoint(t, tx, `INSERT INTO capabilities (key, app_key, name) VALUES ('x:a:view', 'admin', 'A')`)
	assert.Error(t, err)
}
