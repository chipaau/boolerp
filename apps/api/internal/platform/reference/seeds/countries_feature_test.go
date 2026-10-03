//go:build feature

package seeds

import (
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// The seeder runs inside the owner's rolled-back transaction (its Begin is a
// savepoint there), with a small list of ISO user-assigned codes, so the test
// neither depends on nor changes the suite database's rows.
const testList = `code,alpha3,name,phone_prefix
XA,XAA,Testland,+999
XB,XBB,Otherland,+998
`

func env() seed.Env { return seed.NewEnv("test", slog.New(slog.DiscardHandler)) }

func country(t *testing.T, tx pgx.Tx, code string) (c Country) {
	t.Helper()
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT code, alpha3, name, phone_prefix FROM countries WHERE code = $1`, code).
		Scan(&c.Code, &c.Alpha3, &c.Name, &c.PhonePrefix))
	return c
}

func TestFeatureCountriesSeederAddsTheList(t *testing.T) {
	tx := testdb.OwnerTx(t)
	require.NoError(t, (&Countries{db: tx, data: []byte(testList)}).Run(t.Context(), env()))
	assert.Equal(t, Country{"XA", "XAA", "Testland", "+999"}, country(t, tx, "XA"))
	assert.Equal(t, Country{"XB", "XBB", "Otherland", "+998"}, country(t, tx, "XB"))
}

func TestFeatureCountriesSeederIsIdempotentAndRestoresChanges(t *testing.T) {
	tx := testdb.OwnerTx(t)
	s := &Countries{db: tx, data: []byte(testList)}
	require.NoError(t, s.Run(t.Context(), env()))

	// A changed row is put back; a retirement date is the operators' and stays.
	_, err := tx.Exec(t.Context(),
		`UPDATE countries SET name = 'Renamed', active_to = active_from WHERE code = 'XA'`)
	require.NoError(t, err)
	require.NoError(t, s.Run(t.Context(), env()))
	require.NoError(t, s.Run(t.Context(), env()))

	assert.Equal(t, Country{"XA", "XAA", "Testland", "+999"}, country(t, tx, "XA"))
	var rows int
	var retired bool
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT count(*), bool_or(active_to IS NOT NULL) FROM countries WHERE code IN ('XA', 'XB')`).
		Scan(&rows, &retired))
	assert.Equal(t, 2, rows, "running again never duplicates")
	assert.True(t, retired, "the seeder never touches retirement dates")
}

func TestFeatureCountriesSeederLeavesTheTableAsItWasOnFailure(t *testing.T) {
	tx := testdb.OwnerTx(t)
	first := "code,alpha3,name,phone_prefix\nXA,XAA,Testland,+999\n"
	require.NoError(t, (&Countries{db: tx, data: []byte(first)}).Run(t.Context(), env()))
	_, err := tx.Exec(t.Context(), `UPDATE countries SET alpha3 = 'XCC' WHERE code = 'XA'`)
	require.NoError(t, err)
	// XB is fine, but XD takes the alpha3 XA now holds, which the table refuses.
	clash := "code,alpha3,name,phone_prefix\nXB,XBB,Otherland,+998\nXD,XCC,Clash,+997\n"

	require.Error(t, (&Countries{db: tx, data: []byte(clash)}).Run(t.Context(), env()))
	var added bool
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT EXISTS (SELECT 1 FROM countries WHERE code = 'XB')`).Scan(&added))
	assert.False(t, added, "the whole list is one transaction")
}

func TestFeatureNewCountriesUsesTheEmbeddedList(t *testing.T) {
	tx := testdb.OwnerTx(t)
	require.NoError(t, NewCountries(tx).Run(t.Context(), env()))
	assert.Equal(t, Country{"MV", "MDV", "Maldives", "+960"}, country(t, tx, "MV"))
}
