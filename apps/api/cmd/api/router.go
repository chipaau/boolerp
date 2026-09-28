package main

import (
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/httplog/v3"

	"github.com/boolmv/erp/apps/api/internal/platform/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/requestid"
)

// livenessPath answers process liveness checks (C36).
const livenessPath = "/api/healthz"

// newRouter builds the chi router and its middleware. It returns chi.Router,
// not http.Handler, so tests can add routes behind the real middleware.
// Middleware runs in the order registered, and must be registered before routes.
func newRouter(logger *slog.Logger, maxBodyBytes int64) chi.Router {
	r := chi.NewRouter()

	// Assign a server-generated request ID (C33) before anything logs.
	r.Use(requestid.Middleware)
	// One log line per request, with OpenTelemetry attribute names (C34). The
	// request ID is added by the logger's handler from the request context.
	r.Use(httplog.RequestLogger(logger, &httplog.Options{
		Level:  slog.LevelInfo, // every response except OPTIONS
		Schema: httplog.SchemaOTEL,
		// Panic recovery is step 2e; until then panics are logged and re-raised.
		RecoverPanics:      false,
		LogRequestHeaders:  []string{"Content-Type", "Origin"},
		LogResponseHeaders: []string{"Content-Type"},
		// Container health checks run every few seconds; logging them adds only noise.
		Skip: func(r *http.Request, _ int) bool { return r.URL.Path == livenessPath },
	}))
	// Browsers must not guess a different content type from the body.
	r.Use(middleware.SetHeader("X-Content-Type-Options", "nosniff"))
	// Answer HEAD with the matching GET route, as net/http's ServeMux does.
	r.Use(middleware.GetHead)
	// Handlers reading more than maxBodyBytes get an *http.MaxBytesError.
	r.Use(middleware.RequestSize(maxBodyBytes))

	// Routing failures are problem details too (C35, C37).
	r.NotFound(notFound)
	r.MethodNotAllowed(methodNotAllowed)

	r.Get(livenessPath, liveness)

	return r
}

// liveness reports that the process is running and serving HTTP. It checks no
// dependencies; readiness is separate (step 3).
func liveness(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = io.WriteString(w, `{"status":"ok"}`)
}

func notFound(w http.ResponseWriter, r *http.Request) {
	problem.Error(w, r, http.StatusNotFound, "No resource exists at this path.")
}

// methodNotAllowed answers 405 with the Allow header RFC 9110 §15.5.6 requires.
// chi's default 405 handler sets Allow, but chi does not pass the allowed methods
// to a custom handler, so they are looked up again here (a documented gap).
func methodNotAllowed(w http.ResponseWriter, r *http.Request) {
	if allowed := allowedMethods(r); len(allowed) > 0 {
		w.Header().Set("Allow", strings.Join(allowed, ", "))
	}
	problem.Error(w, r, http.StatusMethodNotAllowed, "This path does not support the "+r.Method+" method.")
}

// routeMethods are the methods checked when building an Allow header.
var routeMethods = []string{
	http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut,
	http.MethodPatch, http.MethodDelete, http.MethodOptions,
}

// allowedMethods returns the methods routed for the request's path, using chi's
// route lookup the same way chi/middleware.GetHead does. HEAD is allowed
// wherever GET is, because GetHead serves it.
func allowedMethods(r *http.Request) []string {
	rctx := chi.RouteContext(r.Context())
	if rctx == nil || rctx.Routes == nil {
		return nil
	}
	path := rctx.RoutePath
	if path == "" {
		path = r.URL.Path
	}
	var allowed []string
	get := rctx.Routes.Match(chi.NewRouteContext(), http.MethodGet, path)
	for _, m := range routeMethods {
		if rctx.Routes.Match(chi.NewRouteContext(), m, path) || (m == http.MethodHead && get) {
			allowed = append(allowed, m)
		}
	}
	return allowed
}
