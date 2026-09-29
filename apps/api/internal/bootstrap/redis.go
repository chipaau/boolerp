package bootstrap

import (
	"context"
	"log/slog"

	"github.com/redis/go-redis/extra/redisotel/v9"
	goredis "github.com/redis/go-redis/v9"

	"github.com/boolmv/erp/apps/api/internal/platform/config"
	"github.com/boolmv/erp/apps/api/internal/platform/redis"
)

// newCache builds the Redis client. Redis is a cache and optional at runtime
// (C52): the client connects lazily, and an unreachable Redis is reported in
// the background without delaying or failing startup. When tracing is on,
// commands become spans named by command only; arguments, which carry cached
// values and keys, are never recorded (C61).
func newCache(ctx context.Context, cfg config.Redis, tr *tracing, logger *slog.Logger) (*goredis.Client, error) {
	redis.RouteLogs(logger)
	cache := redis.NewClient(redis.Settings{
		Host:     cfg.Host,
		Port:     cfg.Port,
		Username: cfg.Username,
		Password: cfg.Password,
		DB:       cfg.DB,
		TLS:      cfg.TLS,
		Timeout:  cfg.Timeout,
	})
	if tr.enabled {
		if err := redisotel.InstrumentTracing(cache,
			redisotel.WithTracerProvider(tr.provider),
			redisotel.WithDBStatement(false), // no command arguments in spans
		); err != nil {
			return nil, err
		}
	}
	go func() {
		if err := cache.Ping(ctx).Err(); err != nil {
			logger.Warn("redis unreachable; cache reads fall back to PostgreSQL", "error", err)
			return
		}
		logger.Info("redis reachable")
	}()
	return cache, nil
}
