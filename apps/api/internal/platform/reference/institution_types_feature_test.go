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

func TestFeatureInstitutionTypePoliciesAllowOnlyReading(t *testing.T) {
	for name, sql := range map[string]string{
		"update": `UPDATE institution_types SET name = 'Changed' WHERE code = 'x_type'`,
		"delete": `DELETE FROM institution_types WHERE code = 'x_type'`,
	} {
		t.Run(name, func(t *testing.T) {
			tx := testdb.OwnerTx(t)
			insertTestInstitutionType(t, tx)
			_, err := tx.Exec(t.Context(), `ALTER TABLE institution_types FORCE ROW LEVEL SECURITY`)
			require.NoError(t, err)

			var visible bool
			require.NoError(t, tx.QueryRow(t.Context(),
				`SELECT EXISTS (SELECT 1 FROM institution_types WHERE code = 'x_type')`).Scan(&visible))
			assert.True(t, visible, "everyone reads institution types")

			tag, err := tx.Exec(t.Context(), sql)
			require.NoError(t, err)
			assert.Zero(t, tag.RowsAffected(), "no write policy: no row is visible to change")
		})
	}
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
	insertTestInstitutionType(t, tx)
	for _, sql := range []string{
		`ALTER TABLE institution_types DISABLE TRIGGER institution_types_updated_at`,
		`UPDATE institution_types SET updated_at = '2000-01-01' WHERE code = 'x_type'`,
		`ALTER TABLE institution_types ENABLE TRIGGER institution_types_updated_at`,
		`UPDATE institution_types SET name = 'Test type again' WHERE code = 'x_type'`,
	} {
		_, err := tx.Exec(t.Context(), sql)
		require.NoError(t, err, sql)
	}
	var setToNow bool
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT updated_at = now() FROM institution_types WHERE code = 'x_type'`).Scan(&setToNow))
	assert.True(t, setToNow, "the trigger sets updated_at on every change")
}
