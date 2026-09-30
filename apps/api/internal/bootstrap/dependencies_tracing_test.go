package bootstrap

import (
	"cmp"
	"context"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/config"
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

func TestDatabaseSpansRecordSQLButNotParameters(t *testing.T) {
	user := os.Getenv("POSTGRES_TEST_APP_USER")
	if user == "" {
		t.Skip("POSTGRES_TEST_APP_USER not set")
	}
	port, _ := strconv.Atoi(cmp.Or(os.Getenv("POSTGRES_TEST_PORT"), "5432"))
	tr, recorder := recordingTracing()
	pool, err := newPool(t.Context(), config.DB{
		Host: cmp.Or(os.Getenv("POSTGRES_TEST_HOST"), "localhost"), Port: port,
		Name: cmp.Or(os.Getenv("POSTGRES_TEST_DB"), "erp"), User: user,
		Password: os.Getenv("POSTGRES_TEST_APP_PASSWORD"), SSLMode: "disable", MaxConns: 2,
	}, tr, slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	defer pool.Close()

	ctx, parent := tr.provider.Tracer("test").Start(context.Background(), "request")
	var got string
	require.NoError(t, pool.QueryRow(ctx, "SELECT $1::text", "s3cret-salary").Scan(&got))
	parent.End()

	var query sdktrace.ReadOnlySpan
	for _, s := range recorder.Ended() {
		if attr(s, semconv.DBQueryTextKey) != "" {
			query = s
		}
	}
	require.NotNil(t, query, "the query produced a span")
	assert.Equal(t, "SELECT $1::text", attr(query, semconv.DBQueryTextKey), "SQL text with placeholders")
	assert.Equal(t, parent.SpanContext().SpanID(), query.Parent().SpanID(), "a child of the request's span")
	assert.Empty(t, leaks(recorder.Ended(), "s3cret-salary"), "parameter values never recorded")
}

func TestCacheSpansRecordCommandNamesOnly(t *testing.T) {
	host := os.Getenv("REDIS_TEST_HOST")
	if host == "" {
		t.Skip("REDIS_TEST_HOST not set")
	}
	tr, recorder := recordingTracing()
	cache, err := newCache(t.Context(), config.Redis{Host: host, Port: 6379, Timeout: time.Second}, tr, slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	defer cache.Close()

	ctx, parent := tr.provider.Tracer("test").Start(context.Background(), "request")
	key := "employee:s3cret-key-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	require.NoError(t, cache.Set(ctx, key, "s3cret-cached-record", time.Minute).Err())
	require.NoError(t, cache.Get(ctx, key).Err())
	require.NoError(t, cache.Del(ctx, key).Err())
	parent.End()

	var names []string
	for _, s := range recorder.Ended() {
		names = append(names, s.Name())
	}
	assert.Subset(t, names, []string{"set", "get", "del"}, "one span per command, named by command")
	assert.Empty(t, leaks(recorder.Ended(), "s3cret"), "no cached values or keys recorded")
}

func TestNoInstrumentationWhenTracingIsOff(t *testing.T) {
	off := &tracing{provider: noop.NewTracerProvider(), propagator: propagation.TraceContext{}}
	pool, err := newPool(t.Context(), config.DB{
		Host: "127.0.0.1", Port: 1, Name: "erp", User: "app", Password: "x", SSLMode: "disable", MaxConns: 1,
	}, off, slog.New(slog.DiscardHandler))
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
	}, tr, slog.New(slog.DiscardHandler))
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
