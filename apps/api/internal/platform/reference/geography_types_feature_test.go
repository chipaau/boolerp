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

// insertTestGeographyType adds country XA and its first address level as the owner.
func insertTestGeographyType(t *testing.T, tx pgx.Tx) {
	t.Helper()
	insertTestCountry(t, tx)
	_, err := tx.Exec(t.Context(), `INSERT INTO geography_types (country, code, name, level)
		VALUES ('XA', 'test_region', 'Test region', 1)`)
	require.NoError(t, err)
}

func TestFeatureTheRuntimeRoleCannotAddGeographyTypes(t *testing.T) {
	_, err := testdb.Tx(t).Exec(t.Context(), `INSERT INTO geography_types (country, code, name, level)
		VALUES ('MV', 'test_region', 'Test region', 1)`)
	var pgErr *pgconn.PgError
	require.ErrorAs(t, err, &pgErr)
	assert.Equal(t, "42501", pgErr.Code, "no write policy: row-level security refuses the insert")
}

func TestFeatureGeographyTypeConstraints(t *testing.T) {
	const insert = `INSERT INTO geography_types (country, code, name, level) VALUES `
	for name, sql := range map[string]string{
		"unknown country": insert + `('XB', 'test_town', 'Town', 2)`,
		"bad code":        insert + `('XA', 'Test Town', 'Town', 2)`,
		"blank name":      insert + `('XA', 'test_town', '  ', 2)`,
		"level zero":      insert + `('XA', 'test_town', 'Town', 0)`,
		"level ten":       insert + `('XA', 'test_town', 'Town', 10)`,
		"duplicate code":  insert + `('XA', 'test_region', 'Again', 2)`,
		"retired before in use": `INSERT INTO geography_types (country, code, name, level, active_from, active_to)
			VALUES ('XA', 'test_town', 'Town', 2, now(), now() - interval '1 day')`,
		"deleting its country": `DELETE FROM countries WHERE code = 'XA'`,
	} {
		t.Run(name, func(t *testing.T) {
			tx := testdb.OwnerTx(t)
			insertTestGeographyType(t, tx)
			_, err := tx.Exec(t.Context(), sql)
			var pgErr *pgconn.PgError
			require.ErrorAs(t, err, &pgErr)
			// CHECK, unique, foreign key, or ON DELETE RESTRICT violation.
			assert.Contains(t, []string{"23514", "23505", "23503", "23001"}, pgErr.Code)
		})
	}
}

// Several types share a level (the Maldives' atolls and cities), and a code is unique
// only within its country.
func TestFeatureGeographyTypesShareLevelsAndCodesAcrossCountries(t *testing.T) {
	tx := testdb.OwnerTx(t)
	insertTestGeographyType(t, tx)
	for _, sql := range []string{
		`INSERT INTO geography_types (country, code, name, level) VALUES ('XA', 'test_city', 'Test city', 1)`,
		`INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XB', 'XBB', 'Otherland', '+998')`,
		`INSERT INTO geography_types (country, code, name, level) VALUES ('XB', 'test_region', 'Test region', 1)`,
	} {
		_, err := tx.Exec(t.Context(), sql)
		require.NoError(t, err, sql)
	}
}

func TestFeatureGeographyTypeUpdatedAtFollowsChanges(t *testing.T) {
	tx := testdb.OwnerTx(t)
	insertTestCountry(t, tx)
	assertUpdatedAtFollowsChanges(t, tx,
		`INSERT INTO geography_types (country, code, name, level, updated_at) VALUES ('XA', 'test_region', 'Test region', 1, '2000-01-01')`,
		`UPDATE geography_types SET name = 'Test region again' WHERE code = 'test_region'`,
		`SELECT updated_at = now() FROM geography_types WHERE code = 'test_region'`)
}
