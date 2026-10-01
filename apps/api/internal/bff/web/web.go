// Package web serves the app embedded in the BFF (C90, C99): the files of
// `vite build`, which the release image copies into app/ before compiling
// (docker/bff.Dockerfile). In development the folder holds a placeholder page,
// since Vite's dev server serves the app.
//
// Files under /assets/ have content hashes in their names and are cached for a
// year; other files (index.html, favicon) are revalidated with an ETag. Paths
// without a file extension that match no file are the app's own routes and get
// index.html. Every response carries the Content-Security-Policy, whose
// script-src allows index.html's inline scripts by their hashes, computed here.
package web

import (
	"bytes"
	"crypto/sha256"
	"embed"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/boolmv/erp/apps/api/internal/platform/problem"
)

//go:embed all:app
var embedded embed.FS

// App returns the embedded app's files.
func App() fs.FS {
	sub, err := fs.Sub(embedded, "app")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}

// Cache-Control values (C99).
const (
	cacheHashed     = "public, max-age=31536000, immutable"
	cacheRevalidate = "no-cache"
)

// file is one embedded file, read once at startup.
type file struct {
	content []byte
	etag    string
}

// Handler serves the app.
type Handler struct {
	files map[string]file // by path without the leading slash
	index file
	csp   string
}

// New reads the app's files from fsys, computes their ETags, and builds the
// Content-Security-Policy from index.html's inline scripts.
func New(fsys fs.FS) (*Handler, error) {
	h := &Handler{files: map[string]file{}}
	err := fs.WalkDir(fsys, ".", func(name string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		content, err := fs.ReadFile(fsys, name)
		if err != nil {
			return err
		}
		sum := sha256.Sum256(content)
		h.files[name] = file{content: content, etag: `"` + hex.EncodeToString(sum[:16]) + `"`}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("web: reading the app: %w", err)
	}
	index, ok := h.files["index.html"]
	if !ok {
		return nil, errors.New("web: the app has no index.html")
	}
	h.index = index
	h.csp = policy(inlineScriptHashes(index.content))
	return h, nil
}

// ServeHTTP serves a file, or index.html for the app's own routes.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Security-Policy", h.csp)
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

	name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
	f, ok := h.files[name]
	switch {
	case ok && name != "index.html":
		cache := cacheRevalidate
		if strings.HasPrefix(name, "assets/") {
			cache = cacheHashed
		}
		serve(w, r, name, f, cache)
	case ok || path.Ext(name) == "":
		// "/", "/index.html", and the app's routes ("/employees/42").
		serve(w, r, "index.html", h.index, cacheRevalidate)
	default:
		// A missing file (an old asset): never HTML in its place.
		problem.Error(w, r, http.StatusNotFound, "No resource exists at this path.")
	}
}

// serve writes f with http.ServeContent, which answers If-None-Match with 304,
// handles Range requests, and sets Content-Type from the name.
func serve(w http.ResponseWriter, r *http.Request, name string, f file, cache string) {
	w.Header().Set("Cache-Control", cache)
	w.Header().Set("ETag", f.etag)
	http.ServeContent(w, r, name, time.Time{}, bytes.NewReader(f.content))
}

// inlineScript matches a <script> element without a src attribute; Vite's own
// scripts are external (/assets/...), so only the page's inline code matches.
var inlineScript = regexp.MustCompile(`(?is)<script\b([^>]*)>(.*?)</script>`)

// inlineScriptHashes returns the CSP source of each inline script in html,
// such as 'sha256-...'. Browsers hash the exact text between the tags.
func inlineScriptHashes(html []byte) []string {
	var sources []string
	for _, m := range inlineScript.FindAllSubmatch(html, -1) {
		if bytes.Contains(bytes.ToLower(m[1]), []byte("src=")) {
			continue
		}
		sum := sha256.Sum256(m[2])
		sources = append(sources, "'sha256-"+base64.StdEncoding.EncodeToString(sum[:])+"'")
	}
	return sources
}

// policy is the Content-Security-Policy (C99). Google Fonts are allowed until
// the apps self-host Lato, as their index.html notes.
func policy(scriptHashes []string) string {
	script := strings.Join(append([]string{"'self'"}, scriptHashes...), " ")
	return strings.Join([]string{
		"default-src 'self'",
		"script-src " + script,
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"font-src 'self' https://fonts.gstatic.com",
		"img-src 'self' data:",
		"connect-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
	}, "; ")
}
