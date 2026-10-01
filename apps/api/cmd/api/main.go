// Command api runs the HTTP API. It owns process concerns (configuration, the
// logger, signals, and the exit code); internal/bootstrap assembles the
// infrastructure, and the edition (internal/edition/full) its modules. An edition
// with fewer modules is another main using another edition package: modules it
// does not import are not compiled into its binary (C93, C95).
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/boolmv/erp/apps/api/internal/bootstrap"
	"github.com/boolmv/erp/apps/api/internal/edition/full"
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

	if err := bootstrap.Run(ctx, cfg, logger, full.RegisterModules); err != nil {
		logger.Error("api failed", "error", err)
		return 1
	}
	return 0
}
