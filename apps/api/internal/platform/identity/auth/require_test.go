package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
)

func TestRequireUserLetsOnlyAPersonThrough(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	for name, c := range map[string]struct {
		caller *Caller
		want   int
	}{
		"a person":                   {&Caller{Token: Token{Subject: "s", ClientID: "bff-workspace"}, User: &identity.User{ID: "u"}}, http.StatusNoContent},
		"a client acting for itself": {&Caller{Token: Token{ClientID: "hrms-sync"}}, http.StatusForbidden},
		"no caller at all":           {nil, http.StatusForbidden},
	} {
		t.Run(name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			if c.caller != nil {
				r = r.WithContext(NewContext(r.Context(), *c.caller))
			}
			rec := httptest.NewRecorder()
			RequireUser(ok).ServeHTTP(rec, r)
			assert.Equal(t, c.want, rec.Code)
		})
	}
}

func TestActorRecordsTheCaller(t *testing.T) {
	var got actor.Actor
	h := Actor(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { got = actor.From(r.Context()) }))

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r = r.WithContext(NewContext(r.Context(), Caller{Token: Token{Subject: "s", ClientID: "bff-workspace"}, User: &identity.User{ID: "u-1"}}))
	h.ServeHTTP(httptest.NewRecorder(), r)
	assert.Equal(t, "u-1", got.UserID)
	assert.Equal(t, "bff-workspace", got.ClientID)

	r = httptest.NewRequest(http.MethodGet, "/", nil)
	r = r.WithContext(NewContext(r.Context(), Caller{Token: Token{ClientID: "hrms-sync"}}))
	h.ServeHTTP(httptest.NewRecorder(), r)
	assert.Empty(t, got.UserID, "a client acting for itself has no user")
	assert.Equal(t, "hrms-sync", got.ClientID)

	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, actor.Actor{Operation: "GET"}, got, "no caller: nobody")
}
