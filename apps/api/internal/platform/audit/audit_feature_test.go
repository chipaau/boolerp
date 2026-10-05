//go:build feature

package audit_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/audit/seeds"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Feature tests (C79) for the audit trigger, audit_log's guards and row-level
// security, and the partitions. Scratch tables (x_audit_*) are created in the owner's
// rolled-back transaction, so the tests never touch real tables' rows.

// Every table is audited (C164): a table created by any module's migration without
// audit.enable fails here. audit_log itself is not audited, and its partitions are in
// the audit schema.
func TestFeatureEveryTableIsAudited(t *testing.T) {
	rows, err := testdb.Tx(t).Query(t.Context(), `
		SELECT c.relname::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
		 WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relispartition
		   AND NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = c.oid AND t.tgname = 'audit')
		 ORDER BY 1`)
	require.NoError(t, err)
	missing, err := pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	assert.Empty(t, missing, "call audit.enable in each table's migration")

	var tables int
	require.NoError(t, testdb.Tx(t).QueryRow(t.Context(), `SELECT count(*) FROM pg_trigger WHERE tgname = 'audit'`).Scan(&tables))
	assert.GreaterOrEqual(t, tables, 9, "the platform's tables are all there")
}

const (
	tenantA = "0192f6a0-0000-7000-8000-00000000aa01"
	tenantB = "0192f6a0-0000-7000-8000-00000000bb01"
	userID  = "0192f6a0-0000-7000-8000-00000000c001"
	thingID = "0192f6a0-0000-7000-8000-00000000d001"
)

// things is a scratch audited table with a tenant, a secret column that is excluded,
// and updated_at, in the owner's transaction.
func things(t *testing.T) pgx.Tx {
	t.Helper()
	tx := testdb.OwnerTx(t)
	exec(t, tx, `CREATE TABLE x_audit_things (id uuid PRIMARY KEY, tenant_id uuid, name text, secret text,
		updated_at timestamptz NOT NULL DEFAULT now())`)
	exec(t, tx, `CREATE TRIGGER x_audit_things_updated_at BEFORE UPDATE ON x_audit_things
		FOR EACH ROW EXECUTE FUNCTION set_updated_at()`)
	exec(t, tx, `SELECT audit.enable('x_audit_things', exclude => ARRAY['secret'])`)
	return tx
}

// entry is an audit row as the tests read it.
type entry struct {
	Action, RecordID                   string
	TenantID                           *string
	Old, New                           map[string]any
	Changed                            []string
	UserID, ClientID, ActingTenant, Op *string
	RequestID, IP                      *string
	DBRole                             string
}

// entries reads entity's audit rows in order, as erp_audit (the owner, past row-level
// security), then returns to the migration role.
func entries(t *testing.T, tx pgx.Tx, entity string) []entry {
	t.Helper()
	exec(t, tx, `SET LOCAL ROLE erp_audit`)
	defer exec(t, tx, `RESET ROLE`)
	rows, err := tx.Query(t.Context(), `
		SELECT action, record_id, tenant_id::text, old_values, new_values, changed_columns,
		       actor_user_id::text, actor_client_id, actor_tenant_id::text, operation, request_id, host(ip), db_role
		  FROM audit_log WHERE entity = $1 ORDER BY occurred_at, id`, entity)
	require.NoError(t, err)
	found, err := pgx.CollectRows(rows, pgx.RowToStructByPos[entry])
	require.NoError(t, err)
	return found
}

func TestFeatureTheTriggerRecordsEveryChange(t *testing.T) {
	tx := things(t)
	exec(t, tx, `INSERT INTO x_audit_things (id, tenant_id, name, secret) VALUES ($1, $2, 'first', 's3cret')`, thingID, tenantA)
	exec(t, tx, `UPDATE x_audit_things SET name = 'second', secret = 'other' WHERE id = $1`, thingID)
	exec(t, tx, `UPDATE x_audit_things SET name = 'second' WHERE id = $1`, thingID)  // changes only updated_at
	exec(t, tx, `UPDATE x_audit_things SET secret = 'third' WHERE id = $1`, thingID) // only an excluded column
	exec(t, tx, `DELETE FROM x_audit_things WHERE id = $1`, thingID)

	got := entries(t, tx, "x_audit_things")
	require.Len(t, got, 4, "a no-op update records nothing")
	for _, e := range got {
		assert.Equal(t, thingID, e.RecordID)
		assert.Equal(t, tenantA, *e.TenantID, "the row's tenant")
		assert.NotContains(t, e.Old, "secret")
		assert.NotContains(t, e.New, "secret")
	}

	assert.Equal(t, "insert", got[0].Action)
	assert.Nil(t, got[0].Old)
	assert.Equal(t, "first", got[0].New["name"])
	assert.Contains(t, got[0].New, "updated_at", "an insert records the whole row")

	assert.Equal(t, "update", got[1].Action)
	assert.Equal(t, []string{"name", "secret"}, got[1].Changed, "excluded columns are listed as changed")
	assert.Equal(t, map[string]any{"name": "first"}, got[1].Old, "only the changed columns, never the excluded value")
	assert.Equal(t, map[string]any{"name": "second"}, got[1].New)

	assert.Equal(t, []string{"secret"}, got[2].Changed)
	assert.Nil(t, got[2].Old, "the excluded column's values are never recorded")
	assert.Nil(t, got[2].New)

	assert.Equal(t, "delete", got[3].Action)
	assert.Equal(t, "second", got[3].Old["name"])
	assert.Nil(t, got[3].New)
}

