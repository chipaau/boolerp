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
// authentication, authorization, and Kratos are faked. Each test asserts what the
// request left in the database.

const (
	newPerson  = "0192f6a0-0000-7000-8000-00000000f001" // a Kratos account with no user yet
	sentClient = "hrms-sync"
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
	"person": {Subject: newPerson, ClientID: "bff-workspace"},
	"client": {ClientID: sentClient},
}

// fakeKratos answers Kratos's admin API for one active account.
func fakeKratos(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path != "/admin/identities/"+newPerson {
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":{"code":404,"message":"not found"}}`))
			return
		}
		_, _ = w.Write([]byte(`{"id":"` + newPerson + `","schema_id":"registration","schema_url":"x","state":"active",
			"traits":{"email":"aisha@example.test","phone":"+9607770000","name":"Aisha","picture":"https://lh3.googleusercontent.com/a/aisha"}}`))
	}))
	t.Cleanup(srv.Close)
	return srv
}

// endpoint is the auth module mounted as the edition mounts it, over tx.
func endpoint(t *testing.T, tx pgx.Tx, authz authorization.Authorizer) http.Handler {
	t.Helper()
	kratos := fakeKratos(t)
	users := identity.New(tx, identity.Settings{KratosAdminURL: kratos.URL, HydraAdminURL: kratos.URL},
		kratos.Client(), slog.New(slog.DiscardHandler))
	m := New(t.Context(), Settings{Issuer: "http://127.0.0.1:1/", Audience: "erp-api"}, http.DefaultClient,
		users, authz, slog.New(slog.DiscardHandler))
	m.verifier = tokens
	r := chi.NewRouter()
	r.Route("/api/auth", m.Routes)
	return r
}

func get(t *testing.T, h http.Handler, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestFeatureMeCreatesAPersonsUserOnFirstUseOnly(t *testing.T) {
	tx := testdb.Tx(t)
	authz := &recordingAuthz{}
	h := endpoint(t, tx, authz)
	testdb.AssertMissing(t, tx, "users", map[string]any{"kratos_identity_id": newPerson})

	rec := get(t, h, "person")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var body struct {
		User struct {
			ID, Email, Phone, DisplayName, AvatarURL string
		}
		ClientID string
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, "aisha@example.test", body.User.Email)
	assert.Equal(t, "https://lh3.googleusercontent.com/a/aisha", body.User.AvatarURL)
	assert.Equal(t, "bff-workspace", body.ClientID)

	// The user row was stored from the Kratos account, with the ID /me returned.
	testdb.AssertHas(t, tx, "users", map[string]any{
		"id": body.User.ID, "kratos_identity_id": newPerson,
		"email": "aisha@example.test", "phone": "+9607770000", "display_name": "Aisha",
		"avatar_url": "https://lh3.googleusercontent.com/a/aisha",
	})
	assert.Equal(t, []authorization.Resource{{Kind: "identity:user", ID: body.User.ID}}, authz.asked,
		"Cerbos is asked about the caller's own user")

	require.Equal(t, http.StatusOK, get(t, h, "person").Code)
	assert.Equal(t, 1, testdb.Count(t, tx, "users", map[string]any{"kratos_identity_id": newPerson}),
		"a second request reuses the user")
}

func TestFeatureMeForAClientWritesNothing(t *testing.T) {
	tx := testdb.Tx(t)
	authz := &recordingAuthz{}
	before := testdb.Count(t, tx, "users", nil)

	rec := get(t, endpoint(t, tx, authz), "client")
	require.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"user":null,"clientId":"hrms-sync"}`, rec.Body.String())
	assert.Equal(t, []authorization.Resource{{Kind: "identity:client", ID: sentClient}}, authz.asked)
	assert.Equal(t, before, testdb.Count(t, tx, "users", nil), "no user for a machine client")
}

func TestFeatureMeRefusedLeavesOnlyTheUser(t *testing.T) {
	tx := testdb.Tx(t)
	rec := get(t, endpoint(t, tx, failWith{authorization.ErrDenied}), "person")
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.NotContains(t, rec.Body.String(), "aisha@example.test", "a refusal carries no personal data")
	// Authentication ran first and created the user; only the answer was refused.
	testdb.AssertHas(t, tx, "users", map[string]any{"kratos_identity_id": newPerson})
}

func TestFeatureMeWithoutAValidTokenWritesNothing(t *testing.T) {
	tx := testdb.Tx(t)
	for _, token := range []string{"", "forged"} {
		rec := get(t, endpoint(t, tx, &recordingAuthz{}), token)
		assert.Equal(t, http.StatusUnauthorized, rec.Code, "token %q", token)
	}
	testdb.AssertMissing(t, tx, "users", map[string]any{"kratos_identity_id": newPerson})
}
