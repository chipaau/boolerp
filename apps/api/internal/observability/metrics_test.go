package observability_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/goerp/internal/observability"
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
	if !contains(body, `route="/widgets/{id}"`) {
		t.Fatalf("want exposition to label the route pattern, got:\n%s", body)
	}
	if contains(body, `/widgets/42`) {
		t.Fatalf("want the raw path (with its id) NOT to appear as a label value:\n%s", body)
	}
}

func contains(haystack, needle string) bool {
	return len(haystack) >= len(needle) && (func() bool {
		for i := 0; i+len(needle) <= len(haystack); i++ {
			if haystack[i:i+len(needle)] == needle {
				return true
			}
		}
		return false
	})()
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
		if !contains(body, name) {
			t.Fatalf("want %s in the exposition output, got:\n%s", name, body)
		}
	}
}