func TestFeatureTheTriggerRecordsTheActor(t *testing.T) {
	tx := things(t)
	ctx := actor.With(t.Context(), actor.Actor{UserID: userID, ClientID: "bff-workspace",
		Operation: "PATCH /api/v1/things/{id}", RequestID: "req-1", IP: "203.0.113.7"})
	require.NoError(t, actor.Apply(ctx, tx, tenantB))
	exec(t, tx, `INSERT INTO x_audit_things (id, name) VALUES ($1, 'global')`, thingID)

	got := entries(t, tx, "x_audit_things")
	require.Len(t, got, 1)
	e := got[0]
	assert.Nil(t, e.TenantID, "no tenant column value: a global row")
	assert.Equal(t, userID, *e.UserID)
	assert.Equal(t, "bff-workspace", *e.ClientID)
	assert.Equal(t, tenantB, *e.ActingTenant)
	assert.Equal(t, "PATCH /api/v1/things/{id}", *e.Op)
	assert.Equal(t, "req-1", *e.RequestID)
	assert.Equal(t, "203.0.113.7", *e.IP)
	assert.Equal(t, sessionUser(t, tx), e.DBRole, "the login role, not erp_audit")
}

func TestFeatureAWriteWithoutAnActorIsStillRecorded(t *testing.T) {
	tx := things(t)
	exec(t, tx, `INSERT INTO x_audit_things (id, name) VALUES ($1, 'manual fix')`, thingID)
	got := entries(t, tx, "x_audit_things")
	require.Len(t, got, 1)
	assert.Nil(t, got[0].UserID)
	assert.Nil(t, got[0].Op)
	assert.Equal(t, sessionUser(t, tx), got[0].DBRole, "who ran it is always known")
}

func TestFeatureACompositeKeyIsTheRecordID(t *testing.T) {
	tx := testdb.OwnerTx(t)
	exec(t, tx, `CREATE TABLE x_audit_pairs (a text, b text, PRIMARY KEY (a, b))`)
	exec(t, tx, `SELECT audit.enable('x_audit_pairs')`)
	exec(t, tx, `INSERT INTO x_audit_pairs VALUES ('left', 'right')`)
	got := entries(t, tx, "x_audit_pairs")
	require.Len(t, got, 1)
	assert.Equal(t, "left/right", got[0].RecordID)
	assert.Nil(t, got[0].TenantID)
}

func TestFeatureEnableRefusesWhatItCannotAudit(t *testing.T) {
	tx := testdb.OwnerTx(t)
	exec(t, tx, `CREATE TABLE x_audit_keyless (name text)`)
	exec(t, tx, `CREATE TABLE x_audit_keyed (id uuid PRIMARY KEY)`)
	for name, sql := range map[string]string{
		"no primary key":           `SELECT audit.enable('x_audit_keyless')`,
		"an unknown excluded":      `SELECT audit.enable('x_audit_keyed', exclude => ARRAY['nope'])`,
		"an unknown tenant column": `SELECT audit.enable('x_audit_keyed', tenant_column => 'nope')`,
	} {
		_, err := savepoint(t, tx, sql)
		assert.Error(t, err, name)
	}
}

func TestFeatureAuditLogIsAppendOnly(t *testing.T) {
	tx := things(t)
	exec(t, tx, `INSERT INTO x_audit_things (id, name) VALUES ($1, 'x')`, thingID)
	exec(t, tx, `SET LOCAL ROLE erp_audit`) // even the owner
	for name, sql := range map[string]string{
		"update":               `UPDATE audit_log SET entity = 'changed' WHERE entity = 'x_audit_things'`,
		"delete":               `DELETE FROM audit_log WHERE entity = 'x_audit_things'`,
		"truncate":             `TRUNCATE audit_log`,
		"truncate a partition": `TRUNCATE audit.audit_log_default`,
	} {
		_, err := savepoint(t, tx, sql)
		assert.Equal(t, "42501", code(err), name)
	}
	exec(t, tx, `RESET ROLE`)
	assert.Len(t, entries(t, tx, "x_audit_things"), 1)
}

