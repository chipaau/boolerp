//go:build feature

package bootstrap

import (
	"context"
	"log/slog"
	"os"
	"strconv"
	"testing"
	"time"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/config"
	"github.com/boolmv/erp/apps/api/internal/testdb"
)

// Feature tests (C77): they need PostgreSQL and Redis (see docs/testing.md).

func TestFeatureDatabaseSpansRecordSQLButNotParameters(t *testing.T) {
	s := testdb.Settings(t, testdb.RuntimeRole)
	tr, recorder := recordingTracing()
	pool, err := newPool(t.Context(), config.DB{
		Host: s.Host, Port: s.Port, Name: s.Name, User: s.User,
		Password: s.Password, SSLMode: s.SSLMode, MaxConns: 2,
	}, tr, noMetrics(), slog.New(slog.DiscardHandler))
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

func TestFeatureCacheSpansRecordCommandNamesOnly(t *testing.T) {
	host := os.Getenv("REDIS_TEST_HOST")
	if host == "" {
		t.Fatal("REDIS_TEST_HOST is not set; feature tests need Redis (see docs/testing.md)")
	}
	tr, recorder := recordingTracing()
	cache, err := newCache(t.Context(), config.Redis{Host: host, Port: 6379, Timeout: time.Second}, tr, noMetrics(), slog.New(slog.DiscardHandler))
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
