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

// Tests create the rows they need (C135) with ISO's user-assigned codes (XA, XAA,
// …), which no real country has, so they never depend on or clash with seeded data.

// insertTestCountry adds a country as the table's owner, inside tx.
func insertTestCountry(t *testing.T, tx pgx.Tx) {
	t.Helper()
	_, err := tx.Exec(t.Context(),
		`INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XA', 'XAA', 'Testland', '+999')`)
	require.NoError(t, err)
}

func TestFeatureTheRuntimeRoleCannotAddCountries(t *testing.T) {
	_, err := testdb.Tx(t).Exec(t.Context(),
		`INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XA', 'XAA', 'Testland', '+999')`)
	require.Error(t, err, "no write policy: row-level security refuses the insert")
}

func TestFeatureCountryConstraints(t *testing.T) {
	for name, sql := range map[string]string{
		"lowercase code":   `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('xb', 'XBB', 'Testland', '+999')`,
		"bad alpha-3":      `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XB', 'XB1', 'Testland', '+999')`,
		"blank name":       `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XB', 'XBB', '  ', '+999')`,
		"prefix without +": `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XB', 'XBB', 'Testland', '999')`,
		"duplicate alpha3": `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XB', 'XAA', 'Elsewhere', '+999')`,
		"withdrawn before it entered": `INSERT INTO countries (code, alpha3, name, phone_prefix, active_from, active_to)
			VALUES ('XB', 'XBB', 'Testland', '+999', now(), now() - interval '1 day')`,
	} {
		t.Run(name, func(t *testing.T) {
			tx := testdb.OwnerTx(t)
			insertTestCountry(t, tx)
			_, err := tx.Exec(t.Context(), sql)
			var pgErr *pgconn.PgError
			require.ErrorAs(t, err, &pgErr)
			assert.Contains(t, []string{"23514", "23505"}, pgErr.Code, "a CHECK or unique violation")
		})
	}
}

func TestFeatureUpdatedAtFollowsChanges(t *testing.T) {
	assertUpdatedAtFollowsChanges(t, testdb.OwnerTx(t),
		`INSERT INTO countries (code, alpha3, name, phone_prefix, updated_at) VALUES ('XA', 'XAA', 'Testland', '+999', '2000-01-01')`,
		`UPDATE countries SET name = 'Testland Again' WHERE code = 'XA'`,
		`SELECT updated_at = now() FROM countries WHERE code = 'XA'`)
}
