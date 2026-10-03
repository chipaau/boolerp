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

// insertTestLegalForm adds country XA and one of its legal forms as the owner.
func insertTestLegalForm(t *testing.T, tx pgx.Tx) {
	t.Helper()
	insertTestCountry(t, tx)
	_, err := tx.Exec(t.Context(), `INSERT INTO legal_forms (country, code, name, category, identity_document)
		VALUES ('XA', 'test_company', 'Test company', 'private', 'Test registration number')`)
	require.NoError(t, err)
}

func TestFeatureTheRuntimeRoleCannotAddLegalForms(t *testing.T) {
	_, err := testdb.Tx(t).Exec(t.Context(), `INSERT INTO legal_forms (country, code, name, category)
		VALUES ('MV', 'test_company', 'Test company', 'private')`)
	require.Error(t, err, "no write policy (and no XA country): the insert is refused")
}

func TestFeatureLegalFormPoliciesAllowOnlyReading(t *testing.T) {
	for name, sql := range map[string]string{
		"update": `UPDATE legal_forms SET name = 'Changed' WHERE code = 'test_company'`,
		"delete": `DELETE FROM legal_forms WHERE code = 'test_company'`,
	} {
		t.Run(name, func(t *testing.T) {
			tx := testdb.OwnerTx(t)
			insertTestLegalForm(t, tx)
			_, err := tx.Exec(t.Context(), `ALTER TABLE legal_forms FORCE ROW LEVEL SECURITY`)
			require.NoError(t, err)

			var visible bool
			require.NoError(t, tx.QueryRow(t.Context(),
				`SELECT EXISTS (SELECT 1 FROM legal_forms WHERE code = 'test_company')`).Scan(&visible))
			assert.True(t, visible, "everyone reads legal forms")

			tag, err := tx.Exec(t.Context(), sql)
			require.NoError(t, err)
			assert.Zero(t, tag.RowsAffected(), "no write policy: no row is visible to change")
		})
	}
}

func TestFeatureLegalFormConstraints(t *testing.T) {
	const insert = `INSERT INTO legal_forms (country, code, name, category, identity_document) VALUES `
	for name, sql := range map[string]string{
		"unknown country":  insert + `('XB', 'other_form', 'Other', 'private', NULL)`,
		"bad code":         insert + `('XA', 'Other Form', 'Other', 'private', NULL)`,
		"blank name":       insert + `('XA', 'other_form', '  ', 'private', NULL)`,
		"unknown category": insert + `('XA', 'other_form', 'Other', 'commercial', NULL)`,
		"blank document":   insert + `('XA', 'other_form', 'Other', 'private', ' ')`,
		"duplicate code":   insert + `('XA', 'test_company', 'Again', 'private', NULL)`,
		"retired before offered": `INSERT INTO legal_forms (country, code, name, category, active_from, active_to)
			VALUES ('XA', 'other_form', 'Other', 'private', now(), now() - interval '1 day')`,
		"deleting its country": `DELETE FROM countries WHERE code = 'XA'`,
	} {
		t.Run(name, func(t *testing.T) {
			tx := testdb.OwnerTx(t)
			insertTestLegalForm(t, tx)
			_, err := tx.Exec(t.Context(), sql)
			var pgErr *pgconn.PgError
			require.ErrorAs(t, err, &pgErr)
			// CHECK, unique, foreign key, or ON DELETE RESTRICT violation.
			assert.Contains(t, []string{"23514", "23505", "23503", "23001"}, pgErr.Code)
		})
	}
}

func TestFeatureTheSameCodeInAnotherCountry(t *testing.T) {
	tx := testdb.OwnerTx(t)
	insertTestLegalForm(t, tx)
	_, err := tx.Exec(t.Context(),
		`INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XB', 'XBB', 'Otherland', '+998')`)
	require.NoError(t, err)
	_, err = tx.Exec(t.Context(), `INSERT INTO legal_forms (country, code, name, category)
		VALUES ('XB', 'test_company', 'Test company', 'private')`)
	require.NoError(t, err)
}

func TestFeatureLegalFormUpdatedAtFollowsChanges(t *testing.T) {
	tx := testdb.OwnerTx(t)
	insertTestLegalForm(t, tx)
	for _, sql := range []string{
		`ALTER TABLE legal_forms DISABLE TRIGGER legal_forms_updated_at`,
		`UPDATE legal_forms SET updated_at = '2000-01-01' WHERE code = 'test_company'`,
		`ALTER TABLE legal_forms ENABLE TRIGGER legal_forms_updated_at`,
		`UPDATE legal_forms SET name = 'Test company again' WHERE code = 'test_company'`,
	} {
		_, err := tx.Exec(t.Context(), sql)
		require.NoError(t, err, sql)
	}
	var setToNow bool
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT updated_at = now() FROM legal_forms WHERE code = 'test_company'`).Scan(&setToNow))
	assert.True(t, setToNow, "the trigger sets updated_at on every change")
}
