//go:build feature

package postgres_test

import (
	"context"
	"errors"
	"io/fs"
	"log/slog"
	"sync"
	"testing"
	"testing/fstest"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/edition/full"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Feature tests (C77). The migrator, privilege, and concurrency tests run on
// the un-migrated platform database (testdb.PlatformSettings, C79): they
// create and drop schema objects, which cannot happen inside the suite
// database's rolled-back test transactions.

// probe is a test-only migration. It is never part of the embedded migrations.
var probe = fstest.MapFS{"00001_probe.sql": {Data: []byte(`-- +goose Up
CREATE TABLE migration_probe (
    id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    note text NOT NULL
);
`)}}

// migrateProbe applies fsys as the migration role and removes everything it
// created when the test ends.
func migrateProbe(t *testing.T, fsys fs.FS) (int, error) {
	t.Helper()
	db, err := postgres.OpenDB(testdb.PlatformSettings(t, testdb.MigrationRole))
	require.NoError(t, err)
	t.Cleanup(func() {
		ctx := context.Background()
		_, _ = db.ExecContext(ctx, "DROP TABLE IF EXISTS migration_probe")
		_, _ = db.ExecContext(ctx, "DROP TABLE IF EXISTS "+postgres.HistoryTable("probe"))
		_ = db.Close()
	})
	return postgres.Migrate(t.Context(), db, fsys, postgres.HistoryTable("probe"), slog.New(slog.DiscardHandler))
}

func TestFeatureMigrateAppliesOnceAndRecordsHistory(t *testing.T) {
	applied, err := migrateProbe(t, probe)
	require.NoError(t, err)
	assert.Equal(t, 1, applied)

	db, err := postgres.OpenDB(testdb.PlatformSettings(t, testdb.MigrationRole))
	require.NoError(t, err)
	defer db.Close()
	again, err := postgres.Migrate(t.Context(), db, probe, postgres.HistoryTable("probe"), slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	assert.Zero(t, again, "a second run applies nothing")

	var version int64
	require.NoError(t, db.QueryRowContext(t.Context(),
		"SELECT max(version_id) FROM "+postgres.HistoryTable("probe")).Scan(&version))
	assert.EqualValues(t, 1, version)
}

func TestFeatureMigrateConcurrentRunsApplyOnce(t *testing.T) {
	_, err := migrateProbe(t, fstest.MapFS{}) // creates the history table and cleanup
	require.NoError(t, err)

	var wg sync.WaitGroup
	results := make([]int, 3)
	errs := make([]error, 3)
	for i := range results {
		wg.Go(func() {
			db, err := postgres.OpenDB(testdb.PlatformSettings(t, testdb.MigrationRole))
			if err != nil {
				errs[i] = err
				return
			}
			defer db.Close()
			results[i], errs[i] = postgres.Migrate(t.Context(), db, probe, postgres.HistoryTable("probe"), slog.New(slog.DiscardHandler))
		})
	}
	wg.Wait()

	for _, err := range errs {
		require.NoError(t, err)
	}
	assert.Equal(t, 1, results[0]+results[1]+results[2], "the lock lets exactly one run apply it")
}

func TestFeatureMigrateFailureOmitsStatementAndValues(t *testing.T) {
	bad := fstest.MapFS{
		"00001_probe.sql": probe["00001_probe.sql"],
		"00002_bad.sql": {Data: []byte(`-- +goose Up
INSERT INTO no_such_table (secret) VALUES ('s3cret-value');
`)},
	}
	_, err := migrateProbe(t, bad)

	require.Error(t, err)
	assert.ErrorContains(t, err, "00002_bad.sql")
	assert.ErrorContains(t, err, "SQLSTATE 42P01") // undefined_table
	assert.NotContains(t, err.Error(), "s3cret-value", "no statement text or values")
	assert.NotContains(t, err.Error(), "INSERT")
}

func TestFeatureRuntimeRolePrivileges(t *testing.T) {
	_, err := migrateProbe(t, probe)
	require.NoError(t, err)

	pool, err := postgres.NewPool(t.Context(), testdb.PlatformSettings(t, testdb.RuntimeRole))
	require.NoError(t, err)
	defer pool.Close()
	ctx := t.Context()

	t.Run("can read and write data", func(t *testing.T) {
		var id int64
		require.NoError(t, pool.QueryRow(ctx,
			"INSERT INTO migration_probe (note) VALUES ('a') RETURNING id").Scan(&id))
		_, err := pool.Exec(ctx, "UPDATE migration_probe SET note = 'b' WHERE id = $1", id)
		require.NoError(t, err)
		var note string
		require.NoError(t, pool.QueryRow(ctx, "SELECT note FROM migration_probe WHERE id = $1", id).Scan(&note))
		assert.Equal(t, "b", note)
		_, err = pool.Exec(ctx, "DELETE FROM migration_probe WHERE id = $1", id)
		require.NoError(t, err)
	})

	for name, statement := range map[string]string{
		"cannot create tables":          "CREATE TABLE runtime_table (id int)",
		"cannot alter tables":           "ALTER TABLE migration_probe ADD COLUMN extra int",
		"cannot drop tables":            "DROP TABLE migration_probe",
		"cannot read migration history": "SELECT count(*) FROM " + postgres.HistoryTable("probe"),
		"cannot reset sequences":        "SELECT setval(pg_get_serial_sequence('migration_probe', 'id'), 1000)",
		"cannot create schemas":         "CREATE SCHEMA runtime_schema",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := pool.Exec(ctx, statement)
			var pgErr *pgconn.PgError
			require.True(t, errors.As(err, &pgErr), "want a PostgreSQL error, got %v", err)
			assert.Equal(t, "42501", pgErr.Code, "insufficient_privilege: %s", pgErr.Message)
		})
	}
}

