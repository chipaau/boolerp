package bootstrap

import (
	"context"
	"log/slog"
	"strconv"

	"github.com/boolmv/erp/internal/platform/config"
	"github.com/boolmv/erp/internal/platform/httpserver"
)

func Run(ctx context.Context, cfg config.Config, logger *slog.Logger) error {
	options := httpserver.Options{
		Address:         ":" + strconv.Itoa(cfg.Port),
		ShutdownTimeout: cfg.ShutdownTimeout,
	}
	return httpserver.Run(ctx, options, logger, routes())
}
