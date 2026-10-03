//go:build feature

package reference_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Tests here change no table settings (no ALTER TABLE): other packages' tests use
// these tables at the same time, and a test's table lock would make them wait or
// deadlock.

// assertEveryoneOnlyReads checks table's row-level security in the catalog: it is
// enabled, and its only policy lets everyone read every row. With no write policy
// the runtime role's inserts are refused and its updates and deletes match nothing.
func assertEveryoneOnlyReads(t *testing.T, table string) {
	t.Helper()
	tx := testdb.Tx(t)
	var enabled bool
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass`, table).Scan(&enabled))
	assert.True(t, enabled, "%s has row-level security", table)

	rows, err := tx.Query(t.Context(),
		`SELECT cmd || ' ' || array_to_string(roles, ',') || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '')
		   FROM pg_policies WHERE schemaname = 'public' AND tablename = $1`, table)
	require.NoError(t, err)
	policies, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	assert.Equal(t, []string{"SELECT public true "}, policies, "%s: one read policy for everyone, no write policy", table)
}

// assertUpdatedAtFollowsChanges inserts a row with a past updated_at (the trigger
// runs on updates only), changes it, and checks the trigger set updated_at to now.
func assertUpdatedAtFollowsChanges(t *testing.T, tx pgx.Tx, insert, update, read string) {
	t.Helper()
	_, err := tx.Exec(t.Context(), insert)
	require.NoError(t, err, insert)
	_, err = tx.Exec(t.Context(), update)
	require.NoError(t, err, update)
	var setToNow bool
	require.NoError(t, tx.QueryRow(t.Context(), read).Scan(&setToNow), read)
	assert.True(t, setToNow, "the trigger sets updated_at on every change")
}

func TestFeatureReferenceTablesAreReadOnlyForEveryone(t *testing.T) {
	for _, table := range []string{"countries", "legal_forms", "sectors", "institution_types"} {
		t.Run(table, func(t *testing.T) { assertEveryoneOnlyReads(t, table) })
	}
}
