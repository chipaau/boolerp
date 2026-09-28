package main

import (
	"log/slog"
	"net"
	"net/http"
	"os"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/boolmv/erp/apps/api/internal/platform/config"
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

	r := chi.NewRouter()

	// Liveness (C25). Middleware must be registered before any route.
	r.Use(middleware.Heartbeat("/api/healthz"))

	// chi runs middleware only once at least one route exists.
	r.Get("/api", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	addr := net.JoinHostPort("", strconv.Itoa(cfg.Port))
	logger.Info("api listening", "address", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		logger.Error("api stopped", "error", err)
		return 1
	}
	return 0
}
