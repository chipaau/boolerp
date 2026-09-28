// Package observability builds the application's structured logger.
package observability

import (
	"io"
	"log/slog"
	"slices"
)

// Redacted replaces the value of a sensitive attribute.
const Redacted = "[REDACTED]"

// NewLogger returns a logger writing to w. format is "json" or "text"; anything
// else falls back to JSON. Sensitive attributes are redacted by name.
func NewLogger(w io.Writer, format string, level slog.Leveler) *slog.Logger {
	opts := &slog.HandlerOptions{Level: level, ReplaceAttr: redact}
	if format == "text" {
		return slog.New(slog.NewTextHandler(w, opts))
	}
	return slog.New(slog.NewJSONHandler(w, opts))
}

// redact is a slog ReplaceAttr hook. slog calls it for every attribute,
// including those added with Logger.With, and passes the enclosing group names.
// The attribute is redacted if its key or any enclosing group is sensitive
// (see sensitive.go). slog provides the hook but not the policy.
func redact(groups []string, a slog.Attr) slog.Attr {
	if sensitive(a.Key) || slices.ContainsFunc(groups, sensitive) {
		return slog.String(a.Key, Redacted)
	}
	return a
}
