package bootstrap

import (
	"log/slog"
	"net/http"

	"github.com/boolmv/erp/internal/platform/httpserver"
)

func routes(logger *slog.Logger, maxBodyBytes int64) http.Handler {
	router := http.NewServeMux()
	router.HandleFunc("GET /api/healthz", func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Cache-Control", "no-store")
		if err := httpserver.WriteJSON(writer, http.StatusOK, map[string]string{"status": "ok"}); err != nil {
			logger.Error("Failed to write health response", "request_id", httpserver.RequestID(request.Context()))
		}
	})

	return httpserver.NewHandler(router, logger, maxBodyBytes)
}
