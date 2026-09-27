package bootstrap

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/boolmv/erp/internal/platform/httpserver"
	"github.com/go-chi/chi/v5"
)

func TestHealthAndFallbackUseHTTPFoundation(t *testing.T) {
	handler := routes(slog.New(slog.NewJSONHandler(io.Discard, nil)), 1024, func(context.Context) error { return nil }, time.Second)
	for _, test := range []struct {
		method, path string
		status       int
		allow        string
	}{
		{"GET", "/api/healthz", 200, ""}, {"HEAD", "/api/healthz", 200, ""},
		{"POST", "/api/healthz", 405, "GET, HEAD"}, {"GET", "/missing", 404, ""},
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
			if got := response.Header().Get("Allow"); got != test.allow {
				t.Fatalf("Allow = %q, want %q", got, test.allow)
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

func TestCanonicalPathRedirectUsesMethodPreservingStatus(t *testing.T) {
	handler := routes(slog.New(slog.NewJSONHandler(io.Discard, nil)), 1024, func(context.Context) error { return nil }, time.Second)
	request := httptest.NewRequest(http.MethodPost, "/api//healthz?check=ready", strings.NewReader("body"))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusTemporaryRedirect || response.Header().Get("Location") != "/api/healthz?check=ready" {
		t.Fatalf("unexpected canonical redirect: status=%d location=%q", response.Code, response.Header().Get("Location"))
	}
	if response.Header().Get("Content-Type") != "application/problem+json" {
		t.Fatalf("redirect did not use JSON problem details: Content-Type=%q", response.Header().Get("Content-Type"))
	}
}

func TestRoutePatternIsCapturedWhenHandlerPanics(t *testing.T) {
	var logs bytes.Buffer
	router := chi.NewRouter()
	router.Use(captureRoutePattern)
	router.Get("/private/{id}", func(http.ResponseWriter, *http.Request) {
		panic("private handler panic")
	})
	handler := httpserver.NewHandler(router, slog.New(slog.NewJSONHandler(&logs, nil)), 1024)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/private/123", nil))
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("panic response status = %d, want 500", response.Code)
	}
	entries := strings.Split(strings.TrimSpace(logs.String()), "\n")
	var completion map[string]any
	if err := json.Unmarshal([]byte(entries[len(entries)-1]), &completion); err != nil {
		t.Fatalf("parse completion log: %v", err)
	}
	if completion["route"] != "/private/{id}" {
		t.Fatalf("panic completion log route = %v, want /private/{id}", completion["route"])
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
