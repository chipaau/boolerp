package main

import (
	"context"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/boolmv/erp/apps/api/internal/platform/config"
	"github.com/boolmv/erp/apps/api/internal/platform/httpserver"
	"github.com/boolmv/erp/apps/api/internal/platform/observability"
	"github.com/boolmv/erp/apps/api/internal/platform/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/redis"
)

func main() {
	os.Exit(run())
}

// run returns the process exit code. Keeping os.Exit in main lets deferred
// calls in run complete before the process exits.
func run() int {
	cfg, err := config.Load(os.Environ())
	if err != nil {
		// The logging settings may be the invalid ones, so use a fixed fallback.
		observability.NewLogger(os.Stdout, "json", slog.LevelInfo).
			With("service", "api").
			Error("startup failed", "error", err)
		return 1
	}

	logger := observability.NewLogger(os.Stdout, cfg.Log.Format, cfg.Log.Level).
		With("service", "api", "environment", cfg.App.Environment)

	// ctx is cancelled by the first SIGINT (Ctrl+C) or SIGTERM (docker stop).
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	// Once ctx is cancelled, stop listening for signals. The default behaviour
	// returns, so a second signal terminates a process stuck while draining.
	context.AfterFunc(ctx, stop)

	// The pool connects lazily, so startup does not wait for PostgreSQL.
	// Deferred Close runs when run returns: after the HTTP server has shut down,
	// so in-flight requests keep their connections until they finish.
	pool, err := postgres.NewPool(ctx, postgres.Settings{
		Host:     cfg.DB.Host,
		Port:     cfg.DB.Port,
		Name:     cfg.DB.Name,
		User:     cfg.DB.User,
		Password: cfg.DB.Password,
		SSLMode:  cfg.DB.SSLMode,
		MaxConns: cfg.DB.MaxConns,
	})
	if err != nil {
		logger.Error("startup failed", "error", err)
		return 1
	}
	defer pool.Close()
	logger.Info("database pool created", "max_conns", cfg.DB.MaxConns)

	redis.RouteLogs(logger)
	// Redis is a cache and optional at runtime (C52): the client connects
	// lazily, and an unreachable Redis is reported but does not stop startup.
	cache := redis.NewClient(redis.Settings{
		Host:     cfg.Redis.Host,
		Port:     cfg.Redis.Port,
		Username: cfg.Redis.Username,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
		TLS:      cfg.Redis.TLS,
		Timeout:  cfg.Redis.Timeout,
	})
	defer cache.Close()
	go func() {
		if err := cache.Ping(ctx).Err(); err != nil {
			logger.Warn("redis unreachable; cache reads fall back to PostgreSQL", "error", err)
			return
		}
		logger.Info("redis reachable")
	}()

	// Listening separately from serving makes a busy port a startup error,
	// and "api listening" is logged only once the port is actually bound.
	addr := net.JoinHostPort("", strconv.Itoa(cfg.App.ListenPort))
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		logger.Error("startup failed", "error", err)
		return 1
	}
	logger.Info("api listening", "address", ln.Addr().String())

	router, err := newRouter(logger, routerConfig{
		MaxBodyBytes:     cfg.HTTP.MaxBodyBytes,
		TrustedProxyHops: cfg.HTTP.TrustedProxyHops,
		AllowedOrigins:   cfg.HTTP.AllowedOrigins,
		CheckReady:       pool.Ping,
		ReadyTimeout:     cfg.DB.PingTimeout,
	})
	if err != nil {
		logger.Error("startup failed", "error", err)
		return 1
	}
	srv := httpserver.NewServer(router, logger, httpserver.Limits{
		ReadHeaderTimeout: cfg.HTTP.ReadHeaderTimeout,
		ReadTimeout:       cfg.HTTP.ReadTimeout,
		WriteTimeout:      cfg.HTTP.WriteTimeout,
		IdleTimeout:       cfg.HTTP.IdleTimeout,
	})
	if err := httpserver.Serve(ctx, logger, srv, ln, cfg.App.ShutdownTimeout); err != nil {
		logger.Error("api stopped with error", "error", err)
		return 1
	}
	return 0
}
