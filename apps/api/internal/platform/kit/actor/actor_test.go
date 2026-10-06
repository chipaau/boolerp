package actor

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/requestid"
)

func TestWithAndFrom(t *testing.T) {
	assert.Equal(t, Actor{}, From(context.Background()), "none: the zero actor")
	a := Actor{UserID: "u", Operation: "seed: x"}
	assert.Equal(t, a, From(With(context.Background(), a)))
}

// recorder is a transaction that keeps what it was asked to run.
type recorder struct {
	args []any
	err  error
}

func (r *recorder) Exec(_ context.Context, _ string, args ...any) (pgconn.CommandTag, error) {
	r.args = args
	return pgconn.CommandTag{}, r.err
}

func TestApplySetsEveryField(t *testing.T) {
	var tx recorder
	ctx := With(context.Background(), Actor{UserID: "u", ClientID: "c", Operation: "op", RequestID: "r", IP: "203.0.113.7"})
	require.NoError(t, apply(ctx, &tx, "t"))
	assert.Equal(t, []any{"u", "c", "t", "op", "r", "203.0.113.7"}, tx.args)

	require.NoError(t, apply(context.Background(), &tx, ""))
	assert.Equal(t, []any{"", "", "", "", "", ""}, tx.args, "no actor: every setting cleared")

	tx.err = errors.New("connection lost")
	assert.Error(t, apply(ctx, &tx, ""))
}

func TestMiddlewareRecordsTheRequest(t *testing.T) {
	var got Actor
	r := chi.NewRouter()
	r.Use(middleware.ClientIPFromRemoteAddr, requestid.Middleware)
	r.Route("/api/v1/things", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(Middleware(func(*http.Request) (string, string) { return "u-1", "bff-workspace" }))
			r.Patch("/{id}", func(_ http.ResponseWriter, r *http.Request) { got = From(r.Context()) })
		})
	})
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/things/42", nil)
	req.RemoteAddr = "203.0.113.7:5000"
	r.ServeHTTP(httptest.NewRecorder(), req)

	assert.Equal(t, "u-1", got.UserID)
	assert.Equal(t, "bff-workspace", got.ClientID)
	assert.Equal(t, "PATCH /api/v1/things/{id}", got.Operation, "the route pattern, never the raw path")
	assert.NotEmpty(t, got.RequestID)
	assert.Equal(t, "203.0.113.7", got.IP)
}

func TestMiddlewareOutsideARouter(t *testing.T) {
	var got Actor
	h := Middleware(func(*http.Request) (string, string) { return "", "" })(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		got = From(r.Context())
	}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/x", nil))
	assert.Equal(t, "GET", got.Operation)
}
