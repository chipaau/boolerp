// Package httpapi builds the HTTP router. main just wires dependencies and serves it; keeping the
// router here makes it testable end-to-end (fake Kratos/Cerbos + real Postgres) without a process.
package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

	"github.com/boolmv/goerp/internal/auth"
	"github.com/boolmv/goerp/internal/db/sqlc"
	"github.com/boolmv/goerp/internal/observability"
)

// Deps are the collaborators the HTTP layer needs.
type Deps struct {
	Pool           *pgxpool.Pool
	Kratos         *auth.Kratos
	Cerbos         *auth.Cerbos
	MetricsEnabled bool
}

// Module mounts one feature's routes onto the authenticated /v1 group. Each business/platform
// feature owns its own path namespace (e.g. AdminTenantRoutes mounts "/admin"); main.go composes
// the running server by listing which modules it wants — that list is the one place "which
// features exist" is visible, instead of being buried inside this package.
type Module func(r chi.Router, d Deps)

// New builds the API router with core platform routes (health/ready/metrics/session validation),
// then mounts each supplied module under the authenticated /v1 group. Public: /, /healthz, /readyz
// (/ serves the same readiness check — the sane response for whatever hits the API's bare root,
// e.g. api.bool.test/). Authenticated: /v1/*. The API is reached same-origin as /api/* on every
// tenant subdomain and directly (no prefix) at api.bool.test — Traefik strips /api before
// forwarding either way, so this router's own path space never mentions /api (see compose.yaml).
func New(d Deps, modules ...Module) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(observability.RequestLogger(slog.Default()))
	r.Use(observability.MetricsMiddleware)

	authmw := auth.NewMiddleware(d.Kratos, d.Pool)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, `{"status":"ok"}`)
	})
	r.Get("/readyz", readyz(d))
	r.Get("/", readyz(d))
	if d.MetricsEnabled {
		r.Handle("/metrics", observability.MetricsHandler())
	}

	r.Route("/v1", func(r chi.Router) {
		r.Use(authmw.RequireSession)
		r.Get("/me", me(d))
		for _, m := range modules {
			m(r, d)
		}
	})
	// otelhttp creates the root span per request (UC-OBS-01/02); a no-op wrapper when tracing isn't
	// configured (SetupTracing left the default no-op TracerProvider in place).
	return otelhttp.NewHandler(r, "goerp-api")
}

// readyz reports readiness only when every dependency is reachable.
func readyz(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		ctx, cancel := context.WithTimeout(req.Context(), 3*time.Second)
		defer cancel()
		if err := d.Pool.Ping(ctx); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, `{"status":"db unreachable"}`)
			return
		}
		if err := d.Kratos.HealthReady(ctx); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, `{"status":"kratos unreachable"}`)
			return
		}
		if err := d.Cerbos.Health(ctx); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, `{"status":"cerbos unreachable"}`)
			return
		}
		writeJSON(w, http.StatusOK, `{"status":"ready"}`)
	}
}

type meResponse struct {
	ID       string          `json:"id"`
	Email    string          `json:"email"`
	Name     string          `json:"name"`
	NameI18n json.RawMessage `json:"name_i18n"`
	Phone    *string         `json:"phone,omitempty"`
	Status   string          `json:"status"`
}

// me returns the current user. Exercises the full backbone: session (whoami) → JIT-upsert (in the
// middleware) → authz (Cerbos scaffold policy) → DB read.
func me(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p, ok := auth.PrincipalFrom(r.Context())
		if !ok {
			writeJSON(w, http.StatusInternalServerError, `{"error":"no principal"}`)
			return
		}

		allowed, err := d.Cerbos.AllowSelfProfileRead(r.Context(), p.ID)
		if err != nil {
			observability.LoggerFrom(r.Context()).Error("cerbos check", "err", err)
			writeJSON(w, http.StatusBadGateway, `{"error":"authz upstream"}`)
			return
		}
		if !allowed {
			writeJSON(w, http.StatusForbidden, `{"error":"forbidden"}`)
			return
		}

		id, err := auth.ParseUUID(p.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, `{"error":"bad principal id"}`)
			return
		}
		u, err := sqlc.New(d.Pool).GetUserByID(r.Context(), id)
		if err != nil {
			observability.LoggerFrom(r.Context()).Error("get user", "err", err)
			writeJSON(w, http.StatusInternalServerError, `{"error":"internal"}`)
			return
		}

		resp := meResponse{ID: p.ID, Email: u.Email, Name: u.Name, NameI18n: u.NameI18n, Status: u.Status}
		if u.Phone.Valid {
			resp.Phone = &u.Phone.String
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func writeJSON(w http.ResponseWriter, status int, body string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body))
}
