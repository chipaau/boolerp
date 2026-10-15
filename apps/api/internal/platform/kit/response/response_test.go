package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
)

func get() *http.Request { return httptest.NewRequest(http.MethodGet, "/", nil) }

func TestOKAnswersJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	OK(rec, get(), map[string]string{"id": "t1"})
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))
	assert.JSONEq(t, `{"id": "t1"}`, rec.Body.String())
}

func TestCreatedCarriesItsLocation(t *testing.T) {
	rec := httptest.NewRecorder()
	Created(rec, httptest.NewRequest(http.MethodPost, "/api/v1/tenants", nil), "/api/v1/tenants/t1", map[string]string{"id": "t1"})
	assert.Equal(t, http.StatusCreated, rec.Code)
	assert.Equal(t, "/api/v1/tenants/t1", rec.Header().Get("Location"))
	assert.JSONEq(t, `{"id": "t1"}`, rec.Body.String())
}

func TestNoContentHasNoBody(t *testing.T) {
	rec := httptest.NewRecorder()
	NoContent(rec, httptest.NewRequest(http.MethodDelete, "/", nil))
	assert.Equal(t, http.StatusNoContent, rec.Code)
	assert.Empty(t, rec.Body.String())
}

func TestPageAnswersTheEnvelope(t *testing.T) {
	rec := httptest.NewRecorder()
	Page(rec, get(), request.List{Page: 2, PageSize: 10}, []string{"a", "b"}, 12)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))
	assert.JSONEq(t, `{"items": ["a", "b"], "page": 2, "pageSize": 10, "total": 12}`, rec.Body.String())
}

func TestPageAnswersNoItemsAsAnEmptyArray(t *testing.T) {
	rec := httptest.NewRecorder()
	Page[string](rec, get(), request.List{Page: 3, PageSize: 10}, nil, 12)
	assert.JSONEq(t, `{"items": [], "page": 3, "pageSize": 10, "total": 12}`, rec.Body.String())

	var p Paged[string]
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &p))
	assert.Equal(t, Paged[string]{Items: []string{}, Page: 3, PageSize: 10, Total: 12}, p)
}
