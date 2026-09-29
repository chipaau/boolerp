package bootstrap

import (
	"context"
	"log/slog"
	"os"

	"go.opentelemetry.io/contrib/exporters/autoexport"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
)

// serviceName identifies the API in traces unless OTEL_SERVICE_NAME overrides it.
const serviceName = "bool-erp-api"

// tracing holds what instrumentation needs (C54–C56). It is passed explicitly
// to the HTTP server, database, and cache instrumentation instead of being set
// as OpenTelemetry's global provider.
type tracing struct {
	provider   trace.TracerProvider
	propagator propagation.TextMapPropagator
	// shutdown flushes spans that have not been exported yet.
	shutdown func(context.Context) error
}

// newTracing configures OpenTelemetry from the standard OTEL_* environment
// variables (C55): OTEL_TRACES_EXPORTER (otlp, console, none),
// OTEL_EXPORTER_OTLP_ENDPOINT and _HEADERS, OTEL_TRACES_SAMPLER (default:
// every request, parent-based; C56), OTEL_SERVICE_NAME, and the rest of the
// specification. Unknown values fail startup.
//
// Export is off unless OTEL_TRACES_EXPORTER is set, and then the SDK is not
// started at all: a no-op provider builds no spans, so tracing costs nothing.
func newTracing(ctx context.Context, logger *slog.Logger) (*tracing, error) {
	// Only W3C Trace Context. Baggage is left out: it carries arbitrary
	// client-supplied data that would flow into downstream calls.
	propagator := propagation.TraceContext{}

	// Report OpenTelemetry's own errors (for example a failed export) through
	// the application logger instead of plain text on stderr. OpenTelemetry
	// only offers this process-wide.
	otel.SetErrorHandler(otel.ErrorHandlerFunc(func(err error) {
		logger.Warn("tracing error", "error", err)
	}))

	exporter, err := autoexport.NewSpanExporter(ctx,
		autoexport.WithFallbackSpanExporter(func(context.Context) (sdktrace.SpanExporter, error) {
			return exportOff{}, nil
		}))
	if err != nil {
		return nil, err
	}
	if _, off := exporter.(exportOff); off || autoexport.IsNoneSpanExporter(exporter) {
		logger.Info("tracing off; set OTEL_TRACES_EXPORTER to export traces")
		return &tracing{
			provider:   noop.NewTracerProvider(),
			propagator: propagator,
			shutdown:   func(context.Context) error { return nil },
		}, nil
	}

	res, err := newResource(ctx)
	if err != nil {
		return nil, err
	}
	provider := sdktrace.NewTracerProvider(
		// Batching exports in the background: requests never wait for export.
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		// No sampler option: the SDK reads OTEL_TRACES_SAMPLER itself.
	)
	logger.Info("tracing on", "exporter", os.Getenv("OTEL_TRACES_EXPORTER"))
	return &tracing{provider: provider, propagator: propagator, shutdown: provider.Shutdown}, nil
}

// newResource describes this service in every span. OTEL_SERVICE_NAME and
// OTEL_RESOURCE_ATTRIBUTES override the defaults, because later detectors win.
func newResource(ctx context.Context) (*resource.Resource, error) {
	return resource.New(ctx,
		resource.WithAttributes(semconv.ServiceName(serviceName)),
		resource.WithTelemetrySDK(),
		resource.WithFromEnv(),
	)
}

// exportOff is the exporter used when OTEL_TRACES_EXPORTER is unset. autoexport's
// own default is "otlp" to localhost; tracing is opt-in here instead.
type exportOff struct{}

func (exportOff) ExportSpans(context.Context, []sdktrace.ReadOnlySpan) error { return nil }
func (exportOff) Shutdown(context.Context) error                             { return nil }
