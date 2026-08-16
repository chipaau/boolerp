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
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib" // "pgx" database/sql driver for migrations
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	appdb "github.com/boolmv/goerp/internal/db"
)

// Env is a running test database: a live pool over a throwaway container with the schema applied.
type Env struct {
	Pool      *pgxpool.Pool
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
	return &Env{Pool: pool, DSN: dsn, container: ctr}, nil
}

// Close tears down the pool and terminates the container.
func (e *Env) Close(ctx context.Context) {
	if e.Pool != nil {
		e.Pool.Close()
	}
	if e.container != nil {
		_ = testcontainers.TerminateContainer(e.container)
	}
}

// Tx opens a transaction that is rolled back when the test ends — every test sees the seeded
// baseline and its writes never leak to the next test. Pass the returned Tx to sqlc.New.
func (e *Env) Tx(t *testing.T) pgx.Tx {
	t.Helper()
	ctx := context.Background()
	tx, err := e.Pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback(ctx) })
	return tx
}
