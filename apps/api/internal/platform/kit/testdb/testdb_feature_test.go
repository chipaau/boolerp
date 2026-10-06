//go:build feature

package testdb

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFeatureTxRunsAsTheRuntimeRole(t *testing.T) {
	var user string
	require.NoError(t, Tx(t).QueryRow(t.Context(), "SELECT current_user").Scan(&user))
	assert.Equal(t, "erp_app", user)
}

func TestFeatureTxIsRolledBackWhenTheTestEnds(t *testing.T) {
	var tx pgx.Tx
	t.Run("inner", func(t *testing.T) {
		tx = Tx(t)
		// A setting local to the transaction stands in for a written row.
		_, err := tx.Exec(t.Context(), "SET LOCAL application_name = 'inside-test'")
		require.NoError(t, err)
	})
	_, err := tx.Exec(context.Background(), "SELECT 1")
	assert.ErrorIs(t, err, pgx.ErrTxClosed, "the transaction ended with its test")
}

func TestFeatureSuiteAndPlatformDatabasesAreSeparate(t *testing.T) {
	assert.NotEqual(t, Settings(t, RuntimeRole).Name, PlatformSettings(t, RuntimeRole).Name)
}

func TestFeatureAssertionsMatchNull(t *testing.T) {
	tx := OwnerTx(t)
	_, err := tx.Exec(t.Context(), `CREATE TABLE x_testdb_rows (name text, note text)`)
	require.NoError(t, err)
	_, err = tx.Exec(t.Context(), `INSERT INTO x_testdb_rows VALUES ('a', NULL), ('b', 'set')`)
	require.NoError(t, err)

	AssertHas(t, tx, "x_testdb_rows", map[string]any{"name": "a", "note": nil})
	AssertMissing(t, tx, "x_testdb_rows", map[string]any{"name": "b", "note": nil})
	assert.Equal(t, 1, Count(t, tx, "x_testdb_rows", map[string]any{"note": nil}))
	assert.Equal(t, 2, Count(t, tx, "x_testdb_rows", nil))
}
