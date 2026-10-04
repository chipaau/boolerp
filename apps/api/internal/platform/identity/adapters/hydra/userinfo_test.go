package hydra

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/identity/application"
)

// userinfo answers like Hydra's public /userinfo: the claims for "good", 401 for
// "revoked", and a 500 for anything else.
func userinfo(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path != "/userinfo":
			w.WriteHeader(http.StatusNotFound)
		case r.Header.Get("Authorization") == "Bearer good":
			_, _ = w.Write([]byte(`{"sub":"k1","email":"a@b.test","email_verified":true,"phone_number":"+9607770000",
				"name":"Aisha","picture":"https://example.test/a.png","amr":["pwd"]}`))
		case r.Header.Get("Authorization") == "Bearer revoked":
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"request_unauthorized"}`))
		default:
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"error":"s3cret-detail"}`))
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestAccountMapsTheClaims(t *testing.T) {
	srv := userinfo(t)
	a, err := NewProfiles(srv.URL+"/", srv.Client()).Account(t.Context(), "good")
	require.NoError(t, err)
	assert.Equal(t, "k1", a.KratosIdentityID)
	assert.Equal(t, "a@b.test", a.Email)
	assert.Equal(t, "+9607770000", a.Phone)
	assert.Equal(t, "Aisha", a.DisplayName)
	assert.Equal(t, "https://example.test/a.png", a.AvatarURL)
	assert.True(t, a.Active)
}

func TestAccountReportsARefusedToken(t *testing.T) {
	srv := userinfo(t)
	_, err := NewProfiles(srv.URL, srv.Client()).Account(t.Context(), "revoked")
	assert.ErrorIs(t, err, application.ErrTokenRefused)
}

func TestAccountHidesHydrasError(t *testing.T) {
	srv := userinfo(t)
	_, err := NewProfiles(srv.URL, srv.Client()).Account(t.Context(), "other")
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "s3cret-detail")
	assert.NotErrorIs(t, err, application.ErrTokenRefused)
}
