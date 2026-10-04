//go:build feature

// Package testdb gives feature tests their databases (C77, C79).
//
// The suite database is migrated once, before the tests run, by
// .github/scripts/run-feature-tests.sh with the real migrate command. Tests
// never migrate it: each one works in a transaction that is rolled back when
// it ends (Tx), so nothing persists and parallel test packages cannot see each
// other's data.
//
// The platform database has the same role setup but is never migrated. It is
// only for tests of the migrator, role privileges, and concurrency, which
// cannot run inside a rolled-back transaction.
package testdb

import (
	"cmp"
	"context"
	"os"
	"slices"
	"strconv"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
)

// Roles, as used in POSTGRES_TEST_<role>_USER and _PASSWORD.
const (
	RuntimeRole   = "APP"     // the restricted role the API connects as
	MigrationRole = "MIGRATE" // the role that owns the schema
)

// Settings returns connection settings for role on the migrated suite database
// (POSTGRES_TEST_DB). It fails the test when the environment is not configured:
// feature tests never skip.
func Settings(t testing.TB, role string) postgres.Settings {
	t.Helper()
	return settings(t, "POSTGRES_TEST_DB", role)
}

// PlatformSettings returns connection settings for role on the un-migrated
// platform database (POSTGRES_TEST_PLATFORM_DB).
func PlatformSettings(t testing.TB, role string) postgres.Settings {
	t.Helper()
	return settings(t, "POSTGRES_TEST_PLATFORM_DB", role)
}

func settings(t testing.TB, dbVar, role string) postgres.Settings {
	t.Helper()
	get := func(name string) string {
		v := os.Getenv(name)
		if v == "" {
			t.Fatalf("%s is not set; feature tests need PostgreSQL (see docs/testing.md)", name)
		}
		return v
	}
	port, err := strconv.Atoi(cmp.Or(os.Getenv("POSTGRES_TEST_PORT"), "5432"))
	if err != nil {
		t.Fatalf("POSTGRES_TEST_PORT: %v", err)
	}
	return postgres.Settings{
		Host:     get("POSTGRES_TEST_HOST"),
		Port:     port,
		Name:     get(dbVar),
		User:     get("POSTGRES_TEST_" + role + "_USER"),
		Password: get("POSTGRES_TEST_" + role + "_PASSWORD"),
		SSLMode:  "disable",
		MaxConns: 4,
	}
}

var (
	poolOnce sync.Once
	pool     *pgxpool.Pool
	poolErr  error
)

// Pool returns the test binary's shared pool on the suite database, connected
// as the restricted runtime role, like the API. Prefer Tx in tests.
func Pool(t testing.TB) *pgxpool.Pool {
	t.Helper()
	s := Settings(t, RuntimeRole)
	poolOnce.Do(func() {
		pool, poolErr = postgres.NewPool(context.Background(), s)
	})
	if poolErr != nil {
		t.Fatalf("test pool: %v", poolErr)
	}
	return pool
}

// Tx begins a transaction on the suite database as the runtime role and rolls
// it back when the test ends, so nothing the test writes persists. Pass it to
// the code under test wherever that code accepts a database or transaction.
func Tx(t testing.TB) pgx.Tx {
	t.Helper()
	tx, err := Pool(t).Begin(t.Context())
	if err != nil {
		t.Fatalf("begin test transaction: %v", err)
	}
	t.Cleanup(func() {
		// t.Context() is already cancelled when cleanups run.
		_ = tx.Rollback(context.Background())
	})
	return tx
}

// OwnerTx begins a transaction on the suite database as the migration role, which
// owns the tables, and rolls it back when the test ends. Use it to create rows the
// runtime role may not write and to test constraints; prefer Tx for everything else.
func OwnerTx(t testing.TB) pgx.Tx {
	t.Helper()
	pool, err := postgres.NewPool(t.Context(), Settings(t, MigrationRole))
	if err != nil {
		t.Fatalf("owner pool: %v", err)
	}
	t.Cleanup(pool.Close)
	tx, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatalf("begin owner transaction: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })
	return tx
}

// Querier runs a query: a test's transaction (Tx, OwnerTx) or a pool.
type Querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Count returns how many rows of table match every column = value in where, like
// Laravel's assertDatabaseCount. Table and column names are quoted; values are
// bound parameters.
func Count(t testing.TB, q Querier, table string, where map[string]any) int {
	t.Helper()
	sql := "SELECT count(*) FROM " + pgx.Identifier{table}.Sanitize()
	args := make([]any, 0, len(where))
	cols := make([]string, 0, len(where))
	for col := range where {
		cols = append(cols, col)
	}
	slices.Sort(cols) // a stable statement, for readable failures
	for i, col := range cols {
		if i == 0 {
			sql += " WHERE "
		} else {
			sql += " AND "
		}
		args = append(args, where[col])
		sql += pgx.Identifier{col}.Sanitize() + " = $" + strconv.Itoa(len(args))
	}
	var n int
	if err := q.QueryRow(context.Background(), sql, args...).Scan(&n); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	return n
}

// AssertHas fails the test unless table has a row matching where, like Laravel's
// assertDatabaseHas: after a create or update, the record is stored as expected.
func AssertHas(t testing.TB, q Querier, table string, where map[string]any) {
	t.Helper()
	if Count(t, q, table, where) == 0 {
		t.Errorf("%s has no row matching %v", table, where)
	}
}

// AssertMissing fails the test if table has a row matching where, like Laravel's
// assertDatabaseMissing: after a delete, or when nothing should have been written.
func AssertMissing(t testing.TB, q Querier, table string, where map[string]any) {
	t.Helper()
	if n := Count(t, q, table, where); n > 0 {
		t.Errorf("%s has %d row(s) matching %v", table, n, where)
	}
}
