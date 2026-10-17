//go:build feature

package authorization_test

import (
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
	tenancyseeds "github.com/boolmv/erp/apps/api/internal/platform/tenancy/seeds"
)

// The roles tests' world (C79), in the owner's rolled-back transaction: a test country,
// an operator, two tenants, and test apps of each kind. The apps and their activations are
// tenancy's tables (C206); the tests here only need them to exist.

// seedApps writes apps into the catalogue with its seed file, as a release would.
func seedApps(t *testing.T, tx pgx.Tx, apps ...authorization.App) {
	t.Helper()
	require.NoError(t, tenancyseeds.NewApps(tx, apps).Run(t.Context(), seed.NewEnv("test", slog.New(slog.DiscardHandler))))
}

type appsWorld struct {
	tx             pgx.Tx
	operator, a, b string
}

func newAppsWorld(t *testing.T) appsWorld {
	t.Helper()
	tx := testdb.OwnerTx(t)
	testdb.Exec(t, tx, `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XV', 'XVV', 'Appland', '+997')`)
	form := testdb.ID(t, tx, `INSERT INTO legal_forms (country, code, name, category)
		VALUES ('XV', 'test_ministry', 'Test ministry', 'government') RETURNING id`)
	const insert = `INSERT INTO tenants (slug, code, name, country, legal_form_id, timezone, is_operator)
		VALUES ($1, $2, $3, 'XV', $4, 'Etc/UTC', $5) RETURNING id`
	w := appsWorld{tx: tx,
		operator: testdb.ID(t, tx, insert, "x-authz-operator", "XAOP", "Test operator", form, true),
		a:        testdb.ID(t, tx, insert, "x-authz-a", "XAA", "A", form, false),
		b:        testdb.ID(t, tx, insert, "x-authz-b", "XAB", "B", form, false),
	}
	testdb.Exec(t, tx, `INSERT INTO apps (key, name, kind, is_available) VALUES ('x-hr', 'Test HR', 'workspace', true),
		('x-console', 'Test console', 'operator', true), ('x-tasks', 'Test tasks', 'workspace', true),
		('x-gone', 'Gone', 'workspace', true)`)
	testdb.Exec(t, tx, `UPDATE apps SET active_to = now() WHERE key = 'x-gone'`)
	return w
}
