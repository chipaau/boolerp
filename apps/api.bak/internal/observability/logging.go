package observability

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
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
// RequestID middleware must run before this) to the context (FR-OBS-01/UC-OBS-01). It also
// correlates the two halves of observability that otherwise never meet: request_id is attached to
// the active span (set by otelhttp, which wraps this whole router — see httpapi.New) as an
// attribute, so a trace can be found by request_id; and if tracing is actually configured, the
// span's trace_id is added to the logger too, so a log line can point back to its trace. request_id
// is the one identifier that's always present — an OTel trace_id only exists when OTLP is
// configured — which is why it's the id shown to callers (see respond.Error), not the trace_id.
// Handlers and deeper layers add tenant_id/user_id as they become known (see
// auth.Middleware.RequireSession) rather than this middleware guessing at them.
func RequestLogger(base *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reqID := middleware.GetReqID(r.Context())
			l := base.With("request_id", reqID)

			span := trace.SpanFromContext(r.Context())
			span.SetAttributes(attribute.String("request_id", reqID))
			if sc := span.SpanContext(); sc.IsValid() {
				l = l.With("trace_id", sc.TraceID().String())
			}

			next.ServeHTTP(w, r.WithContext(WithLogger(r.Context(), l)))
		})
	}
}

// AccessLog emits one line per completed request. Without it a successful request produced no log
// line at all: the request id was threaded into the response, the trace, Cerbos's decision log and
// the audit row, yet the API's own log had nothing to grep for it — so "what happened in request X?"
// could only be answered for requests that failed loudly enough to log something themselves.
//
// Must run inside RequestLogger, so the line inherits request_id (and trace_id when tracing is on).
// Deferred, so a panicking handler is still recorded rather than vanishing — Recoverer converts it
// to a 500 below this middleware, which is what ww then reports.
//
// Polled endpoints are logged only when they fail: the container healthcheck hits /healthz and
// Prometheus scrapes /metrics every few seconds, and thousands of identical 200s a day would bury
// the requests worth reading.
func AccessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		defer func() {
			status := ww.Status()
			if isPolledEndpoint(r.URL.Path) && status < http.StatusBadRequest {
				return
			}
			LoggerFrom(r.Context()).Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"route", routePattern(r),
				"status", status,
				"bytes", ww.BytesWritten(),
				"duration_ms", float64(time.Since(start).Microseconds())/1000,
			)
		}()
		next.ServeHTTP(ww, r)
	})
}

func isPolledEndpoint(path string) bool {
	return path == "/healthz" || path == "/readyz" || path == "/" || path == "/metrics"
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
