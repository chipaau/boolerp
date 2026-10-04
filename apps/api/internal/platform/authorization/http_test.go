package authorization

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func serve(t *testing.T, h http.HandlerFunc) (*httptest.ResponseRecorder, string) {
	t.Helper()
	var logs bytes.Buffer
	rec := httptest.NewRecorder()
	Enforce(slog.New(slog.NewTextHandler(&logs, nil)))(h).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	return rec, logs.String()
}

func TestEnforceRefusesARouteThatNeverAsked(t *testing.T) {
	rec, logs := serve(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "secret data")
	})
	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.NotContains(t, rec.Body.String(), "secret data", "the handler's body is discarded")
	assert.Contains(t, logs, "route answered without an authorization decision")
}

func TestEnforceRefusesASilentRoute(t *testing.T) {
	rec, _ := serve(t, func(http.ResponseWriter, *http.Request) {})
	assert.Equal(t, http.StatusInternalServerError, rec.Code, "not an empty 200")
}

func TestEnforceLetsADecidedRouteThrough(t *testing.T) {
	rec, logs := serve(t, func(w http.ResponseWriter, r *http.Request) {
		NoteDecision(r.Context())
		w.WriteHeader(http.StatusCreated)
		_, _ = io.WriteString(w, "ok")
	})
	assert.Equal(t, http.StatusCreated, rec.Code)
	assert.Equal(t, "ok", rec.Body.String())
	assert.Empty(t, logs)
}

func TestEnforceLetsARefusalThrough(t *testing.T) {
	rec, _ := serve(t, func(w http.ResponseWriter, r *http.Request) {
		NoteDecision(r.Context()) // a denied check is still a decision
		WriteError(w, r, ErrDenied)
	})
	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestNoteDecisionOutsideARequestDoesNothing(t *testing.T) {
	NoteDecision(context.Background()) // a CLI command or job: no panic
}

func TestWriteErrorMapsEachOutcome(t *testing.T) {
	for err, status := range map[error]int{
		ErrDenied:      http.StatusForbidden,
		ErrUnavailable: http.StatusServiceUnavailable,
		ErrInvalid:     http.StatusInternalServerError,
	} {
		rec := httptest.NewRecorder()
		WriteError(rec, httptest.NewRequest(http.MethodGet, "/", nil), err)
		assert.Equal(t, status, rec.Code, err.Error())
		assert.Contains(t, rec.Header().Get("Content-Type"), "application/problem+json")
	}
}
