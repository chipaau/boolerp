package bootstrap

import (
	"context"
	"log/slog"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/boolmv/erp/internal/platform/httpserver"
	"github.com/go-chi/chi/v5"
)

func routes(logger *slog.Logger, maxBodyBytes int64, databaseReady func(context.Context) error, pingTimeout time.Duration) http.Handler {
	router := chi.NewRouter()
	router.Use(captureRoutePattern)
	router.Use(redirectCleanPath)
	router.NotFound(func(writer http.ResponseWriter, request *http.Request) {
		httpserver.WriteProblem(writer, request, http.StatusNotFound, "")
	})
	router.MethodNotAllowed(methodNotAllowedHandler(router))

	healthHandler := func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Cache-Control", "no-store")
		if err := httpserver.WriteJSON(writer, http.StatusOK, map[string]string{"status": "ok"}); err != nil {
			logger.Error("Failed to write health response", "request_id", httpserver.RequestID(request.Context()))
		}
	}
	router.Get("/api/healthz", healthHandler)
	router.Head("/api/healthz", healthHandler)

	readyHandler := func(writer http.ResponseWriter, request *http.Request) {
		ctx, cancel := context.WithTimeout(request.Context(), pingTimeout)
		defer cancel()
		if databaseReady == nil || databaseReady(ctx) != nil {
			httpserver.WriteProblem(writer, request, http.StatusServiceUnavailable, "A required dependency is unavailable.")
			return
		}
		writer.Header().Set("Cache-Control", "no-store")
		if err := httpserver.WriteJSON(writer, http.StatusOK, map[string]string{"status": "ready"}); err != nil {
			logger.Error("Failed to write readiness response", "request_id", httpserver.RequestID(request.Context()))
		}
	}
	router.Get("/api/readyz", readyHandler)
	router.Head("/api/readyz", readyHandler)

	return httpserver.NewHandler(router, logger, maxBodyBytes)
}

// captureRoutePattern stores the matched chi route template in the context slot
// allocated by httpserver.NewHandler, so request logs record the template
// instead of the concrete URL.
func captureRoutePattern(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		defer func() {
			httpserver.SetRoutePattern(request.Context(), request.Pattern)
		}()
		next.ServeHTTP(writer, request)
	})
}

// redirectCleanPath redirects requests with non-canonical paths (e.g. double
// slashes) to their cleaned equivalents using 307 Temporary Redirect.
func redirectCleanPath(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		cleaned := path.Clean(request.URL.Path)
		if cleaned != request.URL.Path {
			target := cleaned
			if request.URL.RawQuery != "" {
				target += "?" + request.URL.RawQuery
			}
			writer.Header().Set("Location", target)
			httpserver.WriteProblem(writer, request, http.StatusTemporaryRedirect, "")
			return
		}
		next.ServeHTTP(writer, request)
	})
}

// methodNotAllowedHandler returns a handler that computes the Allow header by
// probing the router for each standard HTTP method, then writes an RFC 9457
// problem response.
func methodNotAllowedHandler(router chi.Routes) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		if allow := computeAllowed(router, request); allow != "" {
			writer.Header().Set("Allow", allow)
		}
		httpserver.WriteProblem(writer, request, http.StatusMethodNotAllowed, "")
	}
}

// computeAllowed probes the router for each standard HTTP method and returns
// the matching methods as a comma-separated string for the Allow header.
func computeAllowed(router chi.Routes, request *http.Request) string {
	rctx := chi.RouteContext(request.Context())
	routePath := rctx.RoutePath
	if routePath == "" {
		routePath = request.URL.Path
	}
	var methods []string
	for _, method := range []string{
		http.MethodConnect, http.MethodDelete, http.MethodGet,
		http.MethodHead, http.MethodOptions, http.MethodPatch,
		http.MethodPost, http.MethodPut, http.MethodTrace,
	} {
		if router.Match(chi.NewRouteContext(), method, routePath) {
			methods = append(methods, method)
		}
	}
	return strings.Join(methods, ", ")
}
