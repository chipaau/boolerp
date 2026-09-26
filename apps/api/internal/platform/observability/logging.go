package observability

import (
	"io"
	"log/slog"
	"strings"
)

// NewLogger creates a structured logger. Callers must pass a validated format
// and avoid secrets in free-form messages, errors, or opaque object values.
func NewLogger(output io.Writer, format string, level slog.Level) *slog.Logger {
	options := &slog.HandlerOptions{
		Level:       level,
		ReplaceAttr: redact,
	}
	if format == "text" {
		return slog.New(slog.NewTextHandler(output, options))
	}
	return slog.New(slog.NewJSONHandler(output, options))
}

func redact(groups []string, attr slog.Attr) slog.Attr {
	if sensitiveKey(attr.Key) {
		return slog.String(attr.Key, "[REDACTED]")
	}
	for _, group := range groups {
		if sensitiveKey(group) {
			return slog.String(attr.Key, "[REDACTED]")
		}
	}
	return attr
}

var sensitiveKeywords = []string{
	"password",
	"secret",
	"token",
	"credential",
	"authorization",
	"cookie",
	"dsn",
	"apikey",
	"privatekey",
	"accesskey",
	"signingkey",
}

func sensitiveKey(key string) bool {
	key = strings.ReplaceAll(strings.ReplaceAll(strings.ToLower(key), "_", ""), "-", "")
	for _, part := range sensitiveKeywords {
		if strings.Contains(key, part) {
			return true
		}
	}
	// Connection URLs can include credentials. Redact the whole value instead of
	// trying to distinguish safe URL components from provider-specific secrets.
	return strings.HasSuffix(key, "url")
}
