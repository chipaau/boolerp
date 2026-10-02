package bootstrap

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

	"github.com/boolmv/erp/apps/api/internal/bff/login"
	"github.com/boolmv/erp/apps/api/internal/bff/proxy"
	"github.com/boolmv/erp/apps/api/internal/bff/session"
	"github.com/boolmv/erp/apps/api/internal/bff/web"
	"github.com/boolmv/erp/apps/api/internal/platform/config"
	"github.com/boolmv/erp/apps/api/internal/platform/httpserver"
	"github.com/boolmv/erp/apps/api/internal/platform/problem"
)

// RunBFF builds one backend-for-frontend instance (C90, C96, C98, C99) from cfg and serves
// until ctx is cancelled, then shuts down gracefully, like Run. It has the API's
// default middleware, its own health checks at /healthz and /readyz, and the
// login routes under /auth, the proxy under /api, and the embedded app for
// every other path; it has no database.
func RunBFF(ctx context.Context, cfg config.BFF, logger *slog.Logger) error {
	tr, mt, flush, err := newTelemetry(ctx, logger)
	if err != nil {
		return err
	}
	defer flush()

	// The session Redis is required: without it no one can sign in (ADR 0003).
	store, err := newRedis(cfg.Redis, tr, mt, logger)
	if err != nil {
		return fmt.Errorf("session redis: %w", err)
	}
	defer store.Close()

	sealer, err := session.NewSealer(cfg.Session.EncryptionKey)
	if err != nil {
		return err
	}
	sessions := session.New(store, sealer, session.Settings{
		KeyPrefix:    "bff:" + cfg.OIDC.ClientID + ":",
		IdleTimeout:  cfg.Session.IdleTimeout,
		Lifetime:     cfg.Session.Lifetime,
		CookieSecure: cfg.Session.CookieSecure,
	}, sessionError(logger))

	logins := login.New(login.Settings{
		Issuer:       cfg.OIDC.Issuer,
		ClientID:     cfg.OIDC.ClientID,
		ClientSecret: cfg.OIDC.ClientSecret,
		Audience:     cfg.OIDC.Audience,
		HTTPS:        cfg.Session.CookieSecure,
	}, sessions, &http.Client{Timeout: 10 * time.Second}, logger)

	router, err := newRouter(logger, routerConfig{
		MaxBodyBytes:     cfg.HTTP.MaxBodyBytes,
		TrustedProxyHops: cfg.HTTP.TrustedProxyHops,
		AllowedOrigins:   cfg.HTTP.AllowedOrigins,
		CheckReady:       func(ctx context.Context) error { return store.Ping(ctx).Err() },
		ReadyTimeout:     cfg.Redis.Timeout,
		Health:           bffHealth,
	})
	if err != nil {
		return fmt.Errorf("router: %w", err)
	}
	router.Route(login.Prefix, func(r chi.Router) {
		r.Use(sessions.LoadAndSave)
		logins.Routes(r)
	})
	api, err := url.Parse(cfg.API.URL)
	if err != nil {
		return fmt.Errorf("api url: %w", err)
	}
	forward := proxy.New(api, apiTransport(tr, mt), sessions, logins.Refresh, login.ErrRefreshRefused, logger)
	router.Route("/api", func(r chi.Router) {
		r.Use(sessions.LoadAndSave)
		r.Handle("/*", forward)
	})
	// Everything else is the embedded app (C99); it needs no session.
	issuer, err := url.Parse(cfg.OIDC.Issuer)
	if err != nil {
		return fmt.Errorf("issuer: %w", err)
	}
	app, err := web.New(web.App(), issuer.Scheme+"://"+issuer.Host)
	if err != nil {
		return err
	}
	router.Get("/*", app.ServeHTTP)

	ln, err := new(net.ListenConfig).Listen(ctx, "tcp", net.JoinHostPort("", strconv.Itoa(cfg.App.ListenPort)))
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	logger.Info("bff listening", "address", ln.Addr().String())

	handler := instrumentHTTP(router, tr, mt, bffHealth)
	return httpserver.Serve(ctx, logger, newServer(handler, cfg.HTTP, logger), ln, cfg.App.ShutdownTimeout)
}

// apiTransport carries forwarded requests to the API. With tracing on, each
// becomes a client span and carries traceparent, which the API links to its own
// trace (C58).
func apiTransport(tr *tracing, mt *metrics) http.RoundTripper {
	base := http.DefaultTransport.(*http.Transport).Clone()
	base.ResponseHeaderTimeout = 60 * time.Second
	if !tr.enabled && !mt.enabled {
		return base
	}
	return otelhttp.NewTransport(base,
		otelhttp.WithTracerProvider(tr.provider),
		otelhttp.WithMeterProvider(mt.provider),
		otelhttp.WithPropagators(tr.propagator))
}

// sessionError answers a request whose session could not be loaded or saved,
// for example while the session Redis is unavailable. The cause is logged, not
// returned.
func sessionError(logger *slog.Logger) func(http.ResponseWriter, *http.Request, error) {
	return func(w http.ResponseWriter, r *http.Request, err error) {
		logger.ErrorContext(r.Context(), "session store failed", "error", err)
		problem.Error(w, r, http.StatusServiceUnavailable, "Sign-in is unavailable right now.")
	}
}
