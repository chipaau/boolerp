package bootstrap

import (
	"context"
	"log/slog"

	"github.com/exaring/otelpgx"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/config"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
)

// newPool builds the PostgreSQL pool for the runtime role. It connects lazily,
// so startup does not wait for PostgreSQL (C42); readiness reports whether the
// database is reachable (C45). When tracing is on, queries and connection waits
// become spans that record SQL text but never parameter values (C61). When
// metrics are on, query durations and errors are counted by operation type
// (never by SQL text) and the pool's connection statistics are reported (C82).
func newPool(ctx context.Context, cfg config.DB, tr *tracing, mt *metrics, logger *slog.Logger) (*pgxpool.Pool, error) {
	var tracer pgx.QueryTracer
	if tr.enabled || mt.enabled {
		// Parameter values stay out: WithIncludeQueryParameters is never set.
		tracer = otelpgx.NewTracer(
			otelpgx.WithTracerProvider(tr.provider),
			otelpgx.WithMeterProvider(mt.provider),
		)
	}
	pool, err := postgres.NewPool(ctx, postgres.Settings{
		Host:     cfg.Host,
		Port:     cfg.Port,
		Name:     cfg.Name,
		User:     cfg.User,
		Password: cfg.Password,
		SSLMode:  cfg.SSLMode,
		MaxConns: cfg.MaxConns,
		Tracer:   tracer,
	})
	if err != nil {
		return nil, err
	}
	if mt.enabled {
		if err := otelpgx.RecordStats(pool, otelpgx.WithStatsMeterProvider(mt.provider)); err != nil {
			pool.Close()
			return nil, err
		}
	}
	logger.Info("database pool created", "max_conns", cfg.MaxConns)
	return pool, nil
}
