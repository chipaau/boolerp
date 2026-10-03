//go:build feature

package seeds

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// withTestCountry adds the ISO user-assigned country XA inside tx, for the forms
// to reference.
func withTestCountry(t *testing.T, tx pgx.Tx) {
	t.Helper()
	_, err := tx.Exec(t.Context(),
		`INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XA', 'XAA', 'Testland', '+999')`)
	require.NoError(t, err)
}

const testForms = `country,code,name,category,identity_document
XA,test_company,Test company,private,Test registration number
XA,test_ministry,Test ministry,government,
`

func form(t *testing.T, tx pgx.Tx, code string) (f LegalForm) {
	t.Helper()
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT country, code, name, category, coalesce(identity_document, '') FROM legal_forms
		  WHERE country = 'XA' AND code = $1`, code).
		Scan(&f.Country, &f.Code, &f.Name, &f.Category, &f.IdentityDocument))
	return f
}

func TestFeatureLegalFormsSeederAddsAndRestores(t *testing.T) {
	tx := testdb.OwnerTx(t)
	withTestCountry(t, tx)
	s := &LegalForms{db: tx, data: []byte(testForms)}
	require.NoError(t, s.Run(t.Context(), env()))
	assert.Equal(t, LegalForm{"XA", "test_company", "Test company", "private", "Test registration number"},
		form(t, tx, "test_company"))
	assert.Equal(t, LegalForm{"XA", "test_ministry", "Test ministry", "government", ""},
		form(t, tx, "test_ministry"), "an empty document is stored as none")

	_, err := tx.Exec(t.Context(),
		`UPDATE legal_forms SET category = 'non_profit', active_to = active_from WHERE code = 'test_company'`)
	require.NoError(t, err)
	require.NoError(t, s.Run(t.Context(), env()))
	require.NoError(t, s.Run(t.Context(), env()))
	assert.Equal(t, "private", form(t, tx, "test_company").Category, "a changed row is put back")

	var rows int
	var retired bool
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT count(*), bool_or(active_to IS NOT NULL) FROM legal_forms WHERE country = 'XA'`).Scan(&rows, &retired))
	assert.Equal(t, 2, rows, "running again never duplicates")
	assert.True(t, retired, "the seeder never touches retirement dates")
}

func TestFeatureLegalFormsNeedTheirCountry(t *testing.T) {
	tx := testdb.OwnerTx(t)
	err := (&LegalForms{db: tx, data: []byte(testForms)}).Run(t.Context(), env())
	require.Error(t, err, "XA is not a country here")
}

func TestFeatureNewLegalFormsUsesTheEmbeddedLists(t *testing.T) {
	tx := testdb.OwnerTx(t)
	require.NoError(t, NewCountries(tx).Run(t.Context(), env()))
	require.NoError(t, NewLegalForms(tx).Run(t.Context(), env()))
	var category string
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT category FROM legal_forms WHERE country = 'MV' AND code = 'local_council'`).Scan(&category))
	assert.Equal(t, "government", category)
}
