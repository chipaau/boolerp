//go:build feature

package seeds

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Test codes start with x_, which no seeded sector uses.
const testSectors = "code,name\nx_test,Test sector\nx_other,Other test sector\n"

func TestFeatureSectorsSeederAddsAndRestores(t *testing.T) {
	tx := testdb.OwnerTx(t)
	s := &Sectors{db: tx, data: []byte(testSectors)}
	require.NoError(t, s.Run(t.Context(), env()))

	_, err := tx.Exec(t.Context(), `UPDATE sectors SET name = 'Renamed', active_to = active_from WHERE code = 'x_test'`)
	require.NoError(t, err)
	require.NoError(t, s.Run(t.Context(), env()))
	require.NoError(t, s.Run(t.Context(), env()))

	var name string
	var rows int
	var retired bool
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT name FROM sectors WHERE code = 'x_test'`).Scan(&name))
	assert.Equal(t, "Test sector", name, "a changed row is put back")
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT count(*), bool_or(active_to IS NOT NULL) FROM sectors WHERE code LIKE 'x\_%'`).Scan(&rows, &retired))
	assert.Equal(t, 2, rows, "running again never duplicates")
	assert.True(t, retired, "the seeder never touches retirement dates")
}

func TestFeatureNewSectorsUsesTheEmbeddedList(t *testing.T) {
	tx := testdb.OwnerTx(t)
	require.NoError(t, NewSectors(tx).Run(t.Context(), env()))
	var name string
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT name FROM sectors WHERE code = 'health'`).Scan(&name))
	assert.Equal(t, "Health", name)
}
