// Package observability builds the application's structured logger.
package observability

import (
	"io"
	"log/slog"
	"slices"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/requestid"
)

// Redacted replaces the value of a sensitive attribute.
const Redacted = "[REDACTED]"

// NewLogger returns a logger writing to w. format is "json" or "text"; anything
// else falls back to JSON. Sensitive attributes are redacted by name, and records
// logged with a request's context carry its request_id and, when the request is
// traced, its trace_id and span_id.
func NewLogger(w io.Writer, format string, level slog.Leveler) *slog.Logger {
	opts := &slog.HandlerOptions{Level: level, ReplaceAttr: redact}
	var h slog.Handler = slog.NewJSONHandler(w, opts)
	if format == "text" {
		h = slog.NewTextHandler(w, opts)
	}
	return slog.New(requestid.LogHandler(traceHandler{h}))
}

// redact is a slog ReplaceAttr hook. slog calls it for every attribute,
// including those added with Logger.With, and passes the enclosing group names.
// The attribute is redacted if its key or any enclosing group is sensitive
// (see sensitive.go). In every string value, including the message and url.full,
// the values of sensitive query parameters are redacted, such as the login
// callback's authorization code, whatever the attribute is called. slog provides
// the hook but not the policy.
func redact(groups []string, a slog.Attr) slog.Attr {
	if sensitive(a.Key) || slices.ContainsFunc(groups, sensitive) {
		return slog.String(a.Key, Redacted)
	}
	if a.Value.Kind() == slog.KindString {
		if scrubbed := scrubQuery(a.Value.String()); scrubbed != a.Value.String() {
			return slog.String(a.Key, scrubbed)
		}
	}
	return a
}
