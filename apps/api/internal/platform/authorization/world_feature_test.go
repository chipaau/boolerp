//go:build feature

package authorization_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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
