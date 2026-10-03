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

// The policies apply to the runtime role; forcing row-level security inside the
// owner's rolled-back transaction applies them to the owner too, so the row the
// test created is subject to them.
func TestFeatureCountryPoliciesAllowOnlyReading(t *testing.T) {
	for name, sql := range map[string]string{
		"update": `UPDATE countries SET name = 'Changed' WHERE code = 'XA'`,
		"delete": `DELETE FROM countries WHERE code = 'XA'`,
	} {
		t.Run(name, func(t *testing.T) {
			tx := testdb.OwnerTx(t)
			insertTestCountry(t, tx)
			_, err := tx.Exec(t.Context(), `ALTER TABLE countries FORCE ROW LEVEL SECURITY`)
			require.NoError(t, err)

			var visible bool
			require.NoError(t, tx.QueryRow(t.Context(),
				`SELECT EXISTS (SELECT 1 FROM countries WHERE code = 'XA')`).Scan(&visible))
			assert.True(t, visible, "everyone reads countries")

			tag, err := tx.Exec(t.Context(), sql)
			require.NoError(t, err)
			assert.Zero(t, tag.RowsAffected(), "no write policy: no row is visible to change")
		})
	}
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
	tx := testdb.OwnerTx(t)
	insertTestCountry(t, tx)
	// Backdate updated_at with the trigger off, then change a column with it on.
	for _, sql := range []string{
		`ALTER TABLE countries DISABLE TRIGGER countries_updated_at`,
		`UPDATE countries SET updated_at = '2000-01-01' WHERE code = 'XA'`,
		`ALTER TABLE countries ENABLE TRIGGER countries_updated_at`,
		`UPDATE countries SET name = 'Testland Again' WHERE code = 'XA'`,
	} {
		_, err := tx.Exec(t.Context(), sql)
		require.NoError(t, err, sql)
	}
	var setToNow bool
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT updated_at = now() FROM countries WHERE code = 'XA'`).Scan(&setToNow))
	assert.True(t, setToNow, "the trigger sets updated_at on every change")
}
