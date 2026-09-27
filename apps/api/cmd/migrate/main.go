package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/boolmv/erp/internal/platform/config"
	"github.com/boolmv/erp/internal/platform/observability"
	"github.com/boolmv/erp/internal/platform/postgres/migrations"
	"github.com/boolmv/erp/internal/platform/postgres/migrator"
)

func main() {
	os.Exit(run())
}

func run() int {
	logger := observability.NewLogger(os.Stdout, "json", slog.LevelInfo).With("service", "migrate")
	dsn, err := config.MigrationDSN(os.LookupEnv)
	if err != nil {
		logger.Error("Migration configuration is invalid", "error", err)
		return 1
	}
	files, err := migrations.Files()
	if err != nil {
		logger.Error("Migration files are unavailable")
		return 1
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	if err := migrator.Up(ctx, dsn, files); err != nil {
		// Driver errors can include SQL and database values.
		logger.Error("Database migrations failed")
		return 1
	}
	logger.Info("Database migrations completed")
	return 0
}
