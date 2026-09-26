package httpserver

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func testHandler(output io.Writer, limit int64) http.Handler {
	router := http.NewServeMux()
	router.HandleFunc("GET /items/{id}", func(writer http.ResponseWriter, request *http.Request) {
		_ = WriteJSON(writer, http.StatusOK, map[string]string{"id": request.PathValue("id")})
	})
	router.HandleFunc("POST /items", func(writer http.ResponseWriter, request *http.Request) {
		var input struct {
			Name string `json:"name"`
		}
		if !DecodeJSON(writer, request, &input) {
			return
		}
		_ = WriteJSON(writer, http.StatusCreated, map[string]bool{"created": true})
	})
	return NewHandler(router, slog.New(slog.NewJSONHandler(output, nil)), limit)
}

func checkProblem(t *testing.T, response *httptest.ResponseRecorder, status int) {
	t.Helper()
	if response.Code != status || response.Header().Get("Content-Type") != "application/problem+json" {
		t.Fatalf("expected JSON problem %d; got %d %s: %s", status, response.Code, response.Header().Get("Content-Type"), response.Body.String())
	}
	var body struct {
		Type      string `json:"type"`
		Title     string `json:"title"`
		Status    int    `json:"status"`
		RequestID string `json:"request_id"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Type != "about:blank" || body.Title != http.StatusText(status) || body.Status != status || body.RequestID == "" || body.RequestID != response.Header().Get("X-Request-ID") {
		t.Fatalf("invalid problem details: %+v", body)
	}
	if response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("error response can be cached")
	}
}

func TestRoutingAndCorrelation(t *testing.T) {
	var output bytes.Buffer
	handler := testHandler(&output, 1024)
	previousID := ""
	for range 2 {
		request := httptest.NewRequest(http.MethodGet, "/items/private-value?secret=private-query", nil)
		request.Header.Set("X-Request-ID", "untrusted-id")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		id := response.Header().Get("X-Request-ID")
		if id == "" || id == "untrusted-id" || id == previousID {
			t.Fatalf("expected a fresh request ID, got %q", id)
		}
		previousID = id
		if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "private-value") {
			t.Fatalf("path parameter was not routed correctly: %s", response.Body.String())
		}
		if response.Header().Get("X-Content-Type-Options") != "nosniff" {
			t.Fatal("missing content-type protection")
		}
		var record map[string]any
		if err := json.Unmarshal(output.Bytes(), &record); err != nil {
			t.Fatal(err)
		}
		if record["request_id"] != id || record["route"] != "GET /items/{id}" || record["status"] != float64(200) {
			t.Fatalf("unexpected request log: %v", record)
		}
		for _, private := range []string{"private-value", "private-query", "untrusted-id"} {
			if strings.Contains(output.String(), private) {
				t.Fatalf("log exposed %s", private)
			}
		}
		output.Reset()
	}

	for _, test := range []struct {
		method, path string
		status       int
		allow        string
	}{
		{"GET", "/missing", 404, ""},
		{"DELETE", "/items/1", 405, "GET, HEAD"},
		{"PUT", "/items", 405, "POST"},
		{"OPTIONS", "/items", 405, "POST"},
		{"CONNECT", "/items/1", 405, "GET, HEAD"},
		{"TRACE", "/items/1", 405, "GET, HEAD"},
	} {
		t.Run(test.method+test.path, func(t *testing.T) {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))
			checkProblem(t, response, test.status)
			if response.Header().Get("Allow") != test.allow {
				t.Fatalf("Allow = %q, want %q", response.Header().Get("Allow"), test.allow)
			}
		})
	}
	for _, path := range []string{"/items/1", "/missing"} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodHead, path, nil))
		if response.Body.Len() != 0 {
			t.Fatalf("HEAD %s returned a body", path)
		}
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/items//1", nil))
	if response.Code != http.StatusTemporaryRedirect || response.Header().Get("Location") != "/items/1" {
		t.Fatalf("canonical path redirect was lost: %d %v", response.Code, response.Header())
	}
	output.Reset()
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/items//private-redirect?secret=private-query", nil))
	if strings.Contains(output.String(), "private-") {
		t.Fatal("redirect log exposed a request path or query value")
	}
}

func TestJSONRequestsAndBodyLimit(t *testing.T) {
	const limit = 64
	handler := testHandler(io.Discard, limit)
	for _, test := range []struct {
		name, body, contentType, encoding string
		status                            int
		unknownLength                     bool
	}{
		{name: "valid", body: `{"name":"person"}`, contentType: "application/json; charset=utf-8", status: 201},
		{name: "missing content type", body: `{}`, status: 415},
		{name: "text", body: `{}`, contentType: "text/plain", status: 415},
		{name: "compressed", body: `{}`, contentType: "application/json", encoding: "gzip", status: 415},
		{name: "empty", contentType: "application/json", status: 400},
		{name: "malformed", body: `{"name":`, contentType: "application/json", status: 400},
		{name: "wrong type", body: `{"name":123}`, contentType: "application/json", status: 400},
		{name: "unknown field", body: `{"private-field":"private-value"}`, contentType: "application/json", status: 400},
		{name: "multiple values", body: `{} {}`, contentType: "application/json", status: 400},
		{name: "null", body: `null`, contentType: "application/json", status: 400},
		{name: "array", body: `[]`, contentType: "application/json", status: 400},
		{name: "known oversize", body: `{"name":"` + strings.Repeat("x", limit) + `"}`, contentType: "application/json", status: 413},
		{name: "unknown oversize", body: `{"name":"` + strings.Repeat("x", limit) + `"}`, contentType: "application/json", status: 413, unknownLength: true},
		{name: "oversized trailing whitespace", body: `{}` + strings.Repeat(" ", limit), contentType: "application/json", status: 413, unknownLength: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/items", strings.NewReader(test.body))
			request.Header.Set("Content-Type", test.contentType)
			request.Header.Set("Content-Encoding", test.encoding)
			if test.unknownLength {
				request.ContentLength = -1
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if test.status >= 400 {
				checkProblem(t, response, test.status)
			} else if response.Code != test.status {
				t.Fatalf("status = %d, want %d: %s", response.Code, test.status, response.Body.String())
			}
			if strings.Contains(response.Body.String(), "private-") {
				t.Fatal("decoder echoed private input")
			}
		})
	}
}

func TestProxyAndOriginBoundary(t *testing.T) {
	router := http.NewServeMux()
	router.HandleFunc("/test", func(writer http.ResponseWriter, request *http.Request) {
		for _, key := range []string{"Forwarded", "X-Forwarded-For", "X-Forwarded-Host", "X-Forwarded-Proto", "X-Real-IP", "X-Request-ID"} {
			if request.Header.Get(key) != "" {
				t.Errorf("untrusted %s reached the handler", key)
			}
		}
		if request.Host != "tenant.test" || request.RemoteAddr != "192.0.2.1:1234" {
			t.Error("forwarded headers changed host or peer address")
		}
		writer.WriteHeader(http.StatusNoContent)
	})
	handler := NewHandler(router, slog.New(slog.NewJSONHandler(io.Discard, nil)), 1024)
	for _, test := range []struct {
		name, method, origin, site string
		status                     int
	}{
		{"same origin", "POST", "https://tenant.test", "same-origin", 204},
		{"legacy same host", "POST", "https://tenant.test", "", 204},
		{"non-browser", "POST", "", "", 204},
		{"cross origin", "POST", "https://evil.test", "cross-site", 403},
		{"same site is not same origin", "POST", "https://other.tenant.test", "same-site", 403},
		{"legacy cross origin", "POST", "https://evil.test", "", 403},
		{"null origin", "POST", "null", "", 403},
		{"safe read", "GET", "https://evil.test", "cross-site", 204},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(test.method, "http://tenant.test/test", nil)
			request.RemoteAddr = "192.0.2.1:1234"
			request.Header.Set("Origin", test.origin)
			request.Header.Set("Sec-Fetch-Site", test.site)
			for _, key := range []string{"Forwarded", "X-Forwarded-For", "X-Forwarded-Host", "X-Forwarded-Proto", "X-Real-IP", "X-Request-ID"} {
				request.Header.Set(key, "evil.test")
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if test.status == 403 {
				checkProblem(t, response, 403)
			} else if response.Code != test.status {
				t.Fatalf("status = %d", response.Code)
			}
			if response.Header().Get("Access-Control-Allow-Origin") != "" || response.Header().Get("Access-Control-Allow-Credentials") != "" {
				t.Fatal("cross-origin CORS access enabled")
			}
		})
	}
}

func TestPanicRecovery(t *testing.T) {
	for _, test := range []struct {
		name             string
		committed, abort bool
	}{
		{name: "before response"}, {name: "after response", committed: true}, {name: "intentional abort", abort: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			var logs bytes.Buffer
			router := http.NewServeMux()
			router.HandleFunc("GET /panic", func(writer http.ResponseWriter, request *http.Request) {
				writer.Header().Set("Set-Cookie", "private-cookie")
				writer.Header().Set("Content-Encoding", "gzip")
				if test.committed {
					_, _ = writer.Write([]byte("partial"))
					_ = http.NewResponseController(writer).Flush()
				}
				if test.abort {
					panic(http.ErrAbortHandler)
				}
				panicWithPrivateArgument("private-panic-value", "secret-argument-42")
			})
			response := httptest.NewRecorder()
			var panicValue any
			func() {
				defer func() { panicValue = recover() }()
				NewHandler(router, slog.New(slog.NewJSONHandler(&logs, nil)), 1024).ServeHTTP(response, httptest.NewRequest("GET", "/panic", nil))
			}()
			if test.committed || test.abort {
				if panicValue != http.ErrAbortHandler {
					t.Fatalf("expected an aborted response, got %v", panicValue)
				}
				if strings.Contains(response.Body.String(), "Internal Server Error") {
					t.Fatal("error appended to an aborted response")
				}
			} else {
				if panicValue != nil {
					t.Fatalf("panic escaped recovery: %v", panicValue)
				}
				checkProblem(t, response, 500)
				if response.Header().Get("Set-Cookie") != "" || response.Header().Get("Content-Encoding") != "" {
					t.Fatal("panic retained staged headers")
				}
			}
			logOutput := logs.String()
			for _, private := range []string{"private-", "secret-argument"} {
				if strings.Contains(logOutput, private) || strings.Contains(response.Body.String(), private) {
					t.Fatalf("panic content leaked: %s", private)
				}
			}
			if test.abort && strings.Contains(logOutput, "HTTP handler panicked") {
				t.Fatal("intentional abort logged as a panic")
			}
		})
	}
}

//go:noinline
func panicWithPrivateArgument(message, privateArg string) {
	_ = privateArg
	panic(message)
}

func TestInformationalStatusRecording(t *testing.T) {
	t.Run("103 does not lock status", func(t *testing.T) {
		writer := &responseWriter{ResponseWriter: httptest.NewRecorder()}
		writer.WriteHeader(http.StatusEarlyHints)
		if writer.status != 0 {
			t.Fatalf("103 locked the status to %d", writer.status)
		}
		writer.WriteHeader(http.StatusOK)
		if writer.status != http.StatusOK {
			t.Fatalf("expected 200 after 103, got %d", writer.status)
		}
	})

	t.Run("101 locks status", func(t *testing.T) {
		writer := &responseWriter{ResponseWriter: httptest.NewRecorder()}
		writer.WriteHeader(http.StatusSwitchingProtocols)
		if writer.status != http.StatusSwitchingProtocols {
			t.Fatalf("101 was not recorded, got %d", writer.status)
		}
		// A subsequent WriteHeader must be ignored.
		writer.WriteHeader(http.StatusOK)
		if writer.status != http.StatusSwitchingProtocols {
			t.Fatalf("status changed after 101, got %d", writer.status)
		}
	})
}
