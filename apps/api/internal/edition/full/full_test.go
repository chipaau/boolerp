package full

import (
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/bootstrap"
	"github.com/boolmv/erp/apps/api/internal/modules/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/config"
)

func TestMigrationsListEveryModuleWithItsTables(t *testing.T) {
	require.Len(t, Migrations, 1)
	assert.Equal(t, "identity", Migrations[0].Name)
	files, err := fs.Glob(Migrations[0].FS, "*.sql")
	require.NoError(t, err)
	assert.Contains(t, files, "00001_users.sql")
}

func TestRegisterModulesMountsAuthBehindAuthentication(t *testing.T) {
	r := chi.NewRouter()
	cfg := config.Config{
		Auth:     config.Auth{Issuer: "http://127.0.0.1:1/", Audience: "erp-api"},
		Identity: config.Identity{KratosAdminURL: "http://127.0.0.1:1", HydraAdminURL: "http://127.0.0.1:1"},
	}
	RegisterModules(t.Context(), r, bootstrap.Deps{
		Config: cfg, Logger: slog.New(slog.DiscardHandler), HTTPClient: http.DefaultClient,
	})

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/auth/me", nil))
	assert.Equal(t, http.StatusUnauthorized, rec.Code, "the auth module is mounted and asks for a token")
}

func TestSeedersInOrder(t *testing.T) {
	seeders := Seeders(nil, SeedSettings{Identity: identity.Settings{
		KratosAdminURL: "http://127.0.0.1:1", HydraAdminURL: "http://127.0.0.1:1",
	}}, http.DefaultClient, slog.New(slog.DiscardHandler))
	names := make([]string, len(seeders))
	for i, s := range seeders {
		names[i] = s.Name()
	}
	assert.Equal(t, []string{"identity.users"}, names)
}