func TestFeatureEditionMigrationsApply(t *testing.T) {
	db, err := postgres.OpenDB(testdb.PlatformSettings(t, testdb.MigrationRole))
	require.NoError(t, err)
	t.Cleanup(func() {
		// The platform database is never migrated; leave it as it was.
		ctx := context.Background()
		_, _ = db.ExecContext(ctx, "DROP TABLE IF EXISTS users")
		for _, m := range full.Migrations {
			_, _ = db.ExecContext(ctx, "DROP TABLE IF EXISTS "+postgres.HistoryTable(m.Name))
		}
		_ = db.Close()
	})

	applied, err := postgres.MigrateModules(t.Context(), db, full.Migrations, slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	assert.Positive(t, applied, "every module's migrations apply to a fresh database")
	again, err := postgres.MigrateModules(t.Context(), db, full.Migrations, slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	assert.Zero(t, again)

	pool, err := postgres.NewPool(t.Context(), testdb.PlatformSettings(t, testdb.RuntimeRole))
	require.NoError(t, err)
	defer pool.Close()
	var users, history bool
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT to_regclass('public.users') IS NOT NULL").Scan(&users))
	assert.True(t, users, "the identity module's users table exists")
	require.NoError(t, db.QueryRowContext(t.Context(), "SELECT to_regclass('migrations.identity_version') IS NOT NULL").Scan(&history))
	assert.True(t, history, "the identity module has its own history table")
}

func TestFeatureInvalidModuleNameIsRefused(t *testing.T) {
	db, err := postgres.OpenDB(testdb.PlatformSettings(t, testdb.MigrationRole))
	require.NoError(t, err)
	defer db.Close()
	_, err = postgres.MigrateModules(t.Context(), db,
		[]postgres.ModuleMigrations{{Name: "bad; DROP TABLE x", FS: fstest.MapFS{}}}, slog.New(slog.DiscardHandler))
	assert.ErrorContains(t, err, "invalid module name")
}

func TestFeatureMigrateFailsWhenItCannotConnect(t *testing.T) {
	s := testdb.PlatformSettings(t, testdb.MigrationRole)
	s.Password = "s3cret-wrong"
	db, err := postgres.OpenDB(s)
	require.NoError(t, err)
	defer db.Close()

	// No migrations to apply, but the run must still fail.
	_, err = postgres.MigrateModules(t.Context(), db, full.Migrations, slog.New(slog.DiscardHandler))
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "s3cret-wrong")
}

func TestFeaturePoolConnects(t *testing.T) {
	pool, err := postgres.NewPool(t.Context(), testdb.Settings(t, testdb.RuntimeRole))
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	require.NoError(t, pool.Ping(ctx))
	assert.EqualValues(t, 1, pool.Stat().TotalConns())

	pool.Close()
	assert.Zero(t, pool.Stat().TotalConns(), "Close releases every connection")
}
