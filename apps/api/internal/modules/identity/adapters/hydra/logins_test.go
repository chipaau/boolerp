package hydra

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// hydraAdmin answers like Hydra's admin API: two pages of consent sessions
// (three logins, one repeated), and 204 for revocations. nextLink, when set,
// replaces the first page's Link header.
func hydraAdmin(t *testing.T, calls *[]string, fail *bool, nextLink ...string) *httptest.Server {
	t.Helper()
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*calls = append(*calls, r.Method+" "+r.URL.Path+"?"+r.URL.RawQuery)
		if *fail {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"error":"s3cret-detail"}`))
			return
		}
		if r.Method == http.MethodGet {
			w.Header().Set("Content-Type", "application/json")
			if r.URL.Query().Get("page_token") == "" {
				header := `<` + srv.URL + `/admin/oauth2/auth/sessions/consent?page_size=500&page_token=p2>; rel="next"`
				if len(nextLink) > 0 {
					header = nextLink[0]
				}
				w.Header().Set("Link", header)
				_, _ = w.Write([]byte(`[{"consent_request":{"challenge":"c1","login_session_id":"sid-1"}},
					{"consent_request":{"challenge":"c2","login_session_id":"sid-2"}}]`))
				return
			}
			_, _ = w.Write([]byte(`[{"consent_request":{"challenge":"c3","login_session_id":"sid-2"}},
				{"consent_request":{"challenge":"c4","login_session_id":"sid-3"}}]`))
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestRevokeAllEndsEachLoginByIDThenEverything(t *testing.T) {
	var calls []string
	fail := false
	srv := hydraAdmin(t, &calls, &fail)

	require.NoError(t, NewLogins(srv.URL, srv.Client(), slog.New(slog.DiscardHandler)).RevokeAll(t.Context(), "k1"))
	assert.Equal(t, []string{
		"GET /admin/oauth2/auth/sessions/consent?page_size=500&subject=k1",
		"GET /admin/oauth2/auth/sessions/consent?page_size=500&page_token=p2&subject=k1",
		// By ID, so Hydra sends back-channel logout for each login.
		"DELETE /admin/oauth2/auth/sessions/login?sid=sid-1",
		"DELETE /admin/oauth2/auth/sessions/login?sid=sid-2",
		"DELETE /admin/oauth2/auth/sessions/login?sid=sid-3",
		"DELETE /admin/oauth2/auth/sessions/login?subject=k1",
		"DELETE /admin/oauth2/auth/sessions/consent?all=true&subject=k1",
	}, calls)
}

func TestRevokeAllFailsWithoutLeakingHydrasAnswer(t *testing.T) {
	var calls []string
	fail := true
	srv := hydraAdmin(t, &calls, &fail)
	err := NewLogins(srv.URL, srv.Client(), slog.New(slog.DiscardHandler)).RevokeAll(t.Context(), "k1")
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "s3cret")
}

func TestAnUnfollowableNextPageIsLoggedAndTheRestStillRevoked(t *testing.T) {
	var calls []string
	fail := false
	srv := hydraAdmin(t, &calls, &fail, `</admin/oauth2/auth/sessions/consent?page_size=500>; rel="next"`)
	var logs bytes.Buffer
	logins := NewLogins(srv.URL, srv.Client(), slog.New(slog.NewTextHandler(&logs, nil)))

	require.NoError(t, logins.RevokeAll(t.Context(), "k1"))
	assert.Contains(t, logs.String(), "could not be followed")
	assert.Equal(t, []string{
		"GET /admin/oauth2/auth/sessions/consent?page_size=500&subject=k1",
		"DELETE /admin/oauth2/auth/sessions/login?sid=sid-1",
		"DELETE /admin/oauth2/auth/sessions/login?sid=sid-2",
		"DELETE /admin/oauth2/auth/sessions/login?subject=k1",
		"DELETE /admin/oauth2/auth/sessions/consent?all=true&subject=k1",
	}, calls, "the first page's logins by ID, then everything by subject")
}

func TestARelativeNextLinkIsFollowed(t *testing.T) {
	var calls []string
	fail := false
	srv := hydraAdmin(t, &calls, &fail, `</admin/oauth2/auth/sessions/consent?page_size=500&page_token=p2>; rel="next"`)
	require.NoError(t, NewLogins(srv.URL, srv.Client(), slog.New(slog.DiscardHandler)).RevokeAll(t.Context(), "k1"))
	assert.Contains(t, calls, "DELETE /admin/oauth2/auth/sessions/login?sid=sid-3")
}
