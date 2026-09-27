package bootstrap

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestHealthAndFallbackUseHTTPFoundation(t *testing.T) {
	handler := routes(slog.New(slog.NewJSONHandler(io.Discard, nil)), 1024, func(context.Context) error { return nil }, time.Second)
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
			if test.method == http.MethodGet && test.status == 200 {
				if strings.TrimSpace(response.Body.String()) != `{"status":"ok"}` {
					t.Fatalf("health payload changed: %s", response.Body.String())
				}
				if response.Header().Get("Cache-Control") != "no-store" {
					t.Fatal("health response can be cached")
				}
			}
		})
	}
}

func TestReadinessReportsDatabaseState(t *testing.T) {
	tests := []struct {
		name   string
		check  func(context.Context) error
		status int
	}{
		{name: "available", check: func(context.Context) error { return nil }, status: http.StatusOK},
		{name: "unavailable", check: func(context.Context) error { return context.DeadlineExceeded }, status: http.StatusServiceUnavailable},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			handler := routes(slog.New(slog.NewJSONHandler(io.Discard, nil)), 1024, test.check, time.Second)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/readyz", nil))
			if response.Code != test.status || response.Header().Get("X-Request-ID") == "" {
				t.Fatalf("unexpected readiness response: status=%d headers=%v", response.Code, response.Header())
			}
			if test.status == http.StatusServiceUnavailable && strings.Contains(response.Body.String(), "DeadlineExceeded") {
				t.Fatal("readiness response exposed an internal error")
			}
		})
	}
}
