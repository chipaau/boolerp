// Package bootstrap assembles the API from its configuration: it constructs
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

	"github.com/boolmv/erp/apps/api/internal/platform/auth"
	"github.com/boolmv/erp/apps/api/internal/platform/config"
	"github.com/boolmv/erp/apps/api/internal/platform/httpserver"
)

// telemetryFlushTimeout bounds exporting the last spans or metric readings on
// shutdown. It sits within Compose's stop grace period (C30) with room to spare.
const telemetryFlushTimeout = 5 * time.Second

// Run builds the API from cfg and serves until ctx is cancelled, then shuts
// the HTTP server down gracefully. Dependencies are closed by deferred calls
// in reverse order of construction, after the server has stopped, so in-flight
// requests keep their connections until they finish.
func Run(ctx context.Context, cfg config.Config, logger *slog.Logger) error {
	// Telemetry first, so every later dependency can be instrumented; its flush
	// is deferred first, so it runs last and exports the final requests' data.
	tr, err := newTracing(ctx, logger)
	if err != nil {
		return fmt.Errorf("tracing: %w", err)
	}
	defer func() {
		// ctx is already cancelled at shutdown, so the flush gets its own deadline.
		flushCtx, cancel := context.WithTimeout(context.Background(), telemetryFlushTimeout)
		defer cancel()
		if err := tr.shutdown(flushCtx); err != nil {
			logger.Warn("tracing flush failed", "error", err)
		}
	}()
	mt, err := newMetrics(ctx, logger)
	if err != nil {
		return fmt.Errorf("metrics: %w", err)
	}
	defer func() {
		flushCtx, cancel := context.WithTimeout(context.Background(), telemetryFlushTimeout)
		defer cancel()
		if err := mt.shutdown(flushCtx); err != nil {
			logger.Warn("metrics flush failed", "error", err)
		}
	}()

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
	mount(router, modules{
		auth: auth.New(ctx, auth.Settings{Issuer: cfg.Auth.Issuer, Audience: cfg.Auth.Audience},
			&http.Client{Timeout: 10 * time.Second}),
	})

	// Listening separately from serving makes a busy port a startup error,
	// and "api listening" is logged only once the port is actually bound.
	ln, err := new(net.ListenConfig).Listen(ctx, "tcp", net.JoinHostPort("", strconv.Itoa(cfg.App.ListenPort)))
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	logger.Info("api listening", "address", ln.Addr().String())

	handler := instrumentHTTP(router, tr, mt)
	return httpserver.Serve(ctx, logger, newServer(handler, cfg.HTTP, logger), ln, cfg.App.ShutdownTimeout)
}
