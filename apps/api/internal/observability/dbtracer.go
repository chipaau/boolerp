package observability

import (
	"context"

	"github.com/jackc/pgx/v5"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// DBTracer implements pgx.QueryTracer, nesting one span per query under whatever span is already in
// ctx (the root HTTP span, when called from a request) — UC-OBS-02's "traces span HTTP -> DB". A
// no-op when tracing isn't configured (SetupTracing left the default TracerProvider in place).
type DBTracer struct{}

func (DBTracer) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	ctx, span := otel.Tracer("goerp/db").Start(ctx, "db.query")
	span.SetAttributes(attribute.String("db.system", "postgresql"), attribute.String("db.statement", data.SQL))
	return ctx
}

func (DBTracer) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	span := trace.SpanFromContext(ctx)
	if data.Err != nil {
		span.RecordError(data.Err)
		span.SetStatus(codes.Error, data.Err.Error())
	}
	span.End()
}
