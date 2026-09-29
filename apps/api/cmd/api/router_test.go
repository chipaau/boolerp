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

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/observability"
	"github.com/boolmv/erp/apps/api/internal/platform/problem"
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

// withTestRoute returns the real router plus a test-only GET /api/test route
// answering 204, and the buffer its logger writes to.
func withTestRoute(t *testing.T) (chi.Router, *bytes.Buffer) {
	t.Helper()
	var buf bytes.Buffer
	r := newRouter(observability.NewLogger(&buf, "json", slog.LevelInfo), 1024)
	r.Get("/api/test", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	return r, &buf
}

func TestLiveness(t *testing.T) {
	router, buf := withTestRoute(t)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, livenessPath, nil))

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))
	assert.JSONEq(t, `{"status":"ok"}`, rec.Body.String())
	assert.Empty(t, buf.String(), "health checks are not logged")
}

func TestLivenessHead(t *testing.T) {
	// Real server: net/http drops the body for HEAD, which httptest.Recorder does not.
	router, _ := withTestRoute(t)
	srv := httptest.NewServer(router)
	defer srv.Close()

	resp, err := http.Head(srv.URL + livenessPath)
	require.NoError(t, err)
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "application/json", resp.Header.Get("Content-Type"))
	assert.Empty(t, body)
}

func TestRequestLog(t *testing.T) {
	router, buf := withTestRoute(t)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/test", nil))

	id := rec.Header().Get(requestid.Header)
	require.NotEmpty(t, id, "the response carries the request ID")

	lines := logLines(t, buf)
	require.Len(t, lines, 1, "one line per request")
	line := lines[0]
	assert.Equal(t, id, line[requestid.LogKey], "the log line carries the same ID")
	assert.Equal(t, "GET", line["http.request.method"])
	assert.Equal(t, "/api/test", line["url.path"])
	assert.EqualValues(t, http.StatusNoContent, line["http.response.status_code"])
}

func TestRequestLogIgnoresClientRequestID(t *testing.T) {
	router, buf := withTestRoute(t)
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set(requestid.Header, "0195f180-2939-7bc4-bffe-838eb3c62526")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

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

// decodeProblem checks the response is RFC 9457 problem details and returns them.
func decodeProblem(t *testing.T, rec *httptest.ResponseRecorder) problem.Details {
	t.Helper()
	assert.Equal(t, problem.ContentType, rec.Header().Get("Content-Type"))
	var d problem.Details
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &d))
	return d
}

func TestNotFoundIsProblemDetails(t *testing.T) {
	router, buf := withTestRoute(t)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/nope", nil))

	assert.Equal(t, http.StatusNotFound, rec.Code)
	d := decodeProblem(t, rec)
	assert.Equal(t, "about:blank", d.Type)
	assert.Equal(t, "Not Found", d.Title)
	assert.Equal(t, http.StatusNotFound, d.Status)
	assert.Equal(t, "urn:uuid:"+rec.Header().Get(requestid.Header), d.Instance, "instance is the request ID")
	assert.Contains(t, buf.String(), rec.Header().Get(requestid.Header), "and matches the log line")
}

func TestMethodNotAllowedIsProblemDetailsWithAllow(t *testing.T) {
	router, _ := withTestRoute(t)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, livenessPath, nil))

	assert.Equal(t, http.StatusMethodNotAllowed, rec.Code)
	assert.Equal(t, "GET, HEAD", rec.Header().Get("Allow"))
	d := decodeProblem(t, rec)
	assert.Equal(t, "Method Not Allowed", d.Title)
	assert.Equal(t, http.StatusMethodNotAllowed, d.Status)
}

func TestNoSniffOnEveryResponse(t *testing.T) {
	router, _ := withTestRoute(t)
	for _, path := range []string{livenessPath, "/api/test", "/api/nope"} {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		assert.Equal(t, "nosniff", rec.Header().Get("X-Content-Type-Options"), path)
	}
}

func TestPanicIsProblemDetailsAndLogged(t *testing.T) {
	router, buf := withTestRoute(t)
	router.Get("/api/panic", func(http.ResponseWriter, *http.Request) { panic("s3cret value") })
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/panic", nil))

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	d := decodeProblem(t, rec)
	assert.Equal(t, "Internal Server Error", d.Title)
	assert.Equal(t, "nosniff", rec.Header().Get("X-Content-Type-Options"))

	lines := logLines(t, buf)
	require.Len(t, lines, 2, "the panic, then the request line")
	id := rec.Header().Get(requestid.Header)
	assert.Equal(t, "panic recovered", lines[0]["msg"])
	assert.Equal(t, "ERROR", lines[1]["level"])
	assert.EqualValues(t, http.StatusInternalServerError, lines[1]["http.response.status_code"])
	for _, line := range lines {
		assert.Equal(t, id, line[requestid.LogKey])
	}
	assert.NotContains(t, buf.String(), "s3cret")
}
