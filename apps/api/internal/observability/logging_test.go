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

	"github.com/go-chi/chi/v5/middleware"

	"github.com/boolmv/goerp/internal/observability"
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
