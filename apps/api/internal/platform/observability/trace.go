package observability

import (
	"context"
	"log/slog"

	"go.opentelemetry.io/otel/trace"
)

// Log attributes linking a record to its trace (C59), the names log and trace
// tools look for.
const (
	TraceIDKey = "trace_id"
	SpanIDKey  = "span_id"
)

// traceHandler adds trace_id and span_id to records logged with a context
// holding a sampled span, so a log line can be opened in the trace backend.
// Without tracing, or for unsampled requests, nothing is added.
//
// It only reads the span. Unlike remychantenay/slog-otel's defaults, it never
// copies log records into traces, where they would bypass redaction (C60).
type traceHandler struct{ slog.Handler }

func (h traceHandler) Handle(ctx context.Context, r slog.Record) error {
	if sc := trace.SpanContextFromContext(ctx); sc.IsValid() && sc.IsSampled() {
		r.AddAttrs(slog.String(TraceIDKey, sc.TraceID().String()), slog.String(SpanIDKey, sc.SpanID().String()))
	}
	return h.Handler.Handle(ctx, r)
}

func (h traceHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return traceHandler{h.Handler.WithAttrs(attrs)}
}

func (h traceHandler) WithGroup(name string) slog.Handler {
	return traceHandler{h.Handler.WithGroup(name)}
}
