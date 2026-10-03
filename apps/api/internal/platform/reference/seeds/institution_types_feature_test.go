//go:build feature

package seeds

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Test codes start with x_, which no seeded sector or type uses.
const testTypes = "code,sector,name\nx_type,x_test,Test type\nx_other_type,x_test,Other test type\n"

func TestFeatureInstitutionTypesSeederAddsAndRestores(t *testing.T) {
	tx := testdb.OwnerTx(t)
	require.NoError(t, (&Sectors{db: tx, data: []byte(testSectors)}).Run(t.Context(), env()))
	s := &InstitutionTypes{db: tx, data: []byte(testTypes)}
	require.NoError(t, s.Run(t.Context(), env()))

	_, err := tx.Exec(t.Context(),
		`UPDATE institution_types SET sector = 'x_other', active_to = active_from WHERE code = 'x_type'`)
	require.NoError(t, err)
	require.NoError(t, s.Run(t.Context(), env()))
	require.NoError(t, s.Run(t.Context(), env()))

	var sector string
	var rows int
	var retired bool
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT sector FROM institution_types WHERE code = 'x_type'`).Scan(&sector))
	assert.Equal(t, "x_test", sector, "a changed row is put back")
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT count(*), bool_or(active_to IS NOT NULL) FROM institution_types WHERE code LIKE 'x\_%'`).Scan(&rows, &retired))
	assert.Equal(t, 2, rows, "running again never duplicates")
	assert.True(t, retired, "the seeder never touches retirement dates")
}

func TestFeatureInstitutionTypesNeedTheirSector(t *testing.T) {
	tx := testdb.OwnerTx(t)
	require.Error(t, (&InstitutionTypes{db: tx, data: []byte(testTypes)}).Run(t.Context(), env()),
		"x_test is not a sector here")
}

func TestFeatureNewInstitutionTypesUsesTheEmbeddedList(t *testing.T) {
	tx := testdb.OwnerTx(t)
	require.NoError(t, NewSectors(tx).Run(t.Context(), env()))
	require.NoError(t, NewInstitutionTypes(tx).Run(t.Context(), env()))
	var sector string
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT sector FROM institution_types WHERE code = 'pharmacy'`).Scan(&sector))
	assert.Equal(t, "health", sector)
}
