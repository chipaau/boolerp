package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/goerp/internal/auth"
	"github.com/boolmv/goerp/internal/config"
	"github.com/boolmv/goerp/internal/httpapi"
	"github.com/boolmv/goerp/internal/observability"
	"github.com/boolmv/goerp/internal/server"
	"github.com/boolmv/goerp/internal/tenancy"
)

func main() {
	// Redaction wraps every log line, not just ones an author remembers to scrub (FR-OBS-06).
	slog.SetDefault(slog.New(observability.NewRedactingHandler(slog.NewJSONHandler(os.Stdout, nil))))
	if err := run(); err != nil {
		slog.Error("startup failed", "err", err)
		os.Exit(1)
	}
}

func run() error {
	ctx := context.Background()

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	shutdownTracing, err := observability.SetupTracing(ctx, observability.TracingConfig{
		OTLPEndpoint: cfg.OTLPEndpoint, ServiceName: "goerp-api",
	})
	if err != nil {
		return fmt.Errorf("setup tracing: %w", err)
	}
	// Ordered cleanup on every return path, early failures included — one log line per resource.
	// defer runs LIFO, so this (registered first) flushes the tracer LAST, after the pool closes.
	defer func() {
		flushCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := shutdownTracing(flushCtx); err != nil {
			slog.Error("shutdown: tracer flush failed", "err", err)
		} else {
			slog.Info("shutdown: tracer flushed")
		}
	}()

	// pgxpool connects lazily; readiness is checked via Ping. DBTracer nests a span per query under
	// the request's root span when tracing is configured (UC-OBS-02) — a no-op otherwise.
	poolCfg, err := pgxpool.ParseConfig(cfg.DSN)
	if err != nil {
		return fmt.Errorf("parse db config: %w", err)
	}
	poolCfg.ConnConfig.Tracer = observability.DBTracer{}
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return err
	}
	defer func() {
		pool.Close()
		slog.Info("shutdown: db pool closed")
	}()
	if err := observability.RegisterPoolMetrics(pool); err != nil {
		return fmt.Errorf("register pool metrics: %w", err)
	}

	cerbosClient := auth.NewCerbos(cfg.CerbosHTTPURL)
	platform := httpapi.PlatformDeps{
		Pool:           pool,
		Kratos:         auth.NewKratos(cfg.KratosPublicURL, cfg.KratosAdminURL),
		Cerbos:         cerbosClient,
		MetricsEnabled: cfg.MetricsEnabled,
	}

	// Modules mounted on the API — the one place that lists which features are live. Each module's
	// own Register decides for itself what it needs; a future business module (inventory, hrms,
	// ...) adds its own Register call here.
	modules := []httpapi.Module{
		auth.Register(pool, cerbosClient),
		tenancy.Register(platform),
	}

	// UC-FND-06: refuse to serve if any business/tenant-scoped table lacks RLS coverage. The table
	// list is derived from the modules actually registered above, not maintained separately.
	var rlsTables []string
	for _, m := range modules {
		rlsTables = append(rlsTables, m.RLSTables...)
	}
	if err := tenancy.CheckRLSCoverage(ctx, pool, rlsTables); err != nil {
		return fmt.Errorf("rls coverage guard: %w", err)
	}

	handler := httpapi.New(platform, modules...)

	ln, err := net.Listen("tcp", ":"+cfg.Port)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	srv := &http.Server{Handler: handler, ReadHeaderTimeout: 5 * time.Second}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	slog.Info("api listening", "port", cfg.Port, "env", cfg.Env)
	if err := server.Serve(srv, ln, stop, cfg.ShutdownTimeout); err != nil {
		return fmt.Errorf("serve: %w", err)
	}
	slog.Info("shutdown: no longer accepting new connections, in-flight requests drained")
	return nil
}
