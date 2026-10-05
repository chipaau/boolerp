//go:build feature

package tenant_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

// These tests run as the runtime role and write no rows: a transaction's settings
// are all they need, so committing leaves nothing behind.

const id = "0192f6a0-0000-7000-8000-0000000000aa"

func inTenant() context.Context {
	return tenant.With(context.Background(), tenant.Tenant{ID: id, Code: "XTEN", Status: "active"})
}

// conn is one pooled connection, so a test can see what survives on it.
func conn(t *testing.T) *pgxpool.Conn {
	t.Helper()
	c, err := testdb.Pool(t).Acquire(t.Context())
	require.NoError(t, err)
	t.Cleanup(c.Release)
	return c
}

func setting(t *testing.T, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, name string) string {
	t.Helper()
	var v string
	require.NoError(t, q.QueryRow(t.Context(), `SELECT coalesce(current_setting($1, true), '')`, name).Scan(&v))
	return v
}

func TestFeatureTxSetsTheTenantForItsTransactionOnly(t *testing.T) {
	c := conn(t)
	for name, run := range map[string]func(context.Context, tenant.Beginner, func(context.Context, pgx.Tx) error) error{
		"Tx": tenant.Tx, "ReadTx": tenant.ReadTx,
	} {
		t.Run(name, func(t *testing.T) {
			err := run(inTenant(), c, func(ctx context.Context, tx pgx.Tx) error {
				assert.Equal(t, id, setting(t, tx, "app.tenant_id"))
				var current string
				require.NoError(t, tx.QueryRow(ctx, `SELECT current_tenant_id()::text`).Scan(&current))
				assert.Equal(t, id, current, "row-level security sees this tenant")
				return nil
			})
			require.NoError(t, err)
			assert.Empty(t, setting(t, c, "app.tenant_id"), "nothing survives on the pooled connection")
		})
	}
}

func TestFeatureReadTxRefusesWrites(t *testing.T) {
	err := tenant.ReadTx(inTenant(), conn(t), func(ctx context.Context, tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `INSERT INTO tenants (slug, code, name, country) VALUES ('x-ro', 'XRO', 'R', 'MV')`)
		return err
	})
	var pgErr *pgconn.PgError
	require.ErrorAs(t, err, &pgErr)
	assert.Equal(t, "25006", pgErr.Code, "read_only_sql_transaction")
}

func TestFeatureAnErrorRollsBack(t *testing.T) {
	c := conn(t)
	failed := errors.New("the operation failed")
	err := tenant.Tx(inTenant(), c, func(ctx context.Context, tx pgx.Tx) error {
		// A session-level setting stands in for a written row: it survives a
		// commit but not a rollback.
		_, err := tx.Exec(ctx, `SELECT set_config('app.probe', 'changed', false)`)
		require.NoError(t, err)
		return failed
	})
	assert.ErrorIs(t, err, failed)
	assert.Empty(t, setting(t, c, "app.probe"), "rolled back")
}

func TestFeatureATenantTransactionCannotNest(t *testing.T) {
	err := tenant.Tx(inTenant(), conn(t), func(ctx context.Context, _ pgx.Tx) error {
		return tenant.ReadTx(ctx, testdb.Pool(t), func(context.Context, pgx.Tx) error {
			t.Fatal("the nested transaction should not run")
			return nil
		})
	})
	assert.ErrorIs(t, err, tenant.ErrNested)
}

func TestFeatureTxAppliesTheActorForItsTransactionOnly(t *testing.T) {
	c := conn(t)
	ctx := actor.With(inTenant(), actor.Actor{UserID: "0192f6a0-0000-7000-8000-00000000a001", ClientID: "bff-workspace",
		Operation: "PATCH /api/v1/things/{id}", RequestID: "req-1", IP: "203.0.113.7"})
	err := tenant.Tx(ctx, c, func(_ context.Context, tx pgx.Tx) error {
		assert.Equal(t, "0192f6a0-0000-7000-8000-00000000a001", setting(t, tx, "app.actor_user_id"))
		assert.Equal(t, "bff-workspace", setting(t, tx, "app.actor_client_id"))
		assert.Equal(t, id, setting(t, tx, "app.actor_tenant_id"), "the actor acts in the transaction's tenant")
		assert.Equal(t, "PATCH /api/v1/things/{id}", setting(t, tx, "app.operation"))
		assert.Equal(t, "req-1", setting(t, tx, "app.request_id"))
		assert.Equal(t, "203.0.113.7", setting(t, tx, "app.ip"))
		return nil
	})
	require.NoError(t, err)
	assert.Empty(t, setting(t, c, "app.actor_user_id"), "nothing survives on the pooled connection")
}
