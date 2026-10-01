package bootstrap

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/auth"
	"github.com/boolmv/erp/apps/api/internal/platform/httpinput"
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

// withConfig returns the real router built from rc plus test-only GET and POST
// /api/test routes answering 204, and the buffer its logger writes to.
func withConfig(t *testing.T, rc routerConfig) (chi.Router, *bytes.Buffer) {
	t.Helper()
	var buf bytes.Buffer
	if rc.CheckReady == nil {
		rc.CheckReady = func(context.Context) error { return nil }
	}
	if rc.ReadyTimeout == 0 {
		rc.ReadyTimeout = time.Second
	}
	r, err := newRouter(observability.NewLogger(&buf, "json", slog.LevelInfo), rc)
	require.NoError(t, err)
	noContent := func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }
	r.Get("/api/test", noContent)
	r.Post("/api/test", noContent)
	return r, &buf
}

// withTestRoute is withConfig with no trusted proxies and no allowed origins.
func withTestRoute(t *testing.T) (chi.Router, *bytes.Buffer) {
	t.Helper()
	return withConfig(t, routerConfig{MaxBodyBytes: 1024})
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
	router, err := newRouter(discard, routerConfig{MaxBodyBytes: 8})
	require.NoError(t, err)
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

func TestPathsMatchExactly(t *testing.T) {
	router, _ := withTestRoute(t)
	for _, path := range []string{"/api//healthz", "/api/healthz/", "/api/./healthz", "/API/healthz"} {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		assert.Equal(t, http.StatusNotFound, rec.Code, path)
	}
}

func TestClientIPFromTrustedProxyHops(t *testing.T) {
	for _, tt := range []struct {
		hops int
		want string
	}{
		{1, "203.0.113.9"},  // one proxy: the right-most entry, which it appended
		{2, "198.51.100.7"}, // two proxies: the second from the right
	} {
		router, buf := withConfig(t, routerConfig{MaxBodyBytes: 1024, TrustedProxyHops: tt.hops})
		req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
		req.RemoteAddr = "10.1.2.3:4567" // the nearest proxy
		// "6.6.6.6" is client-supplied and left of every trusted entry.
		req.Header.Set("X-Forwarded-For", "6.6.6.6, 198.51.100.7, 203.0.113.9")
		router.ServeHTTP(httptest.NewRecorder(), req)

		assert.Equal(t, tt.want, logLines(t, buf)[0]["client.address"], "hops=%d", tt.hops)
	}
}

func TestClientIPIgnoresForwardedHeadersByDefault(t *testing.T) {
	router, buf := withTestRoute(t)
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.RemoteAddr = "192.0.2.10:4567"
	req.Header.Set("X-Forwarded-For", "203.0.113.9") // spoofed
	router.ServeHTTP(httptest.NewRecorder(), req)

	assert.Equal(t, "192.0.2.10", logLines(t, buf)[0]["client.address"])
}

// crossOrigin builds a browser-style request from origin.
func crossOrigin(method, origin string) *http.Request {
	req := httptest.NewRequest(method, "http://api.bool.test/api/test", nil)
	req.Header.Set("Origin", origin)
	req.Header.Set("Sec-Fetch-Site", "cross-site")
	return req
}

func TestCORSAllowsListedOrigins(t *testing.T) {
	router, _ := withConfig(t, routerConfig{MaxBodyBytes: 1024, AllowedOrigins: []string{"https://app.bool.mv"}})

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, crossOrigin(http.MethodGet, "https://app.bool.mv"))
	assert.Equal(t, "https://app.bool.mv", rec.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(t, requestid.Header, rec.Header().Get("Access-Control-Expose-Headers"))

	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, crossOrigin(http.MethodGet, "https://evil.example"))
	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"), "other origins cannot read responses")
}

func TestCORSPreflight(t *testing.T) {
	router, _ := withConfig(t, routerConfig{MaxBodyBytes: 1024, AllowedOrigins: []string{"https://app.bool.mv"}})
	req := crossOrigin(http.MethodOptions, "https://app.bool.mv")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	req.Header.Set("Access-Control-Request-Headers", "Content-Type")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	assert.Equal(t, "https://app.bool.mv", rec.Header().Get("Access-Control-Allow-Origin"))
	assert.Contains(t, rec.Header().Get("Access-Control-Allow-Methods"), http.MethodPost)
}

func TestNoOriginsMeansNoCrossOriginReads(t *testing.T) {
	// go-chi/cors would allow every origin if given an empty list; the router
	// must not install it at all.
	router, _ := withTestRoute(t)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, crossOrigin(http.MethodGet, "https://evil.example"))

	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
}

