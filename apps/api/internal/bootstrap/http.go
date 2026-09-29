package bootstrap

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httplog/v3"

	"github.com/boolmv/erp/apps/api/internal/platform/config"
	"github.com/boolmv/erp/apps/api/internal/platform/httpserver"
	"github.com/boolmv/erp/apps/api/internal/platform/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/requestid"
)

const (
	// livenessPath answers whether the process is serving HTTP (C36).
	livenessPath = "/api/healthz"
	// readinessPath answers whether the API can serve requests that need its
	// dependencies, currently PostgreSQL (C45).
	readinessPath = "/api/readyz"
)

// newServer wraps handler in an http.Server with the configured network limits.
func newServer(handler http.Handler, cfg config.HTTP, logger *slog.Logger) *http.Server {
	return httpserver.NewServer(handler, logger, httpserver.Limits{
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
	})
}

// routerConfig holds the settings the router needs from runtime configuration.
type routerConfig struct {
	MaxBodyBytes     int64    // request body limit
	TrustedProxyHops int      // reverse proxies appending to X-Forwarded-For (C40)
	AllowedOrigins   []string // browser origins allowed cross-origin (C41)

	CheckReady   func(context.Context) error // dependency check for readiness, e.g. pool.Ping
	ReadyTimeout time.Duration               // bound on CheckReady
}

// newRouter builds the chi router and its middleware. It returns chi.Router,
// not http.Handler, so tests can add routes behind the real middleware.
// Middleware runs in the order registered, and must be registered before routes.
//
// Paths are matched exactly: there is no path cleaning or redirect (C39), so
// "/api//healthz" and "/api/healthz/" are 404.
func newRouter(logger *slog.Logger, rc routerConfig) (chi.Router, error) {
	// Reject cross-origin browser writes (POST, PUT, PATCH, DELETE) unless the
	// origin is allowed; same-origin and non-browser requests pass (C41).
	crossOrigin := http.NewCrossOriginProtection()
	for _, origin := range rc.AllowedOrigins {
		if err := crossOrigin.AddTrustedOrigin(origin); err != nil {
			return nil, fmt.Errorf("allowed origin: %w", err)
		}
	}
	crossOrigin.SetDenyHandler(http.HandlerFunc(crossOriginDenied))

	r := chi.NewRouter()

	// Name the request's trace span by route pattern once routing is done (C57).
	r.Use(spanNameFromRoute)

	// Client IP first: the request logger reads it from the context (C40).
	// With N trusted hops, the client is the Nth X-Forwarded-For entry from the
	// right; entries further left are client-supplied and ignored. With none,
	// forwarded headers are ignored and the client is the connection's address.
	if rc.TrustedProxyHops > 0 {
		r.Use(middleware.ClientIPFromXFFTrustedProxies(rc.TrustedProxyHops))
	} else {
		r.Use(middleware.ClientIPFromRemoteAddr)
	}
	// Assign a server-generated request ID (C33) before anything logs.
	r.Use(requestid.Middleware)
	// One log line per request, with OpenTelemetry attribute names (C34). The
	// request ID is added by the logger's handler from the request context.
	r.Use(httplog.RequestLogger(logger, &httplog.Options{
		Level:  slog.LevelInfo, // every response except OPTIONS
		Schema: httplog.SchemaOTEL,
		// A backstop only: problem.Recoverer below handles panics first (C38).
		RecoverPanics:      true,
		LogRequestHeaders:  []string{"Content-Type", "Origin"},
		LogResponseHeaders: []string{"Content-Type"},
		// Health checks run every few seconds; logging them adds only noise.
		// A failed readiness check is still logged, since it signals an outage.
		Skip: func(r *http.Request, status int) bool {
			return r.URL.Path == livenessPath || (r.URL.Path == readinessPath && status < 400)
		},
	}))
	// Turn handler panics into a logged 500 problem response (C38). It sits
	// directly inside the request logger, which then records status 500.
	r.Use(problem.Recoverer(logger))
	// Browsers must not guess a different content type from the body.
	r.Use(middleware.SetHeader("X-Content-Type-Options", "nosniff"))
	// CORS lets allowed origins read responses and answers preflight requests.
	// Only installed with a non-empty list: go-chi/cors treats an empty list as
	// "allow every origin".
	if len(rc.AllowedOrigins) > 0 {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins: rc.AllowedOrigins,
			AllowedMethods: []string{
				http.MethodGet, http.MethodHead, http.MethodPost,
				http.MethodPut, http.MethodPatch, http.MethodDelete,
			},
			AllowedHeaders: []string{"Content-Type"},
			ExposedHeaders: []string{requestid.Header},
			// Credentials (cookies) are decided with the session contract (D04).
			AllowCredentials: false,
			MaxAge:           600, // seconds browsers may cache a preflight answer
		}))
	}
	r.Use(crossOrigin.Handler)
	// Answer HEAD with the matching GET route, as net/http's ServeMux does.
	r.Use(middleware.GetHead)
	// Handlers reading more than maxBodyBytes get an *http.MaxBytesError.
	r.Use(middleware.RequestSize(rc.MaxBodyBytes))

	// Routing failures are problem details too (C35, C37).
	r.NotFound(notFound)
	r.MethodNotAllowed(methodNotAllowed)

	r.Get(livenessPath, liveness)
	r.Get(readinessPath, readiness(logger, rc.CheckReady, rc.ReadyTimeout))

	return r, nil
}

// liveness reports that the process is running and serving HTTP. It checks no
// dependencies; readiness is separate (step 3).
func liveness(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = io.WriteString(w, `{"status":"ok"}`)
}

// crossOriginDenied answers a cross-origin browser write from an origin that is
// not allowed.
func crossOriginDenied(w http.ResponseWriter, r *http.Request) {
	problem.Error(w, r, http.StatusForbidden, "Cross-origin requests from this origin are not allowed.")
}

// readiness reports whether the API's dependencies can be reached, within
// timeout. It answers {"status":"ready"}, or 503 problem details while a
// dependency is down. The cause is logged, never returned to the client.
func readiness(logger *slog.Logger, check func(context.Context) error, timeout time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		if err := check(ctx); err != nil {
			logger.WarnContext(r.Context(), "not ready", "error", err)
			problem.Error(w, r, http.StatusServiceUnavailable, "A required dependency is unavailable.")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"status":"ready"}`)
	}
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
