// Command migrate applies the database migrations of the edition's modules, each
// module with its own history (C46, C48, C95).
//
// It is run explicitly before starting a new release, never by the API at
// startup, and connects as the migration role using only MIGRATE_* settings (C47).
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/boolmv/erp/apps/api/internal/edition/full"
	"github.com/boolmv/erp/apps/api/internal/platform/config"
	"github.com/boolmv/erp/apps/api/internal/platform/observability"
	"github.com/boolmv/erp/apps/api/internal/platform/postgres"
)

// timeout bounds a whole run, including waiting for another run's lock.
const timeout = 5 * time.Minute

func main() {
	os.Exit(run())
}

func run() int {
	logger := observability.NewLogger(os.Stdout, "json", slog.LevelInfo).With("service", "migrate")

	cfg, err := config.LoadMigrate(os.Environ())
	if err != nil {
		logger.Error("startup failed", "error", err)
		return 1
	}

	// SIGINT/SIGTERM cancel the run; PostgreSQL rolls back the migration in progress.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	db, err := postgres.OpenDB(postgres.Settings{
		Host:     cfg.DB.Host,
		Port:     cfg.DB.Port,
		Name:     cfg.DB.Name,
		User:     cfg.DB.User,
		Password: cfg.DB.Password,
		SSLMode:  cfg.DB.SSLMode,
	})
	if err != nil {
		logger.Error("startup failed", "error", err)
		return 1
	}
	defer db.Close()

	applied, err := postgres.MigrateModules(ctx, db, full.Migrations, logger)
	if err != nil {
		logger.Error("migration failed", "error", err)
		return 1
	}
	logger.Info("migrations complete", "applied", applied)
	return 0
}
