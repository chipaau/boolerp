package problem

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/requestid"
)

func TestErrorWritesProblemDetails(t *testing.T) {
	var id string
	rec := httptest.NewRecorder()
	requestid.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id = requestid.FromContext(r.Context())
		Error(w, r, http.StatusNotFound, "No route matches this path.")
	})).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))

	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.Equal(t, ContentType, rec.Header().Get("Content-Type"))

	var got Details
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, Details{
		Type:     "about:blank",
		Title:    "Not Found",
		Status:   http.StatusNotFound,
		Detail:   "No route matches this path.",
		Instance: "urn:uuid:" + id,
	}, got)
}

func TestErrorOmitsEmptyMembers(t *testing.T) {
	rec := httptest.NewRecorder()
	// No request ID middleware and no detail: both members are omitted.
	Error(rec, httptest.NewRequest(http.MethodGet, "/", nil), http.StatusInternalServerError, "")

	var got map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.NotContains(t, got, "detail")
	assert.NotContains(t, got, "instance")
	assert.Equal(t, "Internal Server Error", got["title"])
	assert.EqualValues(t, 500, got["status"])
}

func TestWriteKeepsExistingHeaders(t *testing.T) {
	rec := httptest.NewRecorder()
	rec.Header().Set("Allow", "GET, HEAD")
	Error(rec, httptest.NewRequest(http.MethodPost, "/", nil), http.StatusMethodNotAllowed, "")

	assert.Equal(t, "GET, HEAD", rec.Header().Get("Allow"))
}