func TestCrossOriginWrites(t *testing.T) {
	router, _ := withConfig(t, routerConfig{MaxBodyBytes: 1024, AllowedOrigins: []string{"https://app.bool.mv"}})

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, crossOrigin(http.MethodPost, "https://evil.example"))
	assert.Equal(t, http.StatusForbidden, rec.Code, "writes from other origins are rejected")
	assert.Equal(t, "Forbidden", decodeProblem(t, rec).Title)

	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, crossOrigin(http.MethodPost, "https://app.bool.mv"))
	assert.Equal(t, http.StatusNoContent, rec.Code, "writes from allowed origins pass")

	sameOrigin := httptest.NewRequest(http.MethodPost, "http://api.bool.test/api/test", nil)
	sameOrigin.Header.Set("Origin", "http://api.bool.test")
	sameOrigin.Header.Set("Sec-Fetch-Site", "same-origin")
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, sameOrigin)
	assert.Equal(t, http.StatusNoContent, rec.Code, "same-origin writes pass")

	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/test", nil))
	assert.Equal(t, http.StatusNoContent, rec.Code, "non-browser requests without Origin pass")
}

func TestReadinessWhenReady(t *testing.T) {
	router, buf := withTestRoute(t)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, readinessPath, nil))

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))
	assert.JSONEq(t, `{"status":"ready"}`, rec.Body.String())
	assert.Empty(t, buf.String(), "successful checks are not logged")
}

func TestReadinessWhenNotReady(t *testing.T) {
	router, buf := withConfig(t, routerConfig{
		MaxBodyBytes: 1024,
		CheckReady: func(context.Context) error {
			return errors.New("dial tcp 10.0.0.5:5432: connect: connection refused")
		},
	})
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, readinessPath, nil))

	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
	d := decodeProblem(t, rec)
	assert.Equal(t, "Service Unavailable", d.Title)
	assert.NotContains(t, rec.Body.String(), "10.0.0.5", "the cause is not returned to the client")

	lines := logLines(t, buf)
	require.Len(t, lines, 2, "the cause, then the failed request")
	assert.Equal(t, "not ready", lines[0]["msg"])
	assert.Contains(t, lines[0]["error"], "connection refused", "the cause is logged")
	assert.EqualValues(t, http.StatusServiceUnavailable, lines[1]["http.response.status_code"])
}

func TestReadinessIsBoundedByTimeout(t *testing.T) {
	router, _ := withConfig(t, routerConfig{
		MaxBodyBytes: 1024,
		ReadyTimeout: 50 * time.Millisecond,
		CheckReady: func(ctx context.Context) error {
			<-ctx.Done() // a dependency that never answers
			return ctx.Err()
		},
	})
	start := time.Now()
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, readinessPath, nil))

	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
	assert.Less(t, time.Since(start), time.Second)
}

func TestRequestInputThroughTheRouter(t *testing.T) {
	type body struct {
		Name string `json:"name" validate:"required"`
	}
	router, err := newRouter(discard, routerConfig{MaxBodyBytes: 64, CheckReady: func(context.Context) error { return nil }, ReadyTimeout: time.Second})
	require.NoError(t, err)
	router.Post("/api/v1/test-input", func(w http.ResponseWriter, r *http.Request) {
		var b body
		if !httpinput.Decode(w, r, &b) {
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	send := func(contentType, payload string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/test-input", strings.NewReader(payload))
		req.Header.Set("Content-Type", contentType)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	assert.Equal(t, http.StatusNoContent, send("application/json", `{"name":"a"}`).Code)
	assert.Equal(t, http.StatusUnprocessableEntity, send("application/json", `{}`).Code)
	assert.Equal(t, http.StatusUnsupportedMediaType, send("text/plain", `{"name":"a"}`).Code)
	tooLarge := send("application/json", `{"name":"`+strings.Repeat("a", 100)+`"}`)
	assert.Equal(t, http.StatusRequestEntityTooLarge, tooLarge.Code, "the router's RequestSize limit")
	assert.Equal(t, problem.ContentType, tooLarge.Header().Get("Content-Type"))
}

func TestModulesInheritDefaultsAndApplyTheirOwnAuth(t *testing.T) {
	// No issuer is reachable: a request without a token is refused before any
	// key is needed, and health checks never ask for one.
	router, buf := withConfig(t, routerConfig{MaxBodyBytes: 1024})
	mount(router, modules{
		auth: auth.New(t.Context(), auth.Settings{Issuer: "http://127.0.0.1:1/", Audience: "erp-api"},
			&http.Client{Timeout: time.Second}),
	})

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/auth/me", nil))
	assert.Equal(t, http.StatusUnauthorized, rec.Code, "mounted at /api/auth, protected by the module")
	// The default middleware applies to module routes: request ID and nosniff.
	assert.NotEmpty(t, rec.Header().Get("X-Request-Id"))
	assert.Equal(t, "nosniff", rec.Header().Get("X-Content-Type-Options"))
	assert.Contains(t, buf.String(), "/api/auth/me", "the request is logged")

	for _, path := range []string{livenessPath, readinessPath} {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		assert.Equal(t, http.StatusOK, rec.Code, path)
	}
}
