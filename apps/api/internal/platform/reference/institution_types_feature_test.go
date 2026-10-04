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

// insertTestInstitutionType adds the sector x_test and its type x_type.
func insertTestInstitutionType(t *testing.T, tx pgx.Tx) {
	t.Helper()
	insertTestSector(t, tx)
	_, err := tx.Exec(t.Context(),
		`INSERT INTO institution_types (code, sector, name) VALUES ('x_type', 'x_test', 'Test type')`)
	require.NoError(t, err)
}

func TestFeatureTheRuntimeRoleCannotAddInstitutionTypes(t *testing.T) {
	_, err := testdb.Tx(t).Exec(t.Context(),
		`INSERT INTO institution_types (code, sector, name) VALUES ('x_type', 'health', 'Test type')`)
	require.Error(t, err, "no write policy: row-level security refuses the insert")
}

func TestFeatureInstitutionTypeConstraints(t *testing.T) {
	const insert = `INSERT INTO institution_types (code, sector, name) VALUES `
	for name, sql := range map[string]string{
		"unknown sector": insert + `('x_other', 'x_none', 'Other')`,
		"bad code":       insert + `('X Other', 'x_test', 'Other')`,
		"blank name":     insert + `('x_other', 'x_test', '  ')`,
		"duplicate code": insert + `('x_type', 'x_test', 'Again')`,
		"retired before in use": `INSERT INTO institution_types (code, sector, name, active_from, active_to)
			VALUES ('x_other', 'x_test', 'Other', now(), now() - interval '1 day')`,
		"deleting its sector": `DELETE FROM sectors WHERE code = 'x_test'`,
	} {
		t.Run(name, func(t *testing.T) {
			tx := testdb.OwnerTx(t)
			insertTestInstitutionType(t, tx)
			_, err := tx.Exec(t.Context(), sql)
			var pgErr *pgconn.PgError
			require.ErrorAs(t, err, &pgErr)
			// CHECK, unique, foreign key, or ON DELETE RESTRICT violation.
			assert.Contains(t, []string{"23514", "23505", "23503", "23001"}, pgErr.Code)
		})
	}
}

func TestFeatureInstitutionTypeUpdatedAtFollowsChanges(t *testing.T) {
	tx := testdb.OwnerTx(t)
	insertTestSector(t, tx)
	assertUpdatedAtFollowsChanges(t, tx,
		`INSERT INTO institution_types (code, sector, name, updated_at) VALUES ('x_type', 'x_test', 'Test type', '2000-01-01')`,
		`UPDATE institution_types SET name = 'Test type again' WHERE code = 'x_type'`,
		`SELECT updated_at = now() FROM institution_types WHERE code = 'x_type'`)
}
