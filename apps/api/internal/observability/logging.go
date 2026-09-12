package observability

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5/middleware"
)

type ctxKey int

const loggerKey ctxKey = iota

// WithLogger stores a request-scoped logger in the context.
func WithLogger(ctx context.Context, l *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerKey, l)
}

// LoggerFrom retrieves the request-scoped logger, falling back to slog.Default() so callers never
// need a nil check (e.g. background jobs with no request context).
func LoggerFrom(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(loggerKey).(*slog.Logger); ok {
		return l
	}
	return slog.Default()
}

// RequestLogger attaches a request-scoped logger carrying the correlation/request id (chi's
// RequestID middleware must run before this) to the context (FR-OBS-01/UC-OBS-01). Handlers and
// deeper layers add tenant_id/user_id as they become known (see auth.Middleware.RequireSession)
// rather than this middleware guessing at them.
func RequestLogger(base *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			l := base.With("request_id", middleware.GetReqID(r.Context()))
			next.ServeHTTP(w, r.WithContext(WithLogger(r.Context(), l)))
		})
	}
}

// sensitiveKeys are attribute keys never allowed to reach a log line unredacted (FR-OBS-06) —
// credentials/tokens, never PII beyond IDs.
var sensitiveKeys = map[string]bool{
	"password": true, "token": true, "secret": true, "credential": true, "credentials": true,
	"authorization": true, "cookie": true, "access_token": true, "refresh_token": true, "api_key": true,
}

// NewRedactingHandler wraps a slog.Handler so any attribute whose key matches a known-sensitive
// name has its value replaced before it ever reaches the sink — a code-level guarantee, not just a
// "don't log this" convention.
func NewRedactingHandler(h slog.Handler) slog.Handler {
	return redactingHandler{h}
}

type redactingHandler struct{ slog.Handler }

func (h redactingHandler) Handle(ctx context.Context, r slog.Record) error {
	nr := slog.NewRecord(r.Time, r.Level, r.Message, r.PC)
	r.Attrs(func(a slog.Attr) bool {
		nr.AddAttrs(redactAttr(a))
		return true
	})
	return h.Handler.Handle(ctx, nr)
}

func (h redactingHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	redacted := make([]slog.Attr, len(attrs))
	for i, a := range attrs {
		redacted[i] = redactAttr(a)
	}
	return redactingHandler{h.Handler.WithAttrs(redacted)}
}

func (h redactingHandler) WithGroup(name string) slog.Handler {
	return redactingHandler{h.Handler.WithGroup(name)}
}

func redactAttr(a slog.Attr) slog.Attr {
	if sensitiveKeys[strings.ToLower(a.Key)] {
		return slog.String(a.Key, "[REDACTED]")
	}
	return a
}
