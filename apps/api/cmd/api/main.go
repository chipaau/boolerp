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
	"github.com/go-chi/httplog/v3"

	"github.com/boolmv/erp/apps/api/internal/platform/config"
	"github.com/boolmv/erp/apps/api/internal/platform/httpserver"
	"github.com/boolmv/erp/apps/api/internal/platform/observability"
	"github.com/boolmv/erp/apps/api/internal/platform/requestid"
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

	// Listening separately from serving makes a busy port a startup error,
	// and "api listening" is logged only once the port is actually bound.
	addr := net.JoinHostPort("", strconv.Itoa(cfg.Port))
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		logger.Error("startup failed", "error", err)
		return 1
	}
	logger.Info("api listening", "address", ln.Addr().String())

	srv := httpserver.NewServer(newRouter(logger, cfg.HTTPMaxBodyBytes), logger, httpserver.Limits{
		ReadHeaderTimeout: cfg.HTTPReadHeaderTimeout,
		ReadTimeout:       cfg.HTTPReadTimeout,
		WriteTimeout:      cfg.HTTPWriteTimeout,
		IdleTimeout:       cfg.HTTPIdleTimeout,
	})
	if err := httpserver.Serve(ctx, logger, srv, ln, cfg.ShutdownTimeout); err != nil {
		logger.Error("api stopped with error", "error", err)
		return 1
	}
	return 0
}

// newRouter builds the chi router and its middleware. It returns chi.Router,
// not http.Handler, so tests can add routes behind the real middleware.
// Middleware runs in the order registered, and must be registered before routes.
func newRouter(logger *slog.Logger, maxBodyBytes int64) chi.Router {
	r := chi.NewRouter()

	// Liveness (C25) answers first, so health checks are neither logged nor counted.
	r.Use(middleware.Heartbeat("/api/healthz"))
	// Assign a server-generated request ID (C33) before anything logs.
	r.Use(requestid.Middleware)
	// One log line per request, with OpenTelemetry attribute names (C34). The
	// request ID is added by the logger's handler from the request context.
	r.Use(httplog.RequestLogger(logger, &httplog.Options{
		Level:  slog.LevelInfo, // every response except OPTIONS
		Schema: httplog.SchemaOTEL,
		// Panic recovery is step 2e; until then panics are logged and re-raised.
		RecoverPanics:      false,
		LogRequestHeaders:  []string{"Content-Type", "Origin"},
		LogResponseHeaders: []string{"Content-Type"},
	}))
	// Handlers reading more than maxBodyBytes get an *http.MaxBytesError.
	r.Use(middleware.RequestSize(maxBodyBytes))

	// chi runs middleware only once at least one route exists.
	r.Get("/api", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	return r
}
