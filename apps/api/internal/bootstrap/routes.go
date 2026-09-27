package bootstrap

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/boolmv/erp/internal/platform/httpserver"
)

func routes(logger *slog.Logger, maxBodyBytes int64, databaseReady func(context.Context) error, pingTimeout time.Duration) http.Handler {
	router := http.NewServeMux()
	router.HandleFunc("GET /api/healthz", func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Cache-Control", "no-store")
		if err := httpserver.WriteJSON(writer, http.StatusOK, map[string]string{"status": "ok"}); err != nil {
			logger.Error("Failed to write health response", "request_id", httpserver.RequestID(request.Context()))
		}
	})
	router.HandleFunc("GET /api/readyz", func(writer http.ResponseWriter, request *http.Request) {
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
	})

	return httpserver.NewHandler(router, logger, maxBodyBytes)
}
