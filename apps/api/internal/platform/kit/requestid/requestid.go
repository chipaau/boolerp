// Package requestid gives every HTTP request a server-generated ID (C33).
//
// It wraps github.com/go-chi/traceid: the ID is a UUIDv7, stored in the request
// context, returned in the X-Request-Id response header, and added as
// "request_id" to every log record written with that context. This package is
// the only place that configures traceid, so the header and log key stay
// consistent between the middleware and the log handler.
package requestid

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/go-chi/traceid"
)

const (
	// Header carries the request ID in responses.
	Header = "X-Request-Id"
	// LogKey is the log attribute holding the request ID.
	LogKey = "request_id"
)

// traceid is configured through package variables. Setting them in init
// guarantees they are in place before any importer uses this package.
func init() {
	traceid.Header = http.CanonicalHeaderKey(Header)
	traceid.LogKey = LogKey
}

// Middleware assigns a new request ID to every request and returns it in the
// response header. Any client-supplied X-Request-Id is discarded first: IDs are
// log evidence, so clients must not choose them.
func Middleware(next http.Handler) http.Handler {
	assign := traceid.Middleware(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Header.Del(Header)
		assign.ServeHTTP(w, r)
	})
}

// FromContext returns the request ID stored by Middleware, or "".
func FromContext(ctx context.Context) string {
	return traceid.FromContext(ctx)
}

// LogHandler wraps h so records logged with a request's context
// (logger.InfoContext(ctx, ...)) carry its request ID.
func LogHandler(h slog.Handler) slog.Handler {
	return traceid.LogHandler(h)
}
