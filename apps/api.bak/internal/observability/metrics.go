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

	// status is a label here too, not just on the counter: "p99 latency of the requests that failed"
	// is the question you ask when errors and slowness turn out to be the same incident. Cardinality
	// is already bounded by the route pattern, so this adds no meaningful growth.
	httpRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name: "http_request_duration_seconds", Help: "HTTP request latency by method, route, and status.",
	}, []string{"method", "route", "status"})
)

func init() {
	prometheus.MustRegister(httpRequestsTotal, httpRequestDuration)
}

// routePattern is the matched chi pattern, e.g. "/v1/admin/tenants/{id}/suspend" — never the raw
// path, which would mint a fresh time series per tenant id and blow up Prometheus cardinality. It's
// only populated once chi has matched, hence read after the handler rather than before.
func routePattern(r *http.Request) string {
	if rc := chi.RouteContext(r.Context()); rc != nil && rc.RoutePattern() != "" {
		return rc.RoutePattern()
	}
	return "unmatched"
}

// MetricsMiddleware records request rate/latency by method + matched route pattern.
//
// The recording is deferred so a panic still counts. Recording after next.ServeHTTP means a panicking
// handler unwinds straight past it, so the requests that matter most — the ones that blew up — were
// the only ones absent from the metrics. Recoverer turns the panic into a 500 below this middleware,
// so ww observes that status.
func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		defer func() {
			route, status := routePattern(r), strconv.Itoa(ww.Status())
			httpRequestsTotal.WithLabelValues(r.Method, route, status).Inc()
			httpRequestDuration.WithLabelValues(r.Method, route, status).Observe(time.Since(start).Seconds())
		}()
		next.ServeHTTP(ww, r)
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
