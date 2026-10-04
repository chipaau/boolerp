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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/identity"
)

// allowOwn stands in for Cerbos with the identity policies' rule: a caller may
// view only their own user (or, as a client, itself). It notes every decision,
// as an Authorizer must, so Enforce lets the response through.
type allowOwn struct{}

func (allowOwn) Check(ctx context.Context, action string, r authorization.Resource, _ ...authorization.Fact) error {
	authorization.NoteDecision(ctx)
	caller, _ := FromContext(ctx)
	switch {
	case action != "view":
	case r.Kind == "identity:user" && caller.User != nil && r.ID == caller.User.ID:
		return nil
	case r.Kind == "identity:client" && caller.User == nil && r.ID == caller.Token.ClientID:
		return nil
	}
	return authorization.ErrDenied
}

func (allowOwn) Can(ctx context.Context, _, _ string, _ ...authorization.Fact) error {
	authorization.NoteDecision(ctx)
	return authorization.ErrDenied
}

// failWith answers every check with err.
type failWith struct{ err error }

func (f failWith) Check(ctx context.Context, _ string, _ authorization.Resource, _ ...authorization.Fact) error {
	authorization.NoteDecision(ctx)
	return f.err
}

func (f failWith) Can(ctx context.Context, _, _ string, _ ...authorization.Fact) error {
	authorization.NoteDecision(ctx)
	return f.err
}

// recordingAuthz remembers what was asked and allows it.
type recordingAuthz struct{ asked []authorization.Resource }

func (r *recordingAuthz) Check(ctx context.Context, _ string, res authorization.Resource, _ ...authorization.Fact) error {
	authorization.NoteDecision(ctx)
	r.asked = append(r.asked, res)
	return nil
}

func (r *recordingAuthz) Can(ctx context.Context, _, _ string, _ ...authorization.Fact) error {
	authorization.NoteDecision(ctx)
	return nil
}

func getMe(t *testing.T, iss *issuer, authz authorization.Authorizer, c claims) *httptest.ResponseRecorder {
	t.Helper()
	m := New(t.Context(), Settings{Issuer: iss.url(), Audience: "erp-api"}, iss.Client(), usersFunc(knownUser), authz, slog.New(slog.DiscardHandler))
	r := chi.NewRouter()
	r.Route("/api/auth", m.Routes)
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+sign(t, c))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func TestMeAsksAboutTheCallersOwnUser(t *testing.T) {
	iss := newIssuer(t)
	authz := &recordingAuthz{}
	rec := getMe(t, iss, authz, iss.valid())
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, []authorization.Resource{{Kind: "identity:user", ID: "user-1"}}, authz.asked)
}

func TestMeRefusesWithoutTheData(t *testing.T) {
	iss := newIssuer(t)
	for name, c := range map[string]struct {
		err    error
		status int
	}{
		"denied":      {authorization.ErrDenied, http.StatusForbidden},
		"unavailable": {authorization.ErrUnavailable, http.StatusServiceUnavailable},
		"invalid":     {authorization.ErrInvalid, http.StatusInternalServerError},
	} {
		t.Run(name, func(t *testing.T) {
			rec := getMe(t, iss, failWith{c.err}, iss.valid())
			assert.Equal(t, c.status, rec.Code)
			assert.NotContains(t, rec.Body.String(), "a@b.test", "no personal data in a refusal")
			var body map[string]any
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
			assert.Contains(t, rec.Header().Get("Content-Type"), "application/problem+json")
		})
	}
}

// registering is a Users whose Register answers with err (or user).
type registering struct {
	user identity.User
	err  error
}

func (registering) User(context.Context, string) (identity.User, error) {
	return identity.User{}, identity.ErrNotFound
}

func (r registering) Register(context.Context, string, string) (identity.User, error) {
	return r.user, r.err
}

func postMe(t *testing.T, iss *issuer, users Users, authz authorization.Authorizer, c claims) *httptest.ResponseRecorder {
	t.Helper()
	m := New(t.Context(), Settings{Issuer: iss.url(), Audience: "erp-api"}, iss.Client(), users, authz, slog.New(slog.DiscardHandler))
	r := chi.NewRouter()
	r.Route("/api/auth", m.Routes)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+sign(t, c))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func TestRegisterAnswersEachFailure(t *testing.T) {
	iss := newIssuer(t)
	for name, c := range map[string]struct {
		err    error
		status int
	}{
		"missing scopes":         {identity.ErrInvalidAccount, http.StatusForbidden},
		"token refused":          {identity.ErrTokenRefused, http.StatusUnauthorized},
		"another account":        {identity.ErrWrongAccount, http.StatusUnauthorized},
		"database or Hydra down": {errors.New("s3cret-cause"), http.StatusServiceUnavailable},
	} {
		t.Run(name, func(t *testing.T) {
			rec := postMe(t, iss, registering{err: c.err}, &recordingAuthz{}, iss.valid())
			assert.Equal(t, c.status, rec.Code)
			assert.NotContains(t, rec.Body.String(), "s3cret-cause")
		})
	}
}

func TestRegisterAnswersWithTheUser(t *testing.T) {
	iss := newIssuer(t)
	authz := &recordingAuthz{}
	rec := postMe(t, iss, registering{user: identity.User{ID: "user-1", Email: "a@b.test"}}, authz, iss.valid())
	require.Equal(t, http.StatusOK, rec.Code)
	var body struct{ User struct{ ID string } }
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, "user-1", body.User.ID)
	assert.Equal(t, []authorization.Resource{{Kind: "identity:account", ID: "account-1"}}, authz.asked)
}

func TestRegisterAsAClientIsAskedAboutTheClient(t *testing.T) {
	iss := newIssuer(t)
	authz := failWith{authorization.ErrDenied}
	c := iss.valid()
	c.clientID = "account-1" // a client acting for itself
	rec := postMe(t, iss, registering{err: errors.New("must not register")}, authz, c)
	assert.Equal(t, http.StatusForbidden, rec.Code)
}
