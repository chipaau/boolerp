//go:build integration

// Package dbtest is the integration-test harness: a throwaway Postgres 18 (Testcontainers) with
// all migrations + seeds applied, plus a per-test transaction that rolls back (DatabaseTransactions
// style) so tests are isolated without truncating between them. Guarded by the `integration` build
// tag so unit `go test ./...` needs no Docker.
package dbtest

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib" // "pgx" database/sql driver for migrations
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	appdb "github.com/boolmv/erp/internal/db"
)

// Env is a running test database: a live pool over a throwaway container with the schema applied.
type Env struct {
	// Pool connects as the migration OWNER role (goerp) — which the Postgres Docker image also
	// makes a superuser. Fine for fixture setup, but a superuser bypasses Row-Level Security
	// unconditionally, no matter what FORCE ROW LEVEL SECURITY says — so a test asserting actual
	// RLS enforcement must use AppPool instead.
	Pool *pgxpool.Pool
	// AppPool connects as goerp_app — the same non-owner, non-superuser role the real API uses at
	// runtime (created by migration 00002_app_role.sql). RLS applies to it for real.
	AppPool   *pgxpool.Pool
	DSN       string
	container *tcpostgres.PostgresContainer
}

// Start boots Postgres 18, applies every migration (schema + seeds) as the owner, and returns a
// pool. Call Close when done (typically from TestMain). One container serves a whole test package.
func Start(ctx context.Context) (*Env, error) {
	ctr, err := tcpostgres.Run(ctx, "postgres:18",
		tcpostgres.WithDatabase("goerp"),
		tcpostgres.WithUsername("goerp"),
		tcpostgres.WithPassword("goerp"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("start postgres: %w", err)
	}

	dsn, err := ctr.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		return nil, fmt.Errorf("connection string: %w", err)
	}

	// Apply migrations via database/sql (goose), then close it — queries use the pgx pool.
	sqlDB, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	if err := appdb.Migrate(ctx, sqlDB, "up"); err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	_ = sqlDB.Close()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("pool: %w", err)
	}

	// goerp_app is created by migration 00002_app_role.sql, which just ran as part of Migrate above.
	appDSN := strings.Replace(dsn, "goerp:goerp@", "goerp_app:goerp_app@", 1)
	appPool, err := pgxpool.New(ctx, appDSN)
	if err != nil {
		return nil, fmt.Errorf("app pool: %w", err)
	}

	return &Env{Pool: pool, AppPool: appPool, DSN: dsn, container: ctr}, nil
}

// Close tears down the pools and terminates the container.
func (e *Env) Close(ctx context.Context) {
	if e.Pool != nil {
		e.Pool.Close()
	}
	if e.AppPool != nil {
		e.AppPool.Close()
	}
	if e.container != nil {
		_ = testcontainers.TerminateContainer(e.container)
	}
}

// Tx opens a transaction (as the owner/superuser role) that is rolled back when the test ends —
// every test sees the seeded baseline and its writes never leak to the next test. Pass the
// returned Tx to sqlc.New.
func (e *Env) Tx(t *testing.T) pgx.Tx {
	t.Helper()
	return beginRollback(t, e.Pool)
}

// AppTx is Tx but as goerp_app, the same non-superuser role the real API runs as — use this
// whenever a test needs RLS to actually apply (Tx's owner connection bypasses it unconditionally).
func (e *Env) AppTx(t *testing.T) pgx.Tx {
	t.Helper()
	return beginRollback(t, e.AppPool)
}

func beginRollback(t *testing.T, pool *pgxpool.Pool) pgx.Tx {
	t.Helper()
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback(ctx) })
	return tx
}
