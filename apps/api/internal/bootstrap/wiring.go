package bootstrap

import (
	"context"
	"os"

	"github.com/boolmv/erp/internal/platform/httpserver"
)

func Run(ctx context.Context) error {
	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8080"
	}

	return httpserver.Run(ctx, ":"+port, routes())
}
