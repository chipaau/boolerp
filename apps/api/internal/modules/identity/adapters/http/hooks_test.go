package http

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"

	"github.com/boolmv/erp/apps/api/internal/modules/identity/application"
	"github.com/boolmv/erp/apps/api/internal/modules/identity/domain"
)

const key = "webhook-s3cret-key-0123456789abcdef"

type syncer struct {
	synced []string
	err    error
}

func (s *syncer) Sync(_ context.Context, id string) (domain.User, error) {
	s.synced = append(s.synced, id)
	return domain.User{}, s.err
}

func post(t *testing.T, s *syncer, header, body string) *httptest.ResponseRecorder {
	t.Helper()
	r := chi.NewRouter()
	NewHooks(s, key, slog.New(slog.DiscardHandler)).Routes(r)
	req := httptest.NewRequest(http.MethodPost, "/kratos", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if header != "" {
		req.Header.Set(WebhookKeyHeader, header)
	}
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

const valid = `{"identity_id":"38a62480-7b62-4d66-98ee-47fb6e5d8697"}`

func TestHookSyncsTheAccount(t *testing.T) {
	s := &syncer{}
	rec := post(t, s, key, valid)
	assert.Equal(t, http.StatusNoContent, rec.Code)
	assert.Equal(t, []string{"38a62480-7b62-4d66-98ee-47fb6e5d8697"}, s.synced)
}

func TestHookRefusesAWrongOrMissingKey(t *testing.T) {
	for _, header := range []string{"", "wrong-key", key + "x"} {
		s := &syncer{}
		assert.Equal(t, http.StatusUnauthorized, post(t, s, header, valid).Code, "key %q", header)
		assert.Empty(t, s.synced)
	}
}

func TestHookRefusesABadBody(t *testing.T) {
	s := &syncer{}
	assert.Equal(t, http.StatusUnprocessableEntity, post(t, s, key, `{"identity_id":"not-a-uuid"}`).Code)
	assert.Equal(t, http.StatusBadRequest, post(t, s, key, `nope`).Code)
	assert.Empty(t, s.synced)
}

func TestHookReportsUnknownAndFailedAccounts(t *testing.T) {
	assert.Equal(t, http.StatusNotFound, post(t, &syncer{err: application.ErrNotFound}, key, valid).Code)
	rec := post(t, &syncer{err: errors.New("s3cret-cause")}, key, valid)
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
	assert.NotContains(t, rec.Body.String(), "s3cret-cause")
}
