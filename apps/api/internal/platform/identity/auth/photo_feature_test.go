//go:build feature

package auth

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization/authztest"
	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

const portraits = "http://identity.bool.test/portraits/"

// fakeKratos answers the admin API for the person's account, applying the JSON
// Patches it is sent to the picture trait; patches counts them.
type fakeKratos struct {
	*httptest.Server
	mu      sync.Mutex
	picture string
	patches int
}

func newFakeKratos(t *testing.T) *fakeKratos {
	t.Helper()
	k := &fakeKratos{picture: picture}
	k.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		k.mu.Lock()
		defer k.mu.Unlock()
		if r.URL.Path != "/admin/identities/"+newPerson {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if r.Method == http.MethodPatch {
			k.patches++
			var ops []struct{ Op, Path, Value string }
			b, _ := io.ReadAll(r.Body)
			_ = json.Unmarshal(b, &ops)
			for _, op := range ops {
				if op.Path == "/traits/picture" {
					k.picture = op.Value // "remove" has no value
				}
			}
		}
		traits := map[string]any{"email": "aisha@example.test", "phone": "+9607770000", "name": "Aisha"}
		if k.picture != "" {
			traits["picture"] = k.picture
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id": newPerson, "schema_id": "registration", "schema_url": "x", "state": "active", "traits": traits,
		})
	}))
	t.Cleanup(k.Close)
	return k
}

// photoEndpoint is the auth module as the edition mounts it, with Kratos faked
// and the portraits served at portraits.
func photoEndpoint(t *testing.T, tx pgx.Tx, authz authorization.Authorizer, hydra *fakeHydra, kratos *fakeKratos) http.Handler {
	t.Helper()
	users := identity.New(tx, identity.Settings{
		KratosAdminURL: kratos.URL, HydraAdminURL: "http://127.0.0.1:1",
		HydraPublicURL: hydra.URL + "/", PortraitsURL: portraits,
	}, http.DefaultClient, slog.New(slog.DiscardHandler))
	m := New(t.Context(), Settings{Issuer: "http://127.0.0.1:1/", Audience: "erp-api"}, http.DefaultClient,
		users, authz, slog.New(slog.DiscardHandler))
	m.verifier = tokens
	r := chi.NewRouter()
	r.Route("/api/auth", m.Routes)
	return r
}

func putPhoto(t *testing.T, h http.Handler, token, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPut, "/api/auth/me/photo", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestFeaturePhotoIsSavedOnTheAccountAndShownAtOnce(t *testing.T) {
	tx := testdb.Tx(t)
	authz := &authztest.Stated{Allow: true}
	hydra, kratos := newFakeHydra(t), newFakeKratos(t)
	h := photoEndpoint(t, tx, authz, hydra, kratos)
	require.Equal(t, http.StatusOK, callMe(t, h, http.MethodPost, "person").Code)
	authz.Asked = nil

	rec := putPhoto(t, h, "person", `{"portrait":"portrait-3"}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var body meBody
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	want := portraits + "portrait-3.jpg"
	assert.Equal(t, want, body.User.AvatarURL)
	assert.Equal(t, want, kratos.picture, "the account holds it, so every app sees it")
	testdb.AssertHas(t, tx, "users", map[string]any{"id": body.User.ID, "avatar_url": want})
	assert.Equal(t, []authorization.Resource{{Kind: "identity:user", ID: body.User.ID}}, authz.Asked,
		"Cerbos is asked about the caller's own user")

	// Back to initials.
	rec = putPhoto(t, h, "person", `{"portrait":""}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Empty(t, kratos.picture)
	testdb.AssertHas(t, tx, "users", map[string]any{"id": body.User.ID, "avatar_url": nil})
}

func TestFeaturePhotoRefusesWhatIsNotAPortrait(t *testing.T) {
	tx := testdb.Tx(t)
	hydra, kratos := newFakeHydra(t), newFakeKratos(t)
	h := photoEndpoint(t, tx, &authztest.Stated{Allow: true}, hydra, kratos)
	require.Equal(t, http.StatusOK, callMe(t, h, http.MethodPost, "person").Code)

	for _, body := range []string{
		`{"portrait":"portrait-99"}`,
		`{"portrait":"https://evil.test/track.png"}`,
		`{}`,
		`{"portrait":"portrait-1","url":"https://evil.test/x.png"}`,
	} {
		rec := putPhoto(t, h, "person", body)
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, body)
	}
	assert.Zero(t, kratos.patches, "nothing is written")
	testdb.AssertHas(t, tx, "users", map[string]any{"kratos_identity_id": newPerson, "avatar_url": picture})
}

func TestFeaturePhotoRefusedByCerbosWritesNothing(t *testing.T) {
	tx := testdb.Tx(t)
	hydra, kratos := newFakeHydra(t), newFakeKratos(t)
	require.Equal(t, http.StatusOK,
		callMe(t, photoEndpoint(t, tx, &authztest.Stated{Allow: true}, hydra, kratos), http.MethodPost, "person").Code)

	rec := putPhoto(t, photoEndpoint(t, tx, &authztest.Stated{Err: authorization.ErrDenied}, hydra, kratos), "person", `{"portrait":"portrait-1"}`)
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Zero(t, kratos.patches)
	testdb.AssertHas(t, tx, "users", map[string]any{"kratos_identity_id": newPerson, "avatar_url": picture})
}

func TestFeaturePhotoWhenKratosFailsWritesNothing(t *testing.T) {
	tx := testdb.Tx(t)
	hydra, kratos := newFakeHydra(t), newFakeKratos(t)
	h := photoEndpoint(t, tx, &authztest.Stated{Allow: true}, hydra, kratos)
	require.Equal(t, http.StatusOK, callMe(t, h, http.MethodPost, "person").Code)
	kratos.Close()

	rec := putPhoto(t, h, "person", `{"portrait":"portrait-1"}`)
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
	assert.NotContains(t, rec.Body.String(), "kratos")
	testdb.AssertHas(t, tx, "users", map[string]any{"kratos_identity_id": newPerson, "avatar_url": picture})
}

func TestFeaturePortraitsListsTheChoices(t *testing.T) {
	tx := testdb.Tx(t)
	authz := &authztest.Stated{Allow: true}
	hydra, kratos := newFakeHydra(t), newFakeKratos(t)
	h := photoEndpoint(t, tx, authz, hydra, kratos)
	require.Equal(t, http.StatusOK, callMe(t, h, http.MethodPost, "person").Code)
	authz.Asked = nil

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me/portraits", nil)
	req.Header.Set("Authorization", "Bearer person")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	var body struct{ Portraits []struct{ ID, URL string } }
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Len(t, body.Portraits, 7)
	assert.Equal(t, "portrait-1", body.Portraits[0].ID)
	assert.Equal(t, portraits+"portrait-1.jpg", body.Portraits[0].URL)
	require.Len(t, authz.Asked, 1)
	assert.Equal(t, "identity:user", authz.Asked[0].Kind)
}

func TestFeaturePhotoForAClientIsDenied(t *testing.T) {
	tx := testdb.Tx(t)
	authz := &authztest.Stated{Allow: true}
	kratos := newFakeKratos(t)
	h := photoEndpoint(t, tx, authz, newFakeHydra(t), kratos)

	putPhoto(t, h, "client", `{"portrait":"portrait-1"}`)
	assert.Equal(t, []authorization.Resource{{Kind: "identity:client", ID: sentClient}}, authz.Asked,
		"a client acting for itself is checked as itself, which Cerbos denies")
}
