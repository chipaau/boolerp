package bootstrap

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/apps/api/internal/platform/config"
	"github.com/boolmv/erp/apps/api/internal/platform/postgres"
)

// newPool builds the PostgreSQL pool for the runtime role. It connects lazily,
// so startup does not wait for PostgreSQL (C42); readiness reports whether the
// database is reachable (C45).
func newPool(ctx context.Context, cfg config.DB, logger *slog.Logger) (*pgxpool.Pool, error) {
	pool, err := postgres.NewPool(ctx, postgres.Settings{
		Host:     cfg.Host,
		Port:     cfg.Port,
		Name:     cfg.Name,
		User:     cfg.User,
		Password: cfg.Password,
		SSLMode:  cfg.SSLMode,
		MaxConns: cfg.MaxConns,
	})
	if err != nil {
		return nil, err
	}
	logger.Info("database pool created", "max_conns", cfg.MaxConns)
	return pool, nil
}
