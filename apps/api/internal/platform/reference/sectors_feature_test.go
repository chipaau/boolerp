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
	assertUpdatedAtFollowsChanges(t, testdb.OwnerTx(t),
		`INSERT INTO sectors (code, name, updated_at) VALUES ('x_test', 'Test sector', '2000-01-01')`,
		`UPDATE sectors SET name = 'Test sector again' WHERE code = 'x_test'`,
		`SELECT updated_at = now() FROM sectors WHERE code = 'x_test'`)
}
