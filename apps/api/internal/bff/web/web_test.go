package web

import (
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const themeScript = `
      try { document.documentElement.classList.add('dark') } catch (e) {}
    `

// built looks like `vite build` output: an index.html with an inline script and
// an external module, hashed assets, and a public file.
var built = fstest.MapFS{
	"index.html": {Data: []byte(`<!doctype html><html><head>
    <script>` + themeScript + `</script>
    <script type="module" crossorigin src="/assets/index-AbC123.js"></script>
  </head><body><div id="app"></div></body></html>`)},
	"assets/index-AbC123.js":  {Data: []byte(`console.log("app")`)},
	"assets/index-Def456.css": {Data: []byte(`body{}`)},
	"favicon.png":             {Data: []byte("png")},
}

func get(t *testing.T, h http.Handler, target string, header http.Header) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, target, nil)
	for k, v := range header {
		req.Header[k] = v
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func newHandler(t *testing.T) *Handler {
	t.Helper()
	h, err := New(built)
	require.NoError(t, err)
	return h
}

func TestHashedAssetsAreCachedForAYear(t *testing.T) {
	rec := get(t, newHandler(t), "/assets/index-AbC123.js", nil)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "public, max-age=31536000, immutable", rec.Header().Get("Cache-Control"))
	assert.Contains(t, rec.Header().Get("Content-Type"), "javascript")
	assert.Equal(t, `console.log("app")`, rec.Body.String())
}

func TestIndexAndRootFilesRevalidate(t *testing.T) {
	h := newHandler(t)
	for _, target := range []string{"/", "/favicon.png"} {
		rec := get(t, h, target, nil)
		require.Equal(t, http.StatusOK, rec.Code, target)
		assert.Equal(t, "no-cache", rec.Header().Get("Cache-Control"), target)
		etag := rec.Header().Get("ETag")
		require.NotEmpty(t, etag, target)

		again := get(t, h, target, http.Header{"If-None-Match": {etag}})
		assert.Equal(t, http.StatusNotModified, again.Code, "unchanged: 304 (%s)", target)
		assert.Empty(t, again.Body.String())
	}
}

func TestAppRoutesGetIndex(t *testing.T) {
	h := newHandler(t)
	for _, target := range []string{"/", "/employees/42", "/settings?tab=1", "/index.html"} {
		rec := get(t, h, target, nil)
		require.Equal(t, http.StatusOK, rec.Code, target)
		assert.Contains(t, rec.Body.String(), `<div id="app">`, target)
		assert.Contains(t, rec.Header().Get("Content-Type"), "text/html", target)
	}
}

func TestMissingFilesAreNotHTML(t *testing.T) {
	rec := get(t, newHandler(t), "/assets/index-Old999.js", nil)
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.True(t, strings.HasPrefix(rec.Header().Get("Content-Type"), "application/problem+json"))
}

func TestPathsCannotLeaveTheApp(t *testing.T) {
	rec := get(t, newHandler(t), "/assets/../../web.go", nil)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestPolicyAllowsOnlyTheInlineScriptsOfIndex(t *testing.T) {
	rec := get(t, newHandler(t), "/", nil)
	csp := rec.Header().Get("Content-Security-Policy")
	sum := sha256.Sum256([]byte(themeScript))
	assert.Contains(t, csp, "script-src 'self' 'sha256-"+base64.StdEncoding.EncodeToString(sum[:])+"';")
	assert.Equal(t, 1, strings.Count(csp, "sha256-"), "external scripts need no hash")
	for _, directive := range []string{"default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "connect-src 'self'"} {
		assert.Contains(t, csp, directive)
	}
	assert.NotContains(t, csp, "unsafe-eval")
	assert.Equal(t, "strict-origin-when-cross-origin", rec.Header().Get("Referrer-Policy"))
}

func TestFormsMayContinueAtTheLoginService(t *testing.T) {
	h, err := New(built, "http://identity.bool.test")
	require.NoError(t, err)
	csp := get(t, h, "/", nil).Header().Get("Content-Security-Policy")
	assert.Contains(t, csp, "form-action 'self' http://identity.bool.test;")
}

func TestTheEmbeddedAppLoads(t *testing.T) {
	h, err := New(App())
	require.NoError(t, err, "the placeholder (or a real build) has an index.html")
	assert.Equal(t, http.StatusOK, get(t, h, "/", nil).Code)
}

func TestAnAppWithoutIndexIsRefused(t *testing.T) {
	_, err := New(fstest.MapFS{"assets/a.js": {Data: []byte("x")}})
	assert.Error(t, err)
}
