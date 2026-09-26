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

type Options struct {
	Address           string
	ShutdownTimeout   time.Duration
	ReadHeaderTimeout time.Duration
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
}

func Run(ctx context.Context, options Options, logger *slog.Logger, handler http.Handler) error {
	listener, err := net.Listen("tcp", options.Address)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", options.Address, err)
	}

	server := &http.Server{
		Handler:                      handler,
		ReadHeaderTimeout:            options.ReadHeaderTimeout,
		ReadTimeout:                  options.ReadTimeout,
		WriteTimeout:                 options.WriteTimeout,
		IdleTimeout:                  options.IdleTimeout,
		MaxHeaderBytes:               32 << 10,
		DisableGeneralOptionsHandler: true,
		ErrorLog:                     slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}
	defer server.Close()

	serverErrors := make(chan error, 1)
	go func() {
		serverErrors <- server.Serve(listener)
	}()

	logger.Info("HTTP server started", "address", listener.Addr().String())

	select {
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("serve HTTP: %w", err)
	case <-ctx.Done():
		logger.Info("HTTP server stopping", "timeout", options.ShutdownTimeout.String())
		shutdownCtx, cancel := context.WithTimeout(context.Background(), options.ShutdownTimeout)
		defer cancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown HTTP: %w", err)
		}
		return nil
	}
}
