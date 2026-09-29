package postgres

import (
	"cmp"
	"context"
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"strconv"
	"sync"
	"testing"
	"testing/fstest"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/postgres/migrations"
)

// These tests need a PostgreSQL initialized by docker/postgres/init/10-roles.sh,
// with the migration and runtime roles' credentials in POSTGRES_TEST_MIGRATE_*
// and POSTGRES_TEST_APP_* (see docs/testing.md). They are skipped otherwise.

// roleSettings returns settings for the role whose credentials are in
// POSTGRES_TEST_<role>_USER and _PASSWORD.
func roleSettings(t *testing.T, role string) Settings {
	t.Helper()
	user := os.Getenv("POSTGRES_TEST_" + role + "_USER")
	if user == "" {
		t.Skip("POSTGRES_TEST_" + role + "_USER not set")
	}
	port, _ := strconv.Atoi(cmp.Or(os.Getenv("POSTGRES_TEST_PORT"), "5432"))
	return Settings{
		Host:     cmp.Or(os.Getenv("POSTGRES_TEST_HOST"), "localhost"),
		Port:     port,
		Name:     cmp.Or(os.Getenv("POSTGRES_TEST_DB"), "erp"),
		User:     user,
		Password: os.Getenv("POSTGRES_TEST_" + role + "_PASSWORD"),
		SSLMode:  "disable",
		MaxConns: 2,
	}
}

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
	db, err := OpenDB(roleSettings(t, "MIGRATE"))
	require.NoError(t, err)
	t.Cleanup(func() {
		ctx := context.Background()
		_, _ = db.ExecContext(ctx, "DROP TABLE IF EXISTS migration_probe")
		_, _ = db.ExecContext(ctx, "DROP TABLE IF EXISTS "+HistoryTable)
		_ = db.Close()
	})
	return Migrate(t.Context(), db, fsys, slog.New(slog.DiscardHandler))
}

func TestMigrateAppliesOnceAndRecordsHistory(t *testing.T) {
	applied, err := migrateProbe(t, probe)
	require.NoError(t, err)
	assert.Equal(t, 1, applied)

	db, err := OpenDB(roleSettings(t, "MIGRATE"))
	require.NoError(t, err)
	defer db.Close()
	again, err := Migrate(t.Context(), db, probe, slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	assert.Zero(t, again, "a second run applies nothing")

	var version int64
	require.NoError(t, db.QueryRowContext(t.Context(),
		"SELECT max(version_id) FROM "+HistoryTable).Scan(&version))
	assert.EqualValues(t, 1, version)
}

func TestMigrateConcurrentRunsApplyOnce(t *testing.T) {
	_, err := migrateProbe(t, fstest.MapFS{}) // creates the history table and cleanup
	require.NoError(t, err)

	var wg sync.WaitGroup
	results := make([]int, 3)
	errs := make([]error, 3)
	for i := range results {
		wg.Go(func() {
			db, err := OpenDB(roleSettings(t, "MIGRATE"))
			if err != nil {
				errs[i] = err
				return
			}
			defer db.Close()
			results[i], errs[i] = Migrate(t.Context(), db, probe, slog.New(slog.DiscardHandler))
		})
	}
	wg.Wait()

	for _, err := range errs {
		require.NoError(t, err)
	}
	assert.Equal(t, 1, results[0]+results[1]+results[2], "the lock lets exactly one run apply it")
}

func TestMigrateFailureOmitsStatementAndValues(t *testing.T) {
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

func TestRuntimeRolePrivileges(t *testing.T) {
	_, err := migrateProbe(t, probe)
	require.NoError(t, err)

	pool, err := NewPool(t.Context(), roleSettings(t, "APP"))
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
		"cannot read migration history": "SELECT count(*) FROM " + HistoryTable,
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

func TestEmbeddedMigrationsApply(t *testing.T) {
	applied, err := migrateProbe(t, migrations.FS())
	require.NoError(t, err)
	assert.Zero(t, applied, "there are no application migrations yet")
}

func TestMigrateFailsWhenItCannotConnect(t *testing.T) {
	s := roleSettings(t, "MIGRATE")
	s.Password = "s3cret-wrong"
	db, err := OpenDB(s)
	require.NoError(t, err)
	defer db.Close()

	// No migrations to apply, but the run must still fail.
	_, err = Migrate(t.Context(), db, migrations.FS(), slog.New(slog.DiscardHandler))
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "s3cret-wrong")
}
