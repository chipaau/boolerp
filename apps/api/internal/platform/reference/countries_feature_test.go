//go:build feature

package reference_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/postgres"
	"github.com/boolmv/erp/apps/api/internal/testdb"
)

func TestFeatureTheMaldivesIsOffered(t *testing.T) {
	var alpha3, name, prefix string
	err := testdb.Tx(t).QueryRow(t.Context(),
		`SELECT alpha3, name, phone_prefix FROM countries WHERE code = 'MV'`).Scan(&alpha3, &name, &prefix)
	require.NoError(t, err)
	assert.Equal(t, "MDV", alpha3)
	assert.Equal(t, "Maldives", name)
	assert.Equal(t, "+960", prefix)
}

func TestFeatureTheRuntimeRoleCannotChangeCountries(t *testing.T) {
	for name, sql := range map[string]string{
		"insert": `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('LK', 'LKA', 'Sri Lanka', '+94')`,
		"update": `UPDATE countries SET name = 'Changed' WHERE code = 'MV'`,
		"delete": `DELETE FROM countries WHERE code = 'MV'`,
	} {
		t.Run(name, func(t *testing.T) {
			tag, err := testdb.Tx(t).Exec(t.Context(), sql)
			if name == "insert" {
				require.Error(t, err, "no write policy: row-level security refuses the insert")
				return
			}
			require.NoError(t, err)
			assert.Zero(t, tag.RowsAffected(), "no write policy: no row is visible to change")
		})
	}
}

// ownerTx is a rolled-back transaction as the migration role, which owns the
// table, to test its constraints.
func ownerTx(t *testing.T) pgx.Tx {
	t.Helper()
	pool, err := postgres.NewPool(t.Context(), testdb.Settings(t, testdb.MigrationRole))
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	tx, err := pool.Begin(t.Context())
	require.NoError(t, err)
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })
	return tx
}

func TestFeatureCountryConstraints(t *testing.T) {
	for name, sql := range map[string]string{
		"lowercase code":   `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('lk', 'LKA', 'Sri Lanka', '+94')`,
		"bad alpha-3":      `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('LK', 'LK1', 'Sri Lanka', '+94')`,
		"blank name":       `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('LK', 'LKA', '  ', '+94')`,
		"prefix without +": `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('LK', 'LKA', 'Sri Lanka', '94')`,
		"duplicate alpha3": `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XM', 'MDV', 'Elsewhere', '+1')`,
		"retired before offered": `INSERT INTO countries (code, alpha3, name, phone_prefix, active_from, active_to)
			VALUES ('LK', 'LKA', 'Sri Lanka', '+94', now(), now() - interval '1 day')`,
	} {
		t.Run(name, func(t *testing.T) {
			_, err := ownerTx(t).Exec(t.Context(), sql)
			var pgErr *pgconn.PgError
			require.ErrorAs(t, err, &pgErr)
			assert.Contains(t, []string{"23514", "23505"}, pgErr.Code, "a CHECK or unique violation")
		})
	}
}

func TestFeatureUpdatedAtFollowsChanges(t *testing.T) {
	tx := ownerTx(t)
	// Backdate updated_at with the trigger off, then change a column with it on.
	for _, sql := range []string{
		`ALTER TABLE countries DISABLE TRIGGER countries_updated_at`,
		`UPDATE countries SET updated_at = '2000-01-01' WHERE code = 'MV'`,
		`ALTER TABLE countries ENABLE TRIGGER countries_updated_at`,
		`UPDATE countries SET name = 'Maldives' WHERE code = 'MV'`,
	} {
		_, err := tx.Exec(t.Context(), sql)
		require.NoError(t, err, sql)
	}
	var setToNow bool
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT updated_at = now() FROM countries WHERE code = 'MV'`).Scan(&setToNow))
	assert.True(t, setToNow, "the trigger sets updated_at on every change")
}
