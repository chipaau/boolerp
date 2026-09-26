package bootstrap

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthAndFallbackUseHTTPFoundation(t *testing.T) {
	handler := routes(slog.New(slog.NewJSONHandler(io.Discard, nil)), 1024)
	for _, test := range []struct {
		method, path string
		status       int
	}{
		{"GET", "/api/healthz", 200}, {"HEAD", "/api/healthz", 200},
		{"POST", "/api/healthz", 405}, {"GET", "/missing", 404},
	} {
		t.Run(test.method+test.path, func(t *testing.T) {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))
			if response.Code != test.status || response.Header().Get("X-Request-ID") == "" {
				t.Fatalf("unexpected response: %d %v", response.Code, response.Header())
			}
			if test.status >= 400 && response.Header().Get("Content-Type") != "application/problem+json" {
				t.Fatal("fallback did not use JSON problem details")
			}
			if test.method == http.MethodHead && response.Body.Len() != 0 {
				t.Fatal("HEAD returned a body")
			}
			if test.method == http.MethodGet && test.status == 200 && strings.TrimSpace(response.Body.String()) != `{"status":"ok"}` {
				t.Fatalf("health payload changed: %s", response.Body.String())
			}
		})
	}
}
