package postgres

import (
	"context"
	"errors"

	"github.com/boolmv/erp/internal/platform/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool is the application-owned PostgreSQL connection pool. It exposes only
// infrastructure operations until a module has an approved persistence port.
type Pool struct {
	pool *pgxpool.Pool
}

// Open parses the application DSN and creates a lazy pool. It does not make a
// connection; callers can keep liveness available while readiness reports a
// database outage.
func Open(ctx context.Context, settings config.Database) (*Pool, error) {
	poolConfig, err := pgxpool.ParseConfig(settings.DSN)
	if err != nil {
		return nil, errors.New("APP_DSN is not a valid PostgreSQL connection string")
	}
	poolConfig.MaxConns = settings.MaxConns
	poolConfig.ConnConfig.ConnectTimeout = settings.PingTimeout

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, errors.New("PostgreSQL connection pool could not be created")
	}
	return &Pool{pool: pool}, nil
}

// Ping checks that PostgreSQL is reachable. The caller supplies the deadline
// so HTTP readiness checks can be bounded by their request context.
func (pool *Pool) Ping(ctx context.Context) error {
	if err := pool.pool.Ping(ctx); err != nil {
		return errors.New("PostgreSQL ping failed")
	}
	return nil
}

func (pool *Pool) Close() {
	pool.pool.Close()
}
