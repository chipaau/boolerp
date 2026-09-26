// Package server implements the graceful-shutdown lifecycle a process-per-binary Go server needs:
// serve until a signal arrives, then stop accepting new connections while letting in-flight
// requests finish within a bounded timeout (FR-FND-11).
package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"
)

// Serve runs srv on ln until a value arrives on stop, then gracefully shuts down: new connections
// are refused immediately (ln is closed by Shutdown), in-flight requests get up to shutdownTimeout
// to finish, then the call returns. A server error before any shutdown signal (e.g. the listener
// failing) returns immediately without waiting for stop.
func Serve(srv *http.Server, ln net.Listener, stop <-chan os.Signal, shutdownTimeout time.Duration) error {
	serveErr := make(chan error, 1)
	go func() {
		if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serveErr <- err
			return
		}
		serveErr <- nil
	}()

	select {
	case err := <-serveErr:
		return err
	case <-stop:
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("server: in-flight requests did not drain within %s: %w", shutdownTimeout, err)
	}
	return nil
}
