package bootstrap

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"go.opentelemetry.io/contrib/exporters/autoexport"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/boolmv/erp/apps/api/internal/platform/requestid"
)

// serviceName identifies the API in traces unless OTEL_SERVICE_NAME overrides it.
const serviceName = "bool-erp-api"

// tracing holds what instrumentation needs (C54–C56). It is passed explicitly
// to the HTTP server, database, and cache instrumentation instead of being set
// as OpenTelemetry's global provider.
type tracing struct {
	// enabled is false when export is off; instrumentation is then not attached.
	enabled    bool
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
	// the application logger instead of plain text on stderr, throttled so a
	// collector outage does not log every 5 seconds (C62). OpenTelemetry only
	// offers this process-wide.
	otel.SetErrorHandler(newErrorThrottle(logger, time.Minute, time.Now))

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
	return &tracing{enabled: true, provider: provider, propagator: propagator, shutdown: provider.Shutdown}, nil
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

// instrumentHTTP wraps the whole router so each request gets one server span
// that covers every middleware (C57) and is counted in the request metrics
// (http.server.request.duration and body sizes, C82). Both are named and tagged
// by chi's route pattern by recordRoute, which runs inside the router.
//
// Every request is treated as public (C58): a client's traceparent becomes a
// link, never the parent, so clients cannot choose trace IDs or switch
// sampling off for their own requests. Health and readiness checks are
// neither traced nor counted.
func instrumentHTTP(handler http.Handler, tr *tracing, mt *metrics, health healthPaths) http.Handler {
	return otelhttp.NewHandler(handler, "http.server",
		otelhttp.WithTracerProvider(tr.provider),
		otelhttp.WithMeterProvider(mt.provider),
		otelhttp.WithPropagators(tr.propagator),
		otelhttp.WithPublicEndpointFn(func(*http.Request) bool { return true }),
		otelhttp.WithFilter(func(r *http.Request) bool {
			return r.URL.Path != health.Liveness && r.URL.Path != health.Readiness
		}),
	)
}

// recordRoute names the request's span after routing, for example
// "GET /api/employees/{id}" instead of "GET", and adds http.route to its
// metrics through otelhttp's Labeler. It is the documented gap in otelhttp with
// chi: otelhttp reads the route from r.Pattern, but chi sets Pattern on its own
// copy of the request, which otelhttp never sees. Unmatched requests (404, 405)
// get no route, so raw paths never become span names or metric labels.
func recordRoute(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
		// The route context is shared, so the pattern is known once next returns.
		rctx := chi.RouteContext(r.Context())
		if rctx == nil {
			return
		}
		if pattern := rctx.RoutePattern(); pattern != "" {
			span := trace.SpanFromContext(r.Context())
			span.SetName(r.Method + " " + pattern)
			span.SetAttributes(semconv.HTTPRoute(pattern))
			if labeler, ok := otelhttp.LabelerFromContext(r.Context()); ok {
				labeler.Add(semconv.HTTPRoute(pattern))
			}
		}
	})
}

// spanRequestID adds the request ID to the request's span as request.id, so a
// support ticket's request ID leads to its trace (C59). It must run after
// requestid.Middleware.
func spanRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if id := requestid.FromContext(r.Context()); id != "" {
			trace.SpanFromContext(r.Context()).SetAttributes(attribute.String("request.id", id))
		}
		next.ServeHTTP(w, r)
	})
}

// errorThrottle logs OpenTelemetry errors at WARN: the first at once, then at
// most one per window, carrying how many were suppressed since the last one.
// During a collector outage the batch exporter fails every 5 seconds; this
// keeps the outage visible without 720 identical lines an hour. OpenTelemetry
// has no built-in throttle (a documented gap), and a general log-sampling
// library would affect every log line, not just this one.
type errorThrottle struct {
	logger *slog.Logger
	window time.Duration
	now    func() time.Time

	mu         sync.Mutex
	last       time.Time
	suppressed int
}

func newErrorThrottle(logger *slog.Logger, window time.Duration, now func() time.Time) *errorThrottle {
	return &errorThrottle{logger: logger, window: window, now: now}
}

// Handle implements otel.ErrorHandler. It may be called concurrently.
func (t *errorThrottle) Handle(err error) {
	t.mu.Lock()
	now := t.now()
	if !t.last.IsZero() && now.Sub(t.last) < t.window {
		t.suppressed++
		t.mu.Unlock()
		return
	}
	suppressed := t.suppressed
	t.last, t.suppressed = now, 0
	t.mu.Unlock()

	if suppressed > 0 {
		t.logger.Warn("telemetry error", "error", err, "suppressed", suppressed)
		return
	}
	t.logger.Warn("telemetry error", "error", err)
}