func TestFeatureTheRuntimeRoleOnlyReadsThroughThePolicies(t *testing.T) {
	tx := testdb.Tx(t)
	_, err := savepoint(t, tx, `INSERT INTO audit_log (action, entity, record_id) VALUES ('insert', 'x', 'x')`)
	assert.Equal(t, "42501", code(err), "no one but the trigger writes")
	_, err = savepoint(t, tx, `SELECT count(*) FROM audit.audit_log_default`)
	assert.Equal(t, "42501", code(err), "a partition is out of reach (it would bypass the policies)")
	_, err = savepoint(t, tx, `SELECT count(*) FROM audit_log`)
	assert.NoError(t, err, "audit_log itself is readable, through its policies")
}

func TestFeatureATenantReadsOnlyItsOwnRows(t *testing.T) {
	tx := things(t)
	exec(t, tx, `INSERT INTO x_audit_things (id, tenant_id, name) VALUES ($1, $2, 'a')`, thingID, tenantA)
	exec(t, tx, `INSERT INTO x_audit_things (id, tenant_id, name) VALUES ('0192f6a0-0000-7000-8000-00000000d002', $1, 'b')`, tenantB)
	exec(t, tx, `INSERT INTO x_audit_things (id, name) VALUES ('0192f6a0-0000-7000-8000-00000000d003', 'global')`)

	// The migration role is not audit_log's owner, so its policies apply to it.
	visible := func(tenant string) int {
		exec(t, tx, `SELECT set_config('app.tenant_id', $1, true)`, tenant)
		var n int
		require.NoError(t, tx.QueryRow(t.Context(), `SELECT count(*) FROM audit_log WHERE entity = 'x_audit_things'`).Scan(&n))
		return n
	}
	assert.Equal(t, 0, visible(""), "no tenant: nothing")
	assert.Equal(t, 1, visible(tenantA), "its own row only, not B's or a global one")
	assert.Equal(t, 1, visible(tenantB))
}

func TestFeatureThePartitionsSeederCreatesTheMonthsAhead(t *testing.T) {
	tx := testdb.OwnerTx(t)
	exec(t, tx, `SET LOCAL ROLE erp_audit`)
	exec(t, tx, `CREATE TABLE x_audit_parts (occurred_at timestamptz NOT NULL) PARTITION BY RANGE (occurred_at)`)
	exec(t, tx, `RESET ROLE`)

	s := seeds.NewPartitionsOf(tx, "x_audit_parts", 2)
	assert.Equal(t, "audit.partitions", s.Name())
	env := seed.NewEnv("test", slog.New(slog.DiscardHandler))
	require.NoError(t, s.Run(t.Context(), env))
	require.NoError(t, s.Run(t.Context(), env), "running again is fine")

	now := time.Now().UTC()
	next := now.AddDate(0, 1, 1-now.Day())
	for _, m := range []time.Time{now, next} {
		var exists bool
		require.NoError(t, tx.QueryRow(t.Context(), `SELECT to_regclass($1) IS NOT NULL`,
			"audit.x_audit_parts_y"+m.Format("2006")+"m"+m.Format("01")).Scan(&exists))
		assert.True(t, exists, m.Format("2006-01"))
	}
	var parts int
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT count(*) FROM pg_inherits WHERE inhparent = 'x_audit_parts'::regclass`).Scan(&parts))
	assert.Equal(t, 2, parts, "running again creates nothing")

	exec(t, tx, `SET LOCAL ROLE erp_audit`) // the owner writes; the migration role may not
	exec(t, tx, `INSERT INTO x_audit_parts VALUES (now())`)
	var lands string
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT tableoid::regclass::text FROM x_audit_parts`).Scan(&lands))
	assert.Equal(t, "audit.x_audit_parts_y"+now.Format("2006")+"m"+now.Format("01"), lands)
}

func TestFeatureThePartitionsSeederOnlyTouchesAuditTables(t *testing.T) {
	tx := testdb.OwnerTx(t)
	exec(t, tx, `CREATE TABLE x_audit_mine (occurred_at timestamptz NOT NULL) PARTITION BY RANGE (occurred_at)`)
	err := seeds.NewPartitionsOf(tx, "x_audit_mine", 1).Run(t.Context(), seed.NewEnv("test", slog.New(slog.DiscardHandler)))
	assert.ErrorContains(t, err, "not an audit table")
}

func sessionUser(t *testing.T, tx pgx.Tx) string {
	t.Helper()
	var u string
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT session_user::text`).Scan(&u))
	return u
}

func exec(t *testing.T, tx pgx.Tx, sql string, args ...any) {
	t.Helper()
	_, err := tx.Exec(t.Context(), sql, args...)
	require.NoError(t, err, sql)
}

// savepoint runs sql in a savepoint, so a failure leaves the test's transaction usable.
func savepoint(t *testing.T, tx pgx.Tx, sql string, args ...any) (pgconn.CommandTag, error) {
	t.Helper()
	sp, err := tx.Begin(t.Context())
	require.NoError(t, err)
	defer func() { _ = sp.Rollback(context.Background()) }()
	tag, err := sp.Exec(t.Context(), sql, args...)
	if err == nil {
		err = sp.Commit(t.Context())
	}
	return tag, err
}

func code(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}
