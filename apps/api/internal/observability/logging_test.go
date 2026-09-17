package observability_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/boolmv/erp/internal/observability"
)

func TestRedactingHandler_ScrubsSensitiveTopLevelAttrs(t *testing.T) {
	var buf bytes.Buffer
	base := slog.NewJSONHandler(&buf, nil)
	logger := slog.New(observability.NewRedactingHandler(base))

	logger.Info("issued credential", "password", "hunter2", "email", "a@b.mv")

	var line map[string]any
	if err := json.Unmarshal(buf.Bytes(), &line); err != nil {
		t.Fatalf("unmarshal log line: %v", err)
	}
	if line["password"] != "[REDACTED]" {
		t.Fatalf("want password redacted, got %v", line["password"])
	}
	if line["email"] != "a@b.mv" {
		t.Fatalf("want non-sensitive attrs untouched, got %v", line["email"])
	}
}

func TestRedactingHandler_ScrubsAttrsAddedViaWith(t *testing.T) {
	var buf bytes.Buffer
	base := slog.NewJSONHandler(&buf, nil)
	logger := slog.New(observability.NewRedactingHandler(base)).With("authorization", "Bearer xyz")

	logger.Info("outbound call")

	var line map[string]any
	if err := json.Unmarshal(buf.Bytes(), &line); err != nil {
		t.Fatalf("unmarshal log line: %v", err)
	}
	if line["authorization"] != "[REDACTED]" {
		t.Fatalf("want authorization redacted, got %v", line["authorization"])
	}
}

func TestRequestLogger_AttachesRequestID(t *testing.T) {
	var buf bytes.Buffer
	base := slog.New(slog.NewJSONHandler(&buf, nil))

	var gotID string
	h := middleware.RequestID(observability.RequestLogger(base)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		observability.LoggerFrom(r.Context()).Info("handled")
		gotID = middleware.GetReqID(r.Context())
		w.WriteHeader(http.StatusOK)
	})))

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if gotID == "" {
		t.Fatal("want chi to have assigned a request id")
	}
	if !strings.Contains(buf.String(), `"request_id":"`+gotID+`"`) {
		t.Fatalf("want the log line to carry request_id=%q, got %s", gotID, buf.String())
	}
}

func TestLoggerFrom_FallsBackToDefaultWhenUnset(t *testing.T) {
	l := observability.LoggerFrom(context.Background())
	if l == nil {
		t.Fatal("want a non-nil logger even with no request-scoped one set")
	}
}

func accessLogLine(t *testing.T, method, path string, h http.HandlerFunc, mw ...func(http.Handler) http.Handler) map[string]any {
	t.Helper()
	var out bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&out, nil))

	r := chi.NewRouter()
	r.Use(observability.RequestLogger(logger))
	r.Use(observability.AccessLog)
	for _, m := range mw {
		r.Use(m)
	}
	r.Method(method, path, h)

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(method, strings.Replace(path, "{id}", "99", 1), nil))

	if out.Len() == 0 {
		return nil
	}
	var line map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(out.Bytes()), &line); err != nil {
		t.Fatalf("access log line is not JSON (%q): %v", out.String(), err)
	}
	return line
}

// The point of the access log: a successful request leaves a line that carries the same request_id
// the caller was given, so "what happened in request X?" is answerable for any request, not only the
// ones that failed loudly enough to log something themselves.
func TestAccessLog_LogsSuccessfulRequestsWithTheRequestID(t *testing.T) {
	line := accessLogLine(t, http.MethodGet, "/widgets/{id}",
		func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("ok")) })

	if line == nil {
		t.Fatal("want a log line for a successful request")
	}
	if line["msg"] != "request" || line["method"] != "GET" {
		t.Fatalf("line: %v", line)
	}
	if line["path"] != "/widgets/99" || line["route"] != "/widgets/{id}" {
		t.Fatalf("want both the concrete path and the matched route, got %v", line)
	}
	if line["status"] != float64(http.StatusOK) || line["bytes"] != float64(2) {
		t.Fatalf("line: %v", line)
	}
	if _, ok := line["request_id"]; !ok {
		t.Fatalf("want the request id on the line, got %v", line)
	}
	if _, ok := line["duration_ms"]; !ok {
		t.Fatalf("want a duration on the line, got %v", line)
	}
}

// A panicking handler must still leave a record — it's the request most worth reading about.
func TestAccessLog_RecordsPanicsAs500(t *testing.T) {
	line := accessLogLine(t, http.MethodGet, "/boom/{id}",
		func(http.ResponseWriter, *http.Request) { panic("handler exploded") },
		middleware.Recoverer)

	if line == nil {
		t.Fatal("want a log line even when the handler panics")
	}
	if line["status"] != float64(http.StatusInternalServerError) {
		t.Fatalf("want the panic recorded as a 500, got %v", line)
	}
}

// Health probes and metric scrapes arrive every few seconds; thousands of identical 200s would bury
// everything worth reading. Failures still get logged, because an unhealthy probe is news.
func TestAccessLog_SkipsHealthyProbesButLogsFailingOnes(t *testing.T) {
	for _, path := range []string{"/healthz", "/readyz", "/", "/metrics"} {
		if line := accessLogLine(t, http.MethodGet, path,
			func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }); line != nil {
			t.Fatalf("%s: want a healthy probe not to be logged, got %v", path, line)
		}
	}

	line := accessLogLine(t, http.MethodGet, "/readyz",
		func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusServiceUnavailable) })
	if line == nil || line["status"] != float64(http.StatusServiceUnavailable) {
		t.Fatalf("want a FAILING probe logged, got %v", line)
	}
}
