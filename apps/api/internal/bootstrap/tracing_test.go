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

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"
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
