// Command api runs the HTTP API. It owns process concerns (configuration, the
// logger, signals, and the exit code) and lists the modules of this build and
// their prefixes; internal/bootstrap assembles the rest. A product edition with
// fewer modules is another main that lists fewer: modules it does not import are
// not compiled into its binary (C93).
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/go-chi/chi/v5"

	"github.com/boolmv/erp/apps/api/internal/bootstrap"
	"github.com/boolmv/erp/apps/api/internal/platform/auth"
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

	logger := observability.NewLogger(os.Stdout, cfg.Log.Format, cfg.Log.Level).
		With("service", "api", "environment", cfg.App.Environment)

	// ctx is cancelled by the first SIGINT (Ctrl+C) or SIGTERM (docker stop).
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	// Once ctx is cancelled, stop listening for signals. The default behaviour
	// returns, so a second signal terminates a process stuck while draining.
	context.AfterFunc(ctx, stop)

	err = bootstrap.Run(ctx, cfg, logger, func(r chi.Router, d bootstrap.Deps) {
		authModule := auth.New(ctx, auth.Settings{Issuer: cfg.Auth.Issuer, Audience: cfg.Auth.Audience}, d.HTTPClient)
		r.Route("/api/auth", authModule.Routes)
	})
	if err != nil {
		logger.Error("api failed", "error", err)
		return 1
	}
	return 0
}
