package observability

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total", Help: "Total HTTP requests by method, route, and status.",
	}, []string{"method", "route", "status"})

	httpRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name: "http_request_duration_seconds", Help: "HTTP request latency by method and route.",
	}, []string{"method", "route"})
)

func init() {
	prometheus.MustRegister(httpRequestsTotal, httpRequestDuration)
}

// MetricsMiddleware records request rate/latency by method + matched route pattern (not the raw
// path, which would blow up cardinality on any path with an id segment).
func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)

		route := "unmatched"
		if rc := chi.RouteContext(r.Context()); rc != nil && rc.RoutePattern() != "" {
			route = rc.RoutePattern()
		}
		httpRequestsTotal.WithLabelValues(r.Method, route, strconv.Itoa(ww.Status())).Inc()
		httpRequestDuration.WithLabelValues(r.Method, route).Observe(time.Since(start).Seconds())
	})
}

// MetricsHandler serves the Prometheus exposition format — mount behind an opt-in config flag
// (FR-OBS-04); self-host doesn't need it wired up to see value from the request logs alone.
func MetricsHandler() http.Handler {
	return promhttp.Handler()
}

// dbPoolCollector exposes pgxpool.Stat() as gauges — registered once per pool via RegisterPoolMetrics.
type dbPoolCollector struct {
	pool *pgxpool.Pool
}

var (
	dbPoolAcquired = prometheus.NewDesc("db_pool_acquired_conns", "Currently acquired connections.", nil, nil)
	dbPoolIdle     = prometheus.NewDesc("db_pool_idle_conns", "Currently idle connections.", nil, nil)
	dbPoolTotal    = prometheus.NewDesc("db_pool_total_conns", "Total connections (idle + acquired + constructing).", nil, nil)
	dbPoolMax      = prometheus.NewDesc("db_pool_max_conns", "Configured maximum pool size.", nil, nil)
)

func (c dbPoolCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- dbPoolAcquired
	ch <- dbPoolIdle
	ch <- dbPoolTotal
	ch <- dbPoolMax
}

func (c dbPoolCollector) Collect(ch chan<- prometheus.Metric) {
	s := c.pool.Stat()
	ch <- prometheus.MustNewConstMetric(dbPoolAcquired, prometheus.GaugeValue, float64(s.AcquiredConns()))
	ch <- prometheus.MustNewConstMetric(dbPoolIdle, prometheus.GaugeValue, float64(s.IdleConns()))
	ch <- prometheus.MustNewConstMetric(dbPoolTotal, prometheus.GaugeValue, float64(s.TotalConns()))
	ch <- prometheus.MustNewConstMetric(dbPoolMax, prometheus.GaugeValue, float64(s.MaxConns()))
}

// RegisterPoolMetrics exposes the pgx pool's stats (FR-OBS-04's "DB pool" metric).
func RegisterPoolMetrics(pool *pgxpool.Pool) error {
	return prometheus.Register(dbPoolCollector{pool: pool})
}
