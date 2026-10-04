//go:build feature

package auth

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Endpoint tests (docs/testing.md): the real router, middleware, identity module,
// and PostgreSQL (the test's rolled-back transaction, as the runtime role);
// authentication, authorization, and Hydra are faked. Each test asserts what the
// request left in the database.

const (
	newPerson  = "0192f6a0-0000-7000-8000-00000000f001" // a Kratos account with no user yet
	sentClient = "hrms-sync"
	picture    = "https://lh3.googleusercontent.com/a/aisha"
)

// fakeTokens is authentication faked, like Laravel's actingAs: a known bearer
// string stands for a verified token.
type fakeTokens map[string]Token

func (f fakeTokens) Verify(_ context.Context, raw string) (Token, error) {
	if t, ok := f[raw]; ok {
		return t, nil
	}
	return Token{}, errors.New("invalid token")
}

var tokens = fakeTokens{
	"person":          {Subject: newPerson, ClientID: "bff-workspace"},
	"person-no-phone": {Subject: newPerson, ClientID: "bff-workspace"}, // granted no phone scope
	"revoked":         {Subject: newPerson, ClientID: "bff-workspace"}, // Hydra no longer accepts it
	"client":          {ClientID: sentClient},
}

// fakeHydra answers Hydra's public /userinfo for the person's tokens; phone is
// what it says the phone is, and calls counts the requests.
type fakeHydra struct {
	*httptest.Server
	phone string
	calls int
}

