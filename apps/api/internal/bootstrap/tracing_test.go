package bootstrap

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTracingOffByDefault(t *testing.T) {
	t.Setenv("OTEL_TRACES_EXPORTER", "")
	var logs bytes.Buffer
	tr, err := newTracing(t.Context(), slog.New(slog.NewJSONHandler(&logs, nil)))
	require.NoError(t, err)

	assert.IsType(t, noop.TracerProvider{}, tr.provider, "no SDK: spans cost nothing")
	assert.NoError(t, tr.shutdown(t.Context()))
	assert.Contains(t, logs.String(), "tracing off")
}

func TestTracingNoneIsOff(t *testing.T) {
	t.Setenv("OTEL_TRACES_EXPORTER", "none")
	tr, err := newTracing(t.Context(), slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	assert.IsType(t, noop.TracerProvider{}, tr.provider)
}

func TestTracingRejectsUnknownExporter(t *testing.T) {
	t.Setenv("OTEL_TRACES_EXPORTER", "bogus")
	_, err := newTracing(t.Context(), slog.New(slog.DiscardHandler))
	assert.Error(t, err)
}

func TestTracingExportsOverOTLPAndFlushesOnShutdown(t *testing.T) {
	// A stand-in OTLP/HTTP collector that counts trace exports.
	var exports atomic.Int32
	collector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/traces" {
			body, _ := io.ReadAll(r.Body)
			if len(body) > 0 {
				exports.Add(1)
			}
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer collector.Close()
	t.Setenv("OTEL_TRACES_EXPORTER", "otlp")
	t.Setenv("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", collector.URL)

	tr, err := newTracing(t.Context(), slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	assert.IsType(t, &sdktrace.TracerProvider{}, tr.provider)

	_, span := tr.provider.Tracer("test").Start(context.Background(), "work")
	span.End()
	assert.Zero(t, exports.Load(), "spans are batched, not exported during the request")

	require.NoError(t, tr.shutdown(t.Context()))
	assert.EqualValues(t, 1, exports.Load(), "shutdown flushes pending spans")
}

func TestResourceNamesTheService(t *testing.T) {
	t.Setenv("OTEL_SERVICE_NAME", "")
	res, err := newResource(t.Context())
	require.NoError(t, err)
	name, _ := res.Set().Value(semconv.ServiceNameKey)
	assert.Equal(t, serviceName, name.AsString())

	t.Setenv("OTEL_SERVICE_NAME", "erp-api-staging")
	res, err = newResource(t.Context())
	require.NoError(t, err)
	name, _ = res.Set().Value(semconv.ServiceNameKey)
	assert.Equal(t, "erp-api-staging", name.AsString(), "OTEL_SERVICE_NAME overrides the default")
}

// recordSpans returns the real router, wrapped for tracing, with test-only
// routes, and a recorder holding every span it ends.
func recordSpans(t *testing.T) (http.Handler, *tracetest.SpanRecorder) {
	t.Helper()
	recorder := tracetest.NewSpanRecorder()
	tr := &tracing{
		provider:   sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder)),
		propagator: propagation.TraceContext{},
	}
	router, _ := withTestRoute(t)
	router.Get("/api/items/{id}", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	router.Get("/api/panic", func(http.ResponseWriter, *http.Request) { panic("boom") })
	return traceHTTP(router, tr), recorder
}

// attr returns a span attribute's value as a string.
func attr(span sdktrace.ReadOnlySpan, key attribute.Key) string {
	for _, kv := range span.Attributes() {
		if kv.Key == key {
			return kv.Value.Emit()
		}
	}
	return ""
}

func TestHTTPSpanNamedByRoutePattern(t *testing.T) {
	handler, recorder := recordSpans(t)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/items/42", nil))

	spans := recorder.Ended()
	require.Len(t, spans, 1, "one span per request")
	assert.Equal(t, "GET /api/items/{id}", spans[0].Name(), "the pattern, not the raw path")
	assert.Equal(t, "/api/items/{id}", attr(spans[0], semconv.HTTPRouteKey))
	assert.Equal(t, "204", attr(spans[0], semconv.HTTPResponseStatusCodeKey))
	assert.Equal(t, trace.SpanKindServer, spans[0].SpanKind())
}

func TestHTTPSpanForUnmatchedPathUsesMethodOnly(t *testing.T) {
	handler, recorder := recordSpans(t)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/no/such/42", nil))

	require.Len(t, recorder.Ended(), 1)
	assert.Equal(t, "GET", recorder.Ended()[0].Name(), "raw paths never become span names")
}

func TestHTTPSpanMarksServerErrors(t *testing.T) {
	handler, recorder := recordSpans(t)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/panic", nil))

	require.Len(t, recorder.Ended(), 1)
	assert.Equal(t, codes.Error, recorder.Ended()[0].Status().Code, "a recovered panic (500) marks the span as an error")
}

func TestHealthChecksAreNotTraced(t *testing.T) {
	handler, recorder := recordSpans(t)
	for _, path := range []string{livenessPath, readinessPath} {
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, path, nil))
	}
	assert.Empty(t, recorder.Ended())
}

func TestClientTraceContextIsLinkedNotContinued(t *testing.T) {
	handler, recorder := recordSpans(t)
	const clientTrace = "4bf92f3577b34da6a3ce929d0e0e4736"
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	// A client asking us to continue its trace, with sampling switched off.
	req.Header.Set("traceparent", "00-"+clientTrace+"-00f067aa0ba902b7-00")
	handler.ServeHTTP(httptest.NewRecorder(), req)

	spans := recorder.Ended()
	require.Len(t, spans, 1, "traced despite the client's sampled=0 flag")
	span := spans[0]
	assert.NotEqual(t, clientTrace, span.SpanContext().TraceID().String(), "our own trace, not the client's")
	assert.False(t, span.Parent().IsValid(), "no parent from the client")
	require.Len(t, span.Links(), 1)
	assert.Equal(t, clientTrace, span.Links()[0].SpanContext.TraceID().String(), "kept as a link")
}
