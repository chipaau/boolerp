package bootstrap

import (
	"context"
	"log/slog"
	"strings"
	"testing"
	"time"

	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/config"
)

// recordingTracing returns tracing that records ended spans.
func recordingTracing() (*tracing, *tracetest.SpanRecorder) {
	recorder := tracetest.NewSpanRecorder()
	return &tracing{
		enabled:    true,
		provider:   sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder)),
		propagator: propagation.TraceContext{},
	}, recorder
}

// leaks reports every span attribute or event attribute containing secret.
func leaks(spans []sdktrace.ReadOnlySpan, secret string) []string {
	var found []string
	for _, s := range spans {
		for _, kv := range s.Attributes() {
			if strings.Contains(kv.Value.String(), secret) {
				found = append(found, s.Name()+": "+string(kv.Key))
			}
		}
		for _, e := range s.Events() {
			for _, kv := range e.Attributes {
				if strings.Contains(kv.Value.String(), secret) {
					found = append(found, s.Name()+" event: "+string(kv.Key))
				}
			}
		}
	}
	return found
}

func TestNoInstrumentationWhenTelemetryIsOff(t *testing.T) {
	off := &tracing{provider: noop.NewTracerProvider(), propagator: propagation.TraceContext{}}
	pool, err := newPool(t.Context(), config.DB{
		Host: "127.0.0.1", Port: 1, Name: "erp", User: "app", Password: "x", SSLMode: "disable", MaxConns: 1,
	}, off, noMetrics(), slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	defer pool.Close()
	assert.Nil(t, pool.Config().ConnConfig.Tracer, "no query tracer attached")
}

func TestCacheSpansNeverContainCredentials(t *testing.T) {
	// redisotel records db.connection_string on every span; it must hold only
	// the address. No server is needed: the failed command still makes spans.
	tr, recorder := recordingTracing()
	cache, err := newCache(t.Context(), config.Redis{
		Host: "127.0.0.1", Port: 1, Username: "cache", Password: "s3cret-pass", Timeout: 200 * time.Millisecond,
	}, tr, noMetrics(), slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	defer cache.Close()

	ctx, parent := tr.provider.Tracer("test").Start(context.Background(), "request")
	_ = cache.Get(ctx, "key").Err()
	parent.End()

	require.NotEmpty(t, recorder.Ended())
	assert.Empty(t, leaks(recorder.Ended(), "s3cret-pass"))
	for _, s := range recorder.Ended() {
		if cs := attr(s, "db.connection_string"); cs != "" {
			assert.Equal(t, "redis://127.0.0.1:1", cs)
		}
	}
}