func newFakeHydra(t *testing.T) *fakeHydra {
	t.Helper()
	h := &fakeHydra{phone: "+9607770000"}
	h.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.calls++
		w.Header().Set("Content-Type", "application/json")
		claims := map[string]any{"sub": newPerson, "email": "aisha@example.test", "email_verified": true, "name": "Aisha", "picture": picture}
		switch {
		case r.URL.Path != "/userinfo":
			w.WriteHeader(http.StatusNotFound)
			return
		case r.Header.Get("Authorization") == "Bearer person":
			claims["phone_number"] = h.phone
		case r.Header.Get("Authorization") == "Bearer person-no-phone":
		default:
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"request_unauthorized"}`))
			return
		}
		_ = json.NewEncoder(w).Encode(claims)
	}))
	t.Cleanup(h.Close)
	return h
}

// endpoint is the auth module mounted as the edition mounts it, over tx.
func endpoint(t *testing.T, tx pgx.Tx, authz authorization.Authorizer, hydra *fakeHydra) http.Handler {
	t.Helper()
	users := identity.New(tx, identity.Settings{
		KratosAdminURL: "http://127.0.0.1:1", HydraAdminURL: "http://127.0.0.1:1", HydraPublicURL: hydra.URL + "/",
	}, hydra.Client(), slog.New(slog.DiscardHandler))
	m := New(t.Context(), Settings{Issuer: "http://127.0.0.1:1/", Audience: "erp-api"}, http.DefaultClient,
		users, authz, slog.New(slog.DiscardHandler))
	m.verifier = tokens
	r := chi.NewRouter()
	r.Route("/api/auth", m.Routes)
	return r
}

func callMe(t *testing.T, h http.Handler, method, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, "/api/auth/me", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

type meBody struct {
	User struct {
		ID, Email, Phone, DisplayName, AvatarURL string
	}
	ClientID string
}

func TestFeatureGetMeNeverCreatesAUser(t *testing.T) {
	tx := testdb.Tx(t)
	hydra := newFakeHydra(t)
	rec := callMe(t, endpoint(t, tx, &recordingAuthz{}, hydra), http.MethodGet, "person")

	assert.Equal(t, http.StatusUnauthorized, rec.Code, "the person has not registered")
	assert.Contains(t, rec.Body.String(), "POST /api/auth/me")
	testdb.AssertMissing(t, tx, "users", map[string]any{"kratos_identity_id": newPerson})
	assert.Zero(t, hydra.calls, "a GET asks no one")
}

func TestFeatureRegisterCreatesThenUpdatesTheUser(t *testing.T) {
	tx := testdb.Tx(t)
	authz := &recordingAuthz{}
	hydra := newFakeHydra(t)
	h := endpoint(t, tx, authz, hydra)

	rec := callMe(t, h, http.MethodPost, "person")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var body meBody
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, "aisha@example.test", body.User.Email)
	assert.Equal(t, picture, body.User.AvatarURL)
	assert.Equal(t, "bff-workspace", body.ClientID)
	testdb.AssertHas(t, tx, "users", map[string]any{
		"id": body.User.ID, "kratos_identity_id": newPerson, "email": "aisha@example.test",
		"phone": "+9607770000", "display_name": "Aisha", "avatar_url": picture,
	})
	assert.Equal(t, []authorization.Resource{{Kind: "identity:account", ID: newPerson}}, authz.asked,
		"Cerbos is asked about the caller's own account")

	// Registering again refreshes the same user from /userinfo.
	hydra.phone = "+9607771111"
	require.Equal(t, http.StatusOK, callMe(t, h, http.MethodPost, "person").Code)
	assert.Equal(t, 1, testdb.Count(t, tx, "users", map[string]any{"kratos_identity_id": newPerson}))
	testdb.AssertHas(t, tx, "users", map[string]any{"id": body.User.ID, "phone": "+9607771111"})

	// Now GET answers, as the registered user, and changes nothing.
	calls := hydra.calls
	rec = callMe(t, h, http.MethodGet, "person")
	require.Equal(t, http.StatusOK, rec.Code)
	var got meBody
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, body.User.ID, got.User.ID)
	assert.Equal(t, calls, hydra.calls, "a GET does not ask Hydra")
}

func TestFeatureRegisterNeedsTheEmailAndPhoneScopes(t *testing.T) {
	tx := testdb.Tx(t)
	rec := callMe(t, endpoint(t, tx, &recordingAuthz{}, newFakeHydra(t)), http.MethodPost, "person-no-phone")

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Contains(t, rec.Header().Get("WWW-Authenticate"), `error="insufficient_scope"`)
	testdb.AssertMissing(t, tx, "users", map[string]any{"kratos_identity_id": newPerson})
}

func TestFeatureRegisterWithATokenHydraRefusesWritesNothing(t *testing.T) {
	tx := testdb.Tx(t)
	rec := callMe(t, endpoint(t, tx, &recordingAuthz{}, newFakeHydra(t)), http.MethodPost, "revoked")

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Equal(t, `Bearer error="invalid_token"`, rec.Header().Get("WWW-Authenticate"))
	testdb.AssertMissing(t, tx, "users", map[string]any{"kratos_identity_id": newPerson})
}

func TestFeatureRegisterRefusedByCerbosWritesNothing(t *testing.T) {
	tx := testdb.Tx(t)
	hydra := newFakeHydra(t)
	rec := callMe(t, endpoint(t, tx, failWith{authorization.ErrDenied}, hydra), http.MethodPost, "person")

	assert.Equal(t, http.StatusForbidden, rec.Code)
	testdb.AssertMissing(t, tx, "users", map[string]any{"kratos_identity_id": newPerson})
	assert.Zero(t, hydra.calls, "Cerbos decides before Hydra is asked")
}

func TestFeatureMeForAClientWritesNothing(t *testing.T) {
	tx := testdb.Tx(t)
	authz := &recordingAuthz{}
	before := testdb.Count(t, tx, "users", nil)

	rec := callMe(t, endpoint(t, tx, authz, newFakeHydra(t)), http.MethodGet, "client")
	require.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"user":null,"clientId":"hrms-sync"}`, rec.Body.String())
	assert.Equal(t, []authorization.Resource{{Kind: "identity:client", ID: sentClient}}, authz.asked)
	assert.Equal(t, before, testdb.Count(t, tx, "users", nil), "no user for a machine client")
}

func TestFeatureMeWithoutAValidTokenWritesNothing(t *testing.T) {
	tx := testdb.Tx(t)
	hydra := newFakeHydra(t)
	for _, method := range []string{http.MethodGet, http.MethodPost} {
		for _, token := range []string{"", "forged"} {
			rec := callMe(t, endpoint(t, tx, &recordingAuthz{}, hydra), method, token)
			assert.Equal(t, http.StatusUnauthorized, rec.Code, "%s with token %q", method, token)
		}
	}
	testdb.AssertMissing(t, tx, "users", map[string]any{"kratos_identity_id": newPerson})
	assert.Zero(t, hydra.calls)
}
