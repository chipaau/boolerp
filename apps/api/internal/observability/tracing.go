// Package observability implements component 07: distributed tracing, request-scoped structured
// logging (with redaction), and metrics — distinct from the business audit trail (internal/audit,
// component 06). Self-host default is stdout structured logs with zero external backends; tracing
// and metrics stay off until explicitly configured (FR-OBS-03/04, UC-OBS-06).
package observability

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

// TracingConfig controls whether tracing is active at all.
type TracingConfig struct {
	// OTLPEndpoint is the collector to export spans to (host:port, no scheme). Empty (the self-host
	// default) means tracing stays off: no exporter is created, and otel's own default no-op
	// TracerProvider stays in place, so span creation elsewhere in the app costs nothing and makes
	// no network calls.
	OTLPEndpoint string
	ServiceName  string
}

// SetupTracing configures a real OTLP-exporting TracerProvider when OTLPEndpoint is set, or leaves
// tracing off. The returned shutdown func flushes and closes the exporter; always call it (a no-op
// when tracing was never enabled).
func SetupTracing(ctx context.Context, cfg TracingConfig) (shutdown func(context.Context) error, err error) {
	noop := func(context.Context) error { return nil }
	if cfg.OTLPEndpoint == "" {
		return noop, nil
	}

	exp, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpoint(cfg.OTLPEndpoint),
		otlptracehttp.WithInsecure(),
	)
	if err != nil {
		return noop, fmt.Errorf("observability: otlp exporter: %w", err)
	}

	res, err := resource.New(ctx, resource.WithAttributes(semconv.ServiceName(cfg.ServiceName)))
	if err != nil {
		return noop, fmt.Errorf("observability: resource: %w", err)
	}

	tp := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exp), sdktrace.WithResource(res))
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
	return tp.Shutdown, nil
}
