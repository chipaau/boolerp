package authorization

import (
	"errors"
	"log/slog"
	"net/http"
	"sync"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
)

// WriteError answers a request whose check did not allow, never with the data:
// 403 when denied, 503 when Cerbos could not be asked, and 500 (logged as an error
// with Cerbos's reason, which names attributes, never their values) when our
// request was invalid.
func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrDenied):
		problem.Error(w, r, http.StatusForbidden, "You are not allowed to do this.")
	case errors.Is(err, ErrUnavailable):
		slog.WarnContext(r.Context(), "authorization unavailable", "error", err)
		problem.Error(w, r, http.StatusServiceUnavailable, "Permissions could not be checked. Try again shortly.")
	default:
		slog.ErrorContext(r.Context(), "authorization request invalid", "error", err)
		problem.Error(w, r, http.StatusInternalServerError, "The request could not be completed.")
	}
}

// Enforce is the record-or-deny backstop (C155): a route behind it must ask for at
// least one authorization decision (Check or Can, allowed or not) before it answers.
// If it answers without one, the response is replaced with a 500 and the omission is
// logged, so a forgotten check fails closed instead of exposing data.
func Enforce(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, d := withDecisions(r.Context())
			gw := &guardedWriter{ResponseWriter: w, r: r, d: d, logger: logger}
			next.ServeHTTP(gw, r.WithContext(ctx))
			gw.finish()
		})
	}
}

// guardedWriter holds back a response until it knows a decision was made: on the
// first write it either lets the handler's response through or replaces it.
type guardedWriter struct {
	http.ResponseWriter
	r       *http.Request
	d       *decisions
	logger  *slog.Logger
	once    sync.Once
	refused bool
}

func (g *guardedWriter) decide() {
	g.once.Do(func() {
		if g.d.n.Load() > 0 {
			return
		}
		g.refused = true
		g.logger.ErrorContext(g.r.Context(), "route answered without an authorization decision",
			"method", g.r.Method, "path", g.r.URL.Path)
		problem.Error(g.ResponseWriter, g.r, http.StatusInternalServerError, "The request could not be completed.")
	})
}

func (g *guardedWriter) WriteHeader(code int) {
	g.decide()
	if !g.refused {
		g.ResponseWriter.WriteHeader(code)
	}
}

func (g *guardedWriter) Write(b []byte) (int, error) {
	g.decide()
	if g.refused {
		return len(b), nil // the handler's body is discarded
	}
	return g.ResponseWriter.Write(b)
}

// finish covers a handler that wrote nothing at all, which net/http would answer
// with an empty 200.
func (g *guardedWriter) finish() { g.decide() }

// Unwrap lets http.ResponseController reach the underlying writer.
func (g *guardedWriter) Unwrap() http.ResponseWriter { return g.ResponseWriter }
