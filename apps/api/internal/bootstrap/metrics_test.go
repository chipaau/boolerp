package bootstrap

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric/noop"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
	tracenoop "go.opentelemetry.io/otel/trace/noop"
)

// noMetrics is metrics export switched off, as when OTEL_METRICS_EXPORTER is unset.
func noMetrics() *metrics {
	return &metrics{provider: noop.NewMeterProvider(), shutdown: func(context.Context) error { return nil }}
}

// noTracing is tracing export switched off.
func noTracing() *tracing {
	return &tracing{provider: tracenoop.NewTracerProvider(), propagator: propagation.TraceContext{}}
}

// recordingMetrics records into a reader the test collects from on demand.
func recordingMetrics() (*metrics, *sdkmetric.ManualReader) {
	reader := sdkmetric.NewManualReader()
	provider := sdkmetric.NewMeterProvider(sdkmetric.WithReader(reader))
	return &metrics{enabled: true, provider: provider, shutdown: provider.Shutdown}, reader
}

// collect returns every metric recorded so far, by name.
func collect(t *testing.T, reader *sdkmetric.ManualReader) map[string]metricdata.Metrics {
	t.Helper()
	var rm metricdata.ResourceMetrics
	require.NoError(t, reader.Collect(t.Context(), &rm))
	byName := map[string]metricdata.Metrics{}
	for _, sm := range rm.ScopeMetrics {
		for _, m := range sm.Metrics {
			byName[m.Name] = m
		}
	}
	return byName
}

// requestRoutes returns the http.route of each request-duration data point,
// "" for points without one, and fails if any attribute holds leak.
func requestRoutes(t *testing.T, m metricdata.Metrics, leak string) []string {
	t.Helper()
	hist, ok := m.Data.(metricdata.Histogram[float64])
	require.True(t, ok, "http.server.request.duration is a float histogram")
	var routes []string
	for _, dp := range hist.DataPoints {
		for _, kv := range dp.Attributes.ToSlice() {
			assert.NotContains(t, kv.Value.String(), leak, "metric attribute %s", kv.Key)
		}
		route, _ := dp.Attributes.Value(attribute.Key("http.route"))
		routes = append(routes, route.AsString())
	}
	return routes
}

func TestRequestMetricsUseRoutePatternNotPath(t *testing.T) {
	mt, reader := recordingMetrics()
	router, _ := withTestRoute(t)
	router.Get("/api/items/{id}", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	handler := instrumentHTTP(router, noTracing(), mt, apiHealth)

	for _, path := range []string{"/api/items/s3cret-42", "/api/no-such-s3cret", livenessPath} {
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, path, nil))
	}

	metrics := collect(t, reader)
	require.Contains(t, metrics, "http.server.request.duration")
	routes := requestRoutes(t, metrics["http.server.request.duration"], "s3cret")
	// The item request is labelled by its pattern; the unmatched one has no
	// route; the liveness check is not counted at all.
	assert.ElementsMatch(t, []string{"/api/items/{id}", ""}, routes)
}

func TestMetricsOffUnlessExporterSet(t *testing.T) {
	t.Setenv("OTEL_METRICS_EXPORTER", "")
	mt, err := newMetrics(t.Context(), slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	assert.False(t, mt.enabled)
}

func TestMetricsUnknownExporterFailsStartup(t *testing.T) {
	t.Setenv("OTEL_METRICS_EXPORTER", "s3cret-exporter")
	_, err := newMetrics(t.Context(), slog.New(slog.DiscardHandler))
	require.Error(t, err)
}
