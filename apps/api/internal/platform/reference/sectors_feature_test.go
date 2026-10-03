//go:build feature

package reference_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// insertTestSector adds the sector x_test (no seeded sector starts with x_).
func insertTestSector(t *testing.T, tx pgx.Tx) {
	t.Helper()
	_, err := tx.Exec(t.Context(), `INSERT INTO sectors (code, name) VALUES ('x_test', 'Test sector')`)
	require.NoError(t, err)
}

func TestFeatureTheRuntimeRoleCannotAddSectors(t *testing.T) {
	_, err := testdb.Tx(t).Exec(t.Context(), `INSERT INTO sectors (code, name) VALUES ('x_test', 'Test sector')`)
	require.Error(t, err, "no write policy: row-level security refuses the insert")
}

func TestFeatureSectorPoliciesAllowOnlyReading(t *testing.T) {
	for name, sql := range map[string]string{
		"update": `UPDATE sectors SET name = 'Changed' WHERE code = 'x_test'`,
		"delete": `DELETE FROM sectors WHERE code = 'x_test'`,
	} {
		t.Run(name, func(t *testing.T) {
			tx := testdb.OwnerTx(t)
			insertTestSector(t, tx)
			_, err := tx.Exec(t.Context(), `ALTER TABLE sectors FORCE ROW LEVEL SECURITY`)
			require.NoError(t, err)

			var visible bool
			require.NoError(t, tx.QueryRow(t.Context(),
				`SELECT EXISTS (SELECT 1 FROM sectors WHERE code = 'x_test')`).Scan(&visible))
			assert.True(t, visible, "everyone reads sectors")

			tag, err := tx.Exec(t.Context(), sql)
			require.NoError(t, err)
			assert.Zero(t, tag.RowsAffected(), "no write policy: no row is visible to change")
		})
	}
}

func TestFeatureSectorConstraints(t *testing.T) {
	for name, sql := range map[string]string{
		"bad code":       `INSERT INTO sectors (code, name) VALUES ('X Test', 'Other')`,
		"blank name":     `INSERT INTO sectors (code, name) VALUES ('x_other', '  ')`,
		"duplicate code": `INSERT INTO sectors (code, name) VALUES ('x_test', 'Again')`,
		"retired before in use": `INSERT INTO sectors (code, name, active_from, active_to)
			VALUES ('x_other', 'Other', now(), now() - interval '1 day')`,
	} {
		t.Run(name, func(t *testing.T) {
			tx := testdb.OwnerTx(t)
			insertTestSector(t, tx)
			_, err := tx.Exec(t.Context(), sql)
			var pgErr *pgconn.PgError
			require.ErrorAs(t, err, &pgErr)
			assert.Contains(t, []string{"23514", "23505"}, pgErr.Code, "a CHECK or unique violation")
		})
	}
}

func TestFeatureSectorUpdatedAtFollowsChanges(t *testing.T) {
	tx := testdb.OwnerTx(t)
	insertTestSector(t, tx)
	for _, sql := range []string{
		`ALTER TABLE sectors DISABLE TRIGGER sectors_updated_at`,
		`UPDATE sectors SET updated_at = '2000-01-01' WHERE code = 'x_test'`,
		`ALTER TABLE sectors ENABLE TRIGGER sectors_updated_at`,
		`UPDATE sectors SET name = 'Test sector again' WHERE code = 'x_test'`,
	} {
		_, err := tx.Exec(t.Context(), sql)
		require.NoError(t, err, sql)
	}
	var setToNow bool
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT updated_at = now() FROM sectors WHERE code = 'x_test'`).Scan(&setToNow))
	assert.True(t, setToNow, "the trigger sets updated_at on every change")
}
