package kratos

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/modules/identity/application"
)

// kratosAdmin answers GET /admin/identities/{id} like Kratos's admin API.
func kratosAdmin(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/admin/identities/k1":
			_, _ = w.Write([]byte(`{"id":"k1","schema_id":"registration","schema_url":"x","state":"active",
				"traits":{"email":"a@b.test","phone":"+9607770000","name":"Aisha"}}`))
		case "/admin/identities/missing":
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":{"code":404,"message":"s3cret-detail"}}`))
		default:
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"error":{"code":500,"message":"s3cret-detail"}}`))
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestGetMapsTheAccount(t *testing.T) {
	srv := kratosAdmin(t)
	a, err := NewAccounts(srv.URL, srv.Client()).Get(t.Context(), "k1")
	require.NoError(t, err)
	assert.Equal(t, "k1", a.KratosIdentityID)
	assert.Equal(t, "a@b.test", a.Email)
	assert.Equal(t, "+9607770000", a.Phone)
	assert.Equal(t, "Aisha", a.DisplayName)
}

func TestGetUnknownAccount(t *testing.T) {
	srv := kratosAdmin(t)
	_, err := NewAccounts(srv.URL, srv.Client()).Get(t.Context(), "missing")
	assert.ErrorIs(t, err, application.ErrNotFound)
}

func TestGetFailureHidesKratosDetail(t *testing.T) {
	srv := kratosAdmin(t)
	_, err := NewAccounts(srv.URL, srv.Client()).Get(t.Context(), "broken")
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "s3cret-detail")
}
