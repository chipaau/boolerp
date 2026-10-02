// Command seed runs the edition's seeders (C50): one per store, kept in each
// module's seeds folder and listed in order by the edition, like Laravel's
// seeders. It refuses to run unless APP_ENV is set explicitly to dev, test, or
// staging, and it is not built into the production image.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/boolmv/erp/apps/api/internal/edition/full"
	"github.com/boolmv/erp/apps/api/internal/modules/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/config"
	"github.com/boolmv/erp/apps/api/internal/platform/observability"
	"github.com/boolmv/erp/apps/api/internal/platform/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/seed"
)

// timeout bounds a whole run.
const timeout = 2 * time.Minute

func main() {
	os.Exit(run())
}

func run() int {
	logger := observability.NewLogger(os.Stdout, "json", slog.LevelInfo).With("service", "seed")

	cfg, err := config.LoadSeed(os.Environ())
	if err != nil {
		logger.Error("startup failed", "error", err)
		return 1
	}
	logger = logger.With("environment", cfg.App.Environment)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	pool, err := postgres.NewPool(ctx, postgres.Settings{
		Host:     cfg.DB.Host,
		Port:     cfg.DB.Port,
		Name:     cfg.DB.Name,
		User:     cfg.DB.User,
		Password: cfg.DB.Password,
		SSLMode:  cfg.DB.SSLMode,
		MaxConns: 2,
	})
	if err != nil {
		logger.Error("startup failed", "error", err)
		return 1
	}
	defer pool.Close()

	seeders := full.Seeders(pool, full.SeedSettings{
		Identity: identity.Settings{
			KratosAdminURL: cfg.Identity.KratosAdminURL,
			HydraAdminURL:  cfg.Identity.HydraAdminURL,
		},
		TeamPassword: cfg.Users.TeamPassword,
	}, &http.Client{Timeout: 10 * time.Second}, logger)

	if err := seed.Run(ctx, seeders, seed.NewEnv(cfg.App.Environment, logger)); err != nil {
		logger.Error("seed failed", "error", err)
		return 1
	}
	logger.Info("seed complete")
	return 0
}
