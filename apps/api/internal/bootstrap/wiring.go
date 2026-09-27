package bootstrap

import (
	"context"
	"log/slog"
	"strconv"

	"github.com/boolmv/erp/internal/platform/config"
	"github.com/boolmv/erp/internal/platform/httpserver"
	"github.com/boolmv/erp/internal/platform/postgres"
)

func Run(ctx context.Context, cfg config.Config, logger *slog.Logger) error {
	database, err := postgres.Open(ctx, cfg.Database)
	if err != nil {
		return err
	}
	defer database.Close()

	options := httpserver.Options{
		Address:           ":" + strconv.Itoa(cfg.Port),
		ShutdownTimeout:   cfg.ShutdownTimeout,
		ReadHeaderTimeout: cfg.HTTP.ReadHeaderTimeout,
		ReadTimeout:       cfg.HTTP.ReadTimeout,
		WriteTimeout:      cfg.HTTP.WriteTimeout,
		IdleTimeout:       cfg.HTTP.IdleTimeout,
	}
	return httpserver.Run(ctx, options, logger, routes(logger, cfg.HTTP.MaxBodyBytes, database.Ping, cfg.Database.PingTimeout))
}
