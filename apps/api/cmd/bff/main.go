// Command bff runs one backend-for-frontend instance (C90, C96), such as bff-workspace:
// it signs browsers in through Hydra and keeps their sessions. It owns process
// concerns (configuration, the logger, signals, and the exit code);
// internal/bootstrap assembles the instance.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/boolmv/erp/apps/api/internal/bootstrap"
	"github.com/boolmv/erp/apps/api/internal/platform/config"
	"github.com/boolmv/erp/apps/api/internal/platform/observability"
)

func main() {
	os.Exit(run())
}

// run returns the process exit code. Keeping os.Exit in main lets deferred
// calls in run complete before the process exits.
func run() int {
	cfg, err := config.LoadBFF(os.Environ())
	if err != nil {
		// The logging settings may be the invalid ones, so use a fixed fallback.
		observability.NewLogger(os.Stdout, "json", slog.LevelInfo).
			With("service", "bff").
			Error("startup failed", "error", err)
		return 1
	}

	logger := observability.NewLogger(os.Stdout, cfg.Log.Format, cfg.Log.Level).
		With("service", "bff", "client", cfg.OIDC.ClientID, "environment", cfg.App.Environment)

	// ctx is cancelled by the first SIGINT (Ctrl+C) or SIGTERM (docker stop); a
	// second signal terminates a process stuck while draining.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	context.AfterFunc(ctx, stop)

	if err := bootstrap.RunBFF(ctx, cfg, logger); err != nil {
		logger.Error("bff failed", "error", err)
		return 1
	}
	return 0
}
