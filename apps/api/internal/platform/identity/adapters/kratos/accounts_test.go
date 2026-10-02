package kratos

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/identity/application"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/domain"
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
		case "/admin/identities/off":
			_, _ = w.Write([]byte(`{"id":"off","schema_id":"registration","schema_url":"x","state":"inactive",
				"traits":{"email":"o@b.test"}}`))
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
	assert.True(t, a.Active)

	off, err := NewAccounts(srv.URL, srv.Client()).Get(t.Context(), "off")
	require.NoError(t, err)
	assert.False(t, off.Active, "an inactive (disabled) account")
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

func TestDeactivateSetsInactiveAndDeletesSessions(t *testing.T) {
	var calls []string
	var patch string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodPatch && r.URL.Path == "/admin/identities/k1":
			b, _ := io.ReadAll(r.Body)
			patch = string(b)
			_, _ = w.Write([]byte(`{"id":"k1","schema_id":"registration","schema_url":"x","state":"inactive","traits":{}}`))
		case r.Method == http.MethodDelete && r.URL.Path == "/admin/identities/k1/sessions":
			w.WriteHeader(http.StatusNoContent)
		case r.URL.Path == "/admin/identities/nosessions/sessions":
			w.WriteHeader(http.StatusNotFound)
		case r.Method == http.MethodPatch && r.URL.Path == "/admin/identities/nosessions":
			_, _ = w.Write([]byte(`{"id":"nosessions","schema_id":"registration","schema_url":"x","state":"inactive","traits":{}}`))
		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":{"code":404,"message":"s3cret-detail"}}`))
		}
	}))
	t.Cleanup(srv.Close)
	accounts := NewAccounts(srv.URL, srv.Client())

	require.NoError(t, accounts.Deactivate(t.Context(), "k1"))
	assert.Equal(t, []string{"PATCH /admin/identities/k1", "DELETE /admin/identities/k1/sessions"}, calls)
	assert.JSONEq(t, `[{"op":"replace","path":"/state","value":"inactive"}]`, patch)

	assert.NoError(t, accounts.Deactivate(t.Context(), "nosessions"), "no sessions is nothing to delete")
	err := accounts.Deactivate(t.Context(), "missing")
	assert.ErrorIs(t, err, application.ErrNotFound)
	assert.NotContains(t, err.Error(), "s3cret")
}

func TestFindByEmailAndCreate(t *testing.T) {
	var created map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/admin/identities":
			if r.URL.Query().Get("credentials_identifier") == "a@b.test" {
				_, _ = w.Write([]byte(`[{"id":"k1","schema_id":"registration","schema_url":"x","state":"active","traits":{"email":"a@b.test","phone":"+9607770000"}}]`))
				return
			}
			_, _ = w.Write([]byte(`[]`))
		case r.Method == http.MethodPost && r.URL.Path == "/admin/identities":
			require.NoError(t, json.NewDecoder(r.Body).Decode(&created))
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"id":"k2","schema_id":"registration","schema_url":"x","state":"active","traits":{"email":"n@b.test","phone":"+9607000001","name":"New"}}`))
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	t.Cleanup(srv.Close)
	accounts := NewAccounts(srv.URL, srv.Client())

	a, err := accounts.FindByEmail(t.Context(), "a@b.test")
	require.NoError(t, err)
	assert.Equal(t, "k1", a.KratosIdentityID)
	_, err = accounts.FindByEmail(t.Context(), "nobody@b.test")
	assert.ErrorIs(t, err, application.ErrNotFound)

	n, err := accounts.Create(t.Context(), domain.NewAccount{
		Email: "n@b.test", Phone: "+9607000001", DisplayName: "New", Password: "pw", GoogleSubject: "n@b.test",
	})
	require.NoError(t, err)
	assert.Equal(t, "k2", n.KratosIdentityID)
	assert.True(t, n.Active)
	assert.Equal(t, "registration", created["schema_id"])
	assert.Equal(t, "active", created["state"])
	assert.Equal(t, map[string]any{"email": "n@b.test", "phone": "+9607000001", "name": "New"}, created["traits"])
	addresses := created["verifiable_addresses"].([]any)
	assert.Equal(t, true, addresses[0].(map[string]any)["verified"], "the email is verified")
	credentials := created["credentials"].(map[string]any)
	assert.Contains(t, credentials, "password")
	assert.Contains(t, credentials, "oidc")
}

func TestCreateFailureHidesThePassword(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":{"code":400,"message":"s3cret-detail"}}`))
	}))
	t.Cleanup(srv.Close)
	_, err := NewAccounts(srv.URL, srv.Client()).Create(t.Context(), domain.NewAccount{Email: "n@b.test", Phone: "+9607000001", Password: "s3cret-pw"})
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "s3cret")
}
