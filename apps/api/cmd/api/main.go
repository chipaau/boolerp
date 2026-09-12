package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
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
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := shutdownTracing(shutdownCtx); err != nil {
			slog.Error("tracer shutdown", "err", err)
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
	defer pool.Close()
	if err := observability.RegisterPoolMetrics(pool); err != nil {
		return fmt.Errorf("register pool metrics: %w", err)
	}

	// UC-FND-06: refuse to serve if any business/tenant-scoped table lacks RLS coverage.
	if err := tenancy.CheckRLSCoverage(ctx, pool, tenancy.RLSScopedTables); err != nil {
		return fmt.Errorf("rls coverage guard: %w", err)
	}

	handler := httpapi.New(httpapi.Deps{
		Pool:           pool,
		Kratos:         auth.NewKratos(cfg.KratosPublicURL, cfg.KratosAdminURL),
		Cerbos:         auth.NewCerbos(cfg.CerbosHTTPURL),
		MetricsEnabled: cfg.MetricsEnabled,
	})

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: handler, ReadHeaderTimeout: 5 * time.Second}

	go func() {
		slog.Info("api listening", "port", cfg.Port, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server error", "err", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
