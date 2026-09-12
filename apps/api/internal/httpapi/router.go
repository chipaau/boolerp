// Package httpapi builds the HTTP router. main just wires dependencies and serves it; keeping the
// router here makes it testable end-to-end (fake Kratos/Cerbos + real Postgres) without a process.
package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

	"github.com/boolmv/erp/internal/auth"
	"github.com/boolmv/erp/internal/module"
	"github.com/boolmv/erp/internal/observability"
	"github.com/boolmv/erp/internal/respond"
)

// PlatformDeps are the collaborators the HTTP layer itself needs — distinct from any module's own
// (narrower) deps type, e.g. tenancy.Deps. Every module's Register(platform PlatformDeps) takes the
// whole bag and decides for itself what subset it actually needs from it.
type PlatformDeps struct {
	Pool           *pgxpool.Pool
	Kratos         *auth.Kratos
	Cerbos         *auth.Cerbos
	MetricsEnabled bool
}

// Module is an alias for module.Module, kept here so existing call sites keep writing
// httpapi.Module — the type itself lives in its own tiny package so packages httpapi depends on
// (internal/auth) can build one too without an import cycle (see internal/module's doc comment).
type Module = module.Module

// New builds the API router with core platform routes (health/ready/metrics/session validation),
// then mounts each supplied module under the authenticated /v1 group. Public: /, /healthz, /readyz
// (/ serves the same readiness check — the sane response for whatever hits the API's bare root,
// e.g. api.bool.test/). Authenticated: /v1/*. The API is reached same-origin as /api/* on every
// tenant subdomain and directly (no prefix) at api.bool.test — Traefik strips /api before
// forwarding either way, so this router's own path space never mentions /api (see compose.yaml).
// platform is used directly here (session middleware, health/ready, metrics) — these are httpapi's
// own routes, not any module's; every feature route, /me included, comes from a Module now.
func New(platform PlatformDeps, modules ...Module) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(observability.RequestLogger(slog.Default()))
	r.Use(observability.MetricsMiddleware)

	authmw := auth.NewMiddleware(platform.Kratos, platform.Pool)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respond.JSON(w, http.StatusOK, `{"status":"ok"}`)
	})
	r.Get("/readyz", readyz(platform))
	r.Get("/", readyz(platform))
	if platform.MetricsEnabled {
		r.Handle("/metrics", observability.MetricsHandler())
	}

	r.Route("/v1", func(r chi.Router) {
		r.Use(authmw.RequireSession)
		for _, m := range modules {
			m.Mount(r)
		}
	})
	// otelhttp creates the root span per request (UC-OBS-01/02); a no-op wrapper when tracing isn't
	// configured (SetupTracing left the default no-op TracerProvider in place).
	return otelhttp.NewHandler(r, "goerp-api")
}

// readyz reports readiness only when every dependency is reachable.
func readyz(platform PlatformDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		ctx, cancel := context.WithTimeout(req.Context(), 3*time.Second)
		defer cancel()
		if err := platform.Pool.Ping(ctx); err != nil {
			respond.JSON(w, http.StatusServiceUnavailable, `{"status":"db unreachable"}`)
			return
		}
		if err := platform.Kratos.HealthReady(ctx); err != nil {
			respond.JSON(w, http.StatusServiceUnavailable, `{"status":"kratos unreachable"}`)
			return
		}
		if err := platform.Cerbos.Health(ctx); err != nil {
			respond.JSON(w, http.StatusServiceUnavailable, `{"status":"cerbos unreachable"}`)
			return
		}
		respond.JSON(w, http.StatusOK, `{"status":"ready"}`)
	}
}
