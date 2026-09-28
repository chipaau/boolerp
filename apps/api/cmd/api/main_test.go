package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/observability"
	"github.com/boolmv/erp/apps/api/internal/platform/requestid"
)

var discard = slog.New(slog.DiscardHandler)

// logLines parses one JSON log record per line.
func logLines(t *testing.T, buf *bytes.Buffer) []map[string]any {
	t.Helper()
	var lines []map[string]any
	for _, raw := range bytes.Split(bytes.TrimSpace(buf.Bytes()), []byte("\n")) {
		if len(raw) == 0 {
			continue
		}
		var line map[string]any
		require.NoError(t, json.Unmarshal(raw, &line))
		lines = append(lines, line)
	}
	return lines
}

func TestHealthz(t *testing.T) {
	var buf bytes.Buffer
	rec := httptest.NewRecorder()
	newRouter(observability.NewLogger(&buf, "json", slog.LevelInfo), 1024).
		ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/healthz", nil))

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, ".", rec.Body.String())
	assert.Empty(t, buf.String(), "health checks are not logged")
}

func TestRequestLog(t *testing.T) {
	var buf bytes.Buffer
	rec := httptest.NewRecorder()
	newRouter(observability.NewLogger(&buf, "json", slog.LevelInfo), 1024).
		ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api", nil))

	id := rec.Header().Get(requestid.Header)
	require.NotEmpty(t, id, "the response carries the request ID")

	lines := logLines(t, &buf)
	require.Len(t, lines, 1, "one line per request")
	line := lines[0]
	assert.Equal(t, id, line[requestid.LogKey], "the log line carries the same ID")
	assert.Equal(t, "GET", line["http.request.method"])
	assert.Equal(t, "/api", line["url.path"])
	assert.EqualValues(t, http.StatusNoContent, line["http.response.status_code"])
}

func TestRequestLogIgnoresClientRequestID(t *testing.T) {
	var buf bytes.Buffer
	req := httptest.NewRequest(http.MethodGet, "/api", nil)
	req.Header.Set(requestid.Header, "0195f180-2939-7bc4-bffe-838eb3c62526")
	rec := httptest.NewRecorder()
	newRouter(observability.NewLogger(&buf, "json", slog.LevelInfo), 1024).ServeHTTP(rec, req)

	assert.NotContains(t, buf.String(), "0195f180-2939-7bc4-bffe-838eb3c62526")
	assert.NotEqual(t, "0195f180-2939-7bc4-bffe-838eb3c62526", rec.Header().Get(requestid.Header))
}

func TestRequestBodyLimit(t *testing.T) {
	// Add a test-only route to the real router, behind the real middleware.
	var readErr error
	router := newRouter(discard, 8)
	router.Post("/api/echo", func(w http.ResponseWriter, r *http.Request) {
		_, readErr = io.ReadAll(r.Body)
	})

	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/echo", strings.NewReader("12345678")))
	require.NoError(t, readErr, "a body at the limit is accepted")

	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/echo", strings.NewReader("123456789")))
	var tooLarge *http.MaxBytesError
	assert.True(t, errors.As(readErr, &tooLarge), "a body over the limit fails with MaxBytesError")
}
