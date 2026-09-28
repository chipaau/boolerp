package main

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/boolmv/erp/apps/api/internal/platform/config"
	"github.com/boolmv/erp/apps/api/internal/platform/httpserver"
	"github.com/boolmv/erp/apps/api/internal/platform/observability"
)

func main() {
	os.Exit(run())
}

// run returns the process exit code. Keeping os.Exit in main lets deferred
// calls in run complete before the process exits.
func run() int {
	cfg, err := config.Load(os.Environ())
	if err != nil {
		// The logging settings may be the invalid ones, so use a fixed fallback.
		observability.NewLogger(os.Stdout, "json", slog.LevelInfo).
			With("service", "api").
			Error("startup failed", "error", err)
		return 1
	}

	logger := observability.NewLogger(os.Stdout, cfg.LogFormat, cfg.LogLevel).
		With("service", "api", "environment", cfg.Environment)

	// ctx is cancelled by the first SIGINT (Ctrl+C) or SIGTERM (docker stop).
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	// Once ctx is cancelled, stop listening for signals. The default behaviour
	// returns, so a second signal terminates a process stuck while draining.
	context.AfterFunc(ctx, stop)

	r := chi.NewRouter()

	// Liveness (C25). Middleware must be registered before any route.
	r.Use(middleware.Heartbeat("/api/healthz"))

	// chi runs middleware only once at least one route exists.
	r.Get("/api", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	// Listening separately from serving makes a busy port a startup error,
	// and "api listening" is logged only once the port is actually bound.
	addr := net.JoinHostPort("", strconv.Itoa(cfg.Port))
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		logger.Error("startup failed", "error", err)
		return 1
	}
	logger.Info("api listening", "address", ln.Addr().String())

	srv := &http.Server{Handler: r}
	if err := httpserver.Serve(ctx, logger, srv, ln, cfg.ShutdownTimeout); err != nil {
		logger.Error("api stopped with error", "error", err)
		return 1
	}
	return 0
}
