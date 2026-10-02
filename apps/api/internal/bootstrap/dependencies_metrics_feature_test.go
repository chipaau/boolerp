//go:build feature

package bootstrap

import (
	"log/slog"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/config"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Feature tests (C77, C82): they need PostgreSQL and Redis (see docs/testing.md).

// attributeValues returns every attribute value in m's data points.
func attributeValues(m metricdata.Metrics) []string {
	var values []string
	switch data := m.Data.(type) {
	case metricdata.Histogram[float64]:
		for _, dp := range data.DataPoints {
			for _, kv := range dp.Attributes.ToSlice() {
				values = append(values, kv.Value.String())
			}
		}
	case metricdata.Histogram[int64]:
		for _, dp := range data.DataPoints {
			for _, kv := range dp.Attributes.ToSlice() {
				values = append(values, kv.Value.String())
			}
		}
	case metricdata.Sum[int64]:
		for _, dp := range data.DataPoints {
			for _, kv := range dp.Attributes.ToSlice() {
				values = append(values, kv.Value.String())
			}
		}
	case metricdata.Gauge[int64]:
		for _, dp := range data.DataPoints {
			for _, kv := range dp.Attributes.ToSlice() {
				values = append(values, kv.Value.String())
			}
		}
	}
	return values
}

func TestFeatureDatabaseMetricsCountQueriesAndPool(t *testing.T) {
	mt, reader := recordingMetrics()
	s := testdb.Settings(t, testdb.RuntimeRole)
	pool, err := newPool(t.Context(), config.DB{
		Host: s.Host, Port: s.Port, Name: s.Name, User: s.User,
		Password: s.Password, SSLMode: s.SSLMode, MaxConns: 2,
	}, noTracing(), mt, slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	defer pool.Close()

	var n int
	require.NoError(t, pool.QueryRow(t.Context(), "SELECT $1::int", 42).Scan(&n))

	metrics := collect(t, reader)
	for _, name := range []string{"db.client.operation.duration", "pgxpool.acquires", "pgxpool.max_connections"} {
		require.Contains(t, metrics, name)
		for _, v := range attributeValues(metrics[name]) {
			assert.NotContains(t, v, "SELECT", "%s: no SQL text in metric attributes", name)
			assert.NotContains(t, v, s.Password, "%s: no password", name)
		}
	}
}

func TestFeatureCacheMetricsCountConnections(t *testing.T) {
	host := os.Getenv("REDIS_TEST_HOST")
	if host == "" {
		t.Fatal("REDIS_TEST_HOST is not set; feature tests need Redis (see docs/testing.md)")
	}
	mt, reader := recordingMetrics()
	cache, err := newCache(t.Context(), config.Redis{Host: host, Port: 6379, Timeout: time.Second}, noTracing(), mt, slog.New(slog.DiscardHandler))
	require.NoError(t, err)
	defer cache.Close()

	key := "employee:s3cret-key-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	require.NoError(t, cache.Set(t.Context(), key, "s3cret-cached-record", time.Minute).Err())
	require.NoError(t, cache.Del(t.Context(), key).Err())

	metrics := collect(t, reader)
	require.Contains(t, metrics, "db.client.connections.use_time")
	for name, m := range metrics {
		for _, v := range attributeValues(m) {
			assert.NotContains(t, v, "s3cret", "%s: no keys or values in metric attributes", name)
		}
	}
}
