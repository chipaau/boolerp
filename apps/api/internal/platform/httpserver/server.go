// Package httpserver runs an http.Server until its context is cancelled, then
// shuts it down gracefully. It accepts any http.Handler, so it does not depend on chi.
package httpserver

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"
)

// Serve serves srv on ln until ctx is cancelled, then calls srv.Shutdown: the
// listener closes, idle connections close, and in-flight requests get up to
// shutdownTimeout to finish. Serve returns nil after a clean shutdown, and an
// error if serving fails or requests are still running when the timeout ends.
func Serve(ctx context.Context, logger *slog.Logger, srv *http.Server, ln net.Listener, shutdownTimeout time.Duration) error {
	// Serve blocks, so run it in a goroutine and wait for either it or ctx.
	// The buffer of 1 lets the goroutine exit even if nobody reads the result.
	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(ln) }()

	select {
	case err := <-serveErr:
		return fmt.Errorf("serve: %w", err)
	case <-ctx.Done():
	}

	logger.Info("shutting down", "timeout", shutdownTimeout.String())
	// ctx is already cancelled, so the shutdown deadline needs a fresh context.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		// Requests are still running at the deadline: close their connections.
		_ = srv.Close()
		return fmt.Errorf("shutdown: %w", err)
	}
	// After Shutdown, Serve returns http.ErrServerClosed; anything else is a real error.
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("serve: %w", err)
	}
	logger.Info("shutdown complete")
	return nil
}
