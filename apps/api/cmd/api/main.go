package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/goerp/internal/config"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("startup failed", "err", err)
		os.Exit(1)
	}
}

func run() error {
	ctx := context.Background()

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// pgxpool connects lazily; readiness is checked via Ping.
	pool, err := pgxpool.New(ctx, cfg.DSN)
	if err != nil {
		return err
	}
	defer pool.Close()

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	// Traefik routes <tenant>.bool.test/api/* here (no prefix strip), so routes live under /api.
	r.Route("/api", func(r chi.Router) {
		// liveness — process is up
		r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, http.StatusOK, `{"status":"ok"}`)
		})
		// readiness — dependencies reachable (DB for now; Kratos/Cerbos later)
		r.Get("/readyz", func(w http.ResponseWriter, req *http.Request) {
			c, cancel := context.WithTimeout(req.Context(), 2*time.Second)
			defer cancel()
			if err := pool.Ping(c); err != nil {
				writeJSON(w, http.StatusServiceUnavailable, `{"status":"db unreachable"}`)
				return
			}
			writeJSON(w, http.StatusOK, `{"status":"ready"}`)
		})
	})

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r, ReadHeaderTimeout: 5 * time.Second}

	go func() {
		slog.Info("api listening", "port", cfg.Port, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server error", "err", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func writeJSON(w http.ResponseWriter, status int, body string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body))
}
