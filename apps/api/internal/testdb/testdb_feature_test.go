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
