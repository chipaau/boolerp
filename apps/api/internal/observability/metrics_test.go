package observability_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/internal/observability"
)

func TestMetricsMiddleware_RecordsRequestCount(t *testing.T) {
	r := chi.NewRouter()
	r.Use(observability.MetricsMiddleware)
	r.Get("/widgets/{id}", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/widgets/42", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	// The route pattern (not the raw path with its id) is what should appear in labels — verified
	// indirectly: MetricsHandler's exposition output must mention the templated pattern, not "/widgets/42".
	rec2 := httptest.NewRecorder()
	observability.MetricsHandler().ServeHTTP(rec2, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	body := rec2.Body.String()
	if !strings.Contains(body, `route="/widgets/{id}"`) {
		t.Fatalf("want exposition to label the route pattern, got:\n%s", body)
	}
	if strings.Contains(body, `/widgets/42`) {
		t.Fatalf("want the raw path (with its id) NOT to appear as a label value:\n%s", body)
	}
}

func TestRegisterPoolMetrics_ExposesDBPoolGauges(t *testing.T) {
	cfg, err := pgxpool.ParseConfig("postgres://u:p@127.0.0.1:1/db")
	if err != nil {
		t.Fatalf("parse config: %v", err)
	}
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	if err != nil {
		t.Fatalf("new pool (should not dial yet): %v", err)
	}
	defer pool.Close()

	if err := observability.RegisterPoolMetrics(pool); err != nil {
		t.Fatalf("RegisterPoolMetrics: %v", err)
	}

	rec := httptest.NewRecorder()
	observability.MetricsHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	body := rec.Body.String()
	for _, name := range []string{"db_pool_acquired_conns", "db_pool_idle_conns", "db_pool_total_conns", "db_pool_max_conns"} {
		if !strings.Contains(body, name) {
			t.Fatalf("want %s in the exposition output, got:\n%s", name, body)
		}
	}
}

// A panicking handler used to vanish from the metrics entirely: the recording ran after
// next.ServeHTTP, so the panic unwound straight past it. The requests most worth counting were the
// only ones never counted. Recoverer mounted inside turns the panic into a 500, which is what the
// wrapped writer reports.
func TestMetricsMiddleware_RecordsPanickingRequestsAs500(t *testing.T) {
	r := chi.NewRouter()
	r.Use(observability.MetricsMiddleware)
	r.Use(middleware.Recoverer)
	r.Get("/boom/{id}", func(http.ResponseWriter, *http.Request) { panic("handler exploded") })

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/boom/7", nil))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("want the panic turned into a 500, got %d", rec.Code)
	}

	exposition := httptest.NewRecorder()
	observability.MetricsHandler().ServeHTTP(exposition, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	body := exposition.Body.String()
	if !strings.Contains(body, `route="/boom/{id}"`) || !strings.Contains(body, `status="500"`) {
		t.Fatalf("want the panicking request counted as a 500, got:\n%s", body)
	}
}

// Latency is labelled by status too, so "how slow were the requests that failed?" is answerable.
func TestMetricsMiddleware_DurationCarriesTheStatusLabel(t *testing.T) {
	r := chi.NewRouter()
	r.Use(observability.MetricsMiddleware)
	r.Get("/gone/{id}", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNotFound) })

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/gone/1", nil))

	exposition := httptest.NewRecorder()
	observability.MetricsHandler().ServeHTTP(exposition, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	body := exposition.Body.String()
	if !strings.Contains(body, `http_request_duration_seconds_count{method="GET",route="/gone/{id}",status="404"}`) {
		t.Fatalf("want duration labelled by status, got:\n%s", body)
	}
}
