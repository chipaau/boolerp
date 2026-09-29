package observability

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"testing"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// logWith logs one record with ctx and returns it decoded.
func logWith(t *testing.T, ctx context.Context) map[string]any {
	t.Helper()
	var buf bytes.Buffer
	NewLogger(&buf, "json", slog.LevelInfo).InfoContext(ctx, "event", "password", "s3cret")
	var line map[string]any
	require.NoError(t, json.Unmarshal(buf.Bytes(), &line))
	return line
}

func TestTraceIDsOnSampledSpans(t *testing.T) {
	provider := sdktrace.NewTracerProvider(sdktrace.WithSampler(sdktrace.AlwaysSample()))
	ctx, span := provider.Tracer("test").Start(context.Background(), "work")
	defer span.End()

	line := logWith(t, ctx)
	assert.Equal(t, span.SpanContext().TraceID().String(), line[TraceIDKey])
	assert.Equal(t, span.SpanContext().SpanID().String(), line[SpanIDKey])
	assert.Equal(t, Redacted, line["password"], "redaction still applies")
}

func TestNoTraceIDsWithoutASpan(t *testing.T) {
	line := logWith(t, context.Background())
	assert.NotContains(t, line, TraceIDKey)
	assert.NotContains(t, line, SpanIDKey)
}

func TestNoTraceIDsForUnsampledSpans(t *testing.T) {
	// An unsampled trace is never exported, so linking to it would lead nowhere.
	provider := sdktrace.NewTracerProvider(sdktrace.WithSampler(sdktrace.NeverSample()))
	ctx, span := provider.Tracer("test").Start(context.Background(), "work")
	defer span.End()
	require.False(t, span.SpanContext().IsSampled())

	assert.NotContains(t, logWith(t, ctx), TraceIDKey)
}

func TestLogsNeverReachTheSpan(t *testing.T) {
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	ctx, span := provider.Tracer("test").Start(context.Background(), "work")
	logWith(t, ctx)
	span.End()

	require.Len(t, recorder.Ended(), 1)
	assert.Empty(t, recorder.Ended()[0].Events(), "no log records copied into the trace")
	assert.Empty(t, recorder.Ended()[0].Attributes(), "not even the redacted password")
}
