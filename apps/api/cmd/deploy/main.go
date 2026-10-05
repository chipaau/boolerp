// Command deploy prepares a database for a release (C135): it applies the
// edition's migrations, exactly as cmd/migrate does, then runs the deploy
// seeders, production's starting data such as the ISO country list. It runs in
// every environment and connects as the migration role, which owns the tables,
// using MIGRATE_DB_*, APP_ENV, and APP_IDENTITY_* (Kratos, for the team's
// accounts). cmd/migrate stays for running migrations alone.
// Every step is idempotent, so running it on each release is safe.
package main

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/boolmv/erp/apps/api/internal/edition/full"
	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/config"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/observability"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

// timeout bounds a whole run.
const timeout = 5 * time.Minute

func main() {
	os.Exit(run())
}

func run() int {
	logger := observability.NewLogger(os.Stdout, "json", slog.LevelInfo).With("service", "deploy")

	cfg, err := config.LoadDeploy(os.Environ())
	if err != nil {
		logger.Error("startup failed", "error", err)
		return 1
	}
	logger = logger.With("environment", cfg.App.Environment)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	settings := postgres.Settings{
		Host:     cfg.DB.Host,
		Port:     cfg.DB.Port,
		Name:     cfg.DB.Name,
		User:     cfg.DB.User,
		Password: cfg.DB.Password,
		SSLMode:  cfg.DB.SSLMode,
		MaxConns: 2,
	}

	// Migrations first: the seeders write to the tables they create.
	db, err := postgres.OpenDB(settings)
	if err != nil {
		logger.Error("startup failed", "error", err)
		return 1
	}
	applied, err := postgres.MigrateModules(ctx, db, full.Migrations, logger)
	_ = db.Close()
	if err != nil {
		logger.Error("migration failed", "error", err)
		return 1
	}
	logger.Info("migrations complete", "applied", applied)

	pool, err := postgres.NewPool(ctx, settings)
	if err != nil {
		logger.Error("startup failed", "error", err)
		return 1
	}
	defer pool.Close()

	seeders := full.DeploySeeders(pool, full.SeedSettings{
		Identity: identity.Settings{
			KratosAdminURL: cfg.Identity.KratosAdminURL,
			HydraAdminURL:  cfg.Identity.HydraAdminURL,
		},
		PlatformDomain: cfg.Platform.Domain,
	}, &http.Client{Timeout: 10 * time.Second}, logger, terminal())
	if err := seed.Run(ctx, seeders, seed.NewEnv(cfg.App.Environment, logger)); err != nil {
		logger.Error("deploy failed", "error", err)
		return 1
	}
	logger.Info("deploy complete")
	return 0
}

// terminal is standard output when a person is watching it, where one-time
// recovery codes for new accounts are shown; otherwise (CI, a log collector) it is
// nil, so no code is written where it could be stored.
func terminal() io.Writer {
	info, err := os.Stdout.Stat()
	if err != nil || info.Mode()&os.ModeCharDevice == 0 {
		return nil
	}
	return os.Stdout
}
