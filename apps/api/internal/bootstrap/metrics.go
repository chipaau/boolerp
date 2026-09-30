package bootstrap

import (
	"context"
	"log/slog"
	"os"

	"go.opentelemetry.io/contrib/exporters/autoexport"
	"go.opentelemetry.io/contrib/instrumentation/runtime"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/metric/noop"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
)

// metrics holds the meter provider that instrumentation records into (H6,
// C82). Like tracing, it is passed explicitly rather than set globally.
type metrics struct {
	// enabled is false when export is off; instrumentation is then not attached.
	enabled  bool
	provider metric.MeterProvider
	// shutdown exports the last readings.
	shutdown func(context.Context) error
}

// newMetrics configures OpenTelemetry metrics from the standard OTEL_*
// variables, as newTracing does for traces: OTEL_METRICS_EXPORTER chooses otlp
// (push, OTEL_EXPORTER_OTLP_*), prometheus (pull: a separate /metrics server
// on OTEL_EXPORTER_PROMETHEUS_HOST:PORT, default localhost:9464, never on the
// API's own routes), console, or none; OTEL_METRIC_EXPORT_INTERVAL sets the
// push interval. Unknown values fail startup.
//
// Export is off unless OTEL_METRICS_EXPORTER is set, and then no SDK runs.
func newMetrics(ctx context.Context, logger *slog.Logger) (*metrics, error) {
	off := &metrics{
		provider: noop.NewMeterProvider(),
		shutdown: func(context.Context) error { return nil },
	}
	// autoexport's own default when unset is "otlp" to localhost; metrics are
	// opt-in here, like tracing.
	if os.Getenv("OTEL_METRICS_EXPORTER") == "" {
		logger.Info("metrics off; set OTEL_METRICS_EXPORTER to export metrics")
		return off, nil
	}
	reader, err := autoexport.NewMetricReader(ctx)
	if err != nil {
		return nil, err
	}
	if autoexport.IsNoneMetricReader(reader) {
		logger.Info("metrics off; set OTEL_METRICS_EXPORTER to export metrics")
		return off, nil
	}

	res, err := newResource(ctx)
	if err != nil {
		return nil, err
	}
	provider := sdkmetric.NewMeterProvider(sdkmetric.WithReader(reader), sdkmetric.WithResource(res))
	// Goroutines, memory, and garbage collection: what explains slowness that
	// request metrics alone cannot.
	if err := runtime.Start(runtime.WithMeterProvider(provider)); err != nil {
		return nil, err
	}
	logger.Info("metrics on", "exporter", os.Getenv("OTEL_METRICS_EXPORTER"))
	return &metrics{enabled: true, provider: provider, shutdown: provider.Shutdown}, nil
}
