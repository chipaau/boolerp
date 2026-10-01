// Package bootstrap assembles the API (Run) and the BFF (RunBFF, bff.go) from
// their configuration: it constructs
// every dependency explicitly, serves HTTP, and closes the dependencies in
// reverse order on shutdown. Each dependency's construction lives in its own
// file (database.go, redis.go, http.go), like Laravel's service providers.
//
// main owns process concerns (configuration, logger, signals, exit code);
// bootstrap owns application assembly.
package bootstrap

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"

	"github.com/boolmv/erp/apps/api/internal/platform/config"
	"github.com/boolmv/erp/apps/api/internal/platform/httpserver"
)

// telemetryFlushTimeout bounds exporting the last spans or metric readings on
// shutdown. It sits within Compose's stop grace period (C30) with room to spare.
const telemetryFlushTimeout = 5 * time.Second

// Deps are the shared dependencies Run builds for modules (C92, C93, C95).
type Deps struct {
	Config config.Config
	Pool   *pgxpool.Pool
	Cache  *goredis.Client
	Logger *slog.Logger
	// HTTPClient makes outbound requests, such as fetching Hydra's keys; it has a
	// timeout, so a slow dependency cannot hold a request open.
	HTTPClient *http.Client
}

// RegisterModules constructs the modules of this build, connects them, and
// registers their routes at their prefixes (r.Route("/api/auth",
// authModule.Routes)). Each edition package supplies it (C95). The router
// already carries the default middleware, which the modules inherit. ctx lives
// as long as the API.
type RegisterModules func(ctx context.Context, r chi.Router, d Deps)

// Run builds the API from cfg and serves until ctx is cancelled, then shuts
// the HTTP server down gracefully. Dependencies are closed by deferred calls
// in reverse order of construction, after the server has stopped, so in-flight
// requests keep their connections until they finish.
func Run(ctx context.Context, cfg config.Config, logger *slog.Logger, registerModules RegisterModules) error {
	// Telemetry first, so every later dependency can be instrumented; its flush
	// is deferred first, so it runs last and exports the final requests' data.
	tr, mt, flush, err := newTelemetry(ctx, logger)
	if err != nil {
		return err
	}
	defer flush()

	pool, err := newPool(ctx, cfg.DB, tr, mt, logger)
	if err != nil {
		return fmt.Errorf("database: %w", err)
	}
	defer pool.Close()

	cache, err := newCache(ctx, cfg.Redis, tr, mt, logger)
	if err != nil {
		return fmt.Errorf("redis: %w", err)
	}
	defer cache.Close()

	router, err := newRouter(logger, routerConfig{
		MaxBodyBytes:     cfg.HTTP.MaxBodyBytes,
		TrustedProxyHops: cfg.HTTP.TrustedProxyHops,
		AllowedOrigins:   cfg.HTTP.AllowedOrigins,
		CheckReady:       pool.Ping,
		ReadyTimeout:     cfg.DB.PingTimeout,
	})
	if err != nil {
		return fmt.Errorf("router: %w", err)
	}
	registerModules(ctx, router, Deps{
		Config:     cfg,
		Pool:       pool,
		Cache:      cache,
		Logger:     logger,
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	})

	// Listening separately from serving makes a busy port a startup error,
	// and "api listening" is logged only once the port is actually bound.
	ln, err := new(net.ListenConfig).Listen(ctx, "tcp", net.JoinHostPort("", strconv.Itoa(cfg.App.ListenPort)))
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	logger.Info("api listening", "address", ln.Addr().String())

	handler := instrumentHTTP(router, tr, mt, apiHealth)
	return httpserver.Serve(ctx, logger, newServer(handler, cfg.HTTP, logger), ln, cfg.App.ShutdownTimeout)
}

// newTelemetry starts tracing and metrics. flush exports what is left; call it
// after the server has stopped. ctx is already cancelled at shutdown, so the
// flush gets its own deadline.
func newTelemetry(ctx context.Context, logger *slog.Logger) (*tracing, *metrics, func(), error) {
	tr, err := newTracing(ctx, logger)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("tracing: %w", err)
	}
	mt, err := newMetrics(ctx, logger)
	if err != nil {
		_ = tr.shutdown(context.Background())
		return nil, nil, nil, fmt.Errorf("metrics: %w", err)
	}
	flush := func() {
		flushCtx, cancel := context.WithTimeout(context.Background(), telemetryFlushTimeout)
		defer cancel()
		if err := mt.shutdown(flushCtx); err != nil {
			logger.Warn("metrics flush failed", "error", err)
		}
		if err := tr.shutdown(flushCtx); err != nil {
			logger.Warn("tracing flush failed", "error", err)
		}
	}
	return tr, mt, flush, nil
}
