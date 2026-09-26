package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/boolmv/erp/internal/bootstrap"
	"github.com/boolmv/erp/internal/platform/config"
	"github.com/boolmv/erp/internal/platform/observability"
)

func main() {
	os.Exit(run())
}

func run() int {
	cfg, err := config.Load(os.LookupEnv)
	if err != nil {
		// Invalid logging settings cannot configure their own error logger.
		logger := observability.NewLogger(os.Stdout, "json", slog.LevelInfo).With("service", "api")
		logger.Error("Invalid configuration", "error", err)
		return 1
	}

	logger := observability.NewLogger(os.Stdout, cfg.LogFormat, cfg.LogLevel).
		With("service", "api", "environment", cfg.Environment)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(signals)
	go func() {
		select {
		case <-signals:
			// Restore the default signal behavior before starting graceful shutdown,
			// so a second interrupt can terminate a process that is still draining.
			signal.Stop(signals)
			cancel()
		case <-ctx.Done():
		}
	}()

	if err := bootstrap.Run(ctx, cfg, logger); err != nil {
		logger.Error("API failed", "error", err)
		return 1
	}
	logger.Info("API stopped")
	return 0
}
