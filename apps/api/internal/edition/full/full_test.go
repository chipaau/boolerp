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
	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/config"
)

func TestMigrationsListEveryModuleWithItsTables(t *testing.T) {
	names := make([]string, len(Migrations))
	for i, m := range Migrations {
		names[i] = m.Name
	}
	assert.Equal(t, []string{"reference", "identity"}, names, "in dependency order")

	for name, file := range map[int]string{0: "00001_countries.sql", 1: "00001_users.sql"} {
		files, err := fs.Glob(Migrations[name].FS, "*.sql")
		require.NoError(t, err)
		assert.Contains(t, files, file)
	}
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

func TestDeploySeedersInOrder(t *testing.T) {
	seeders := DeploySeeders(nil, SeedSettings{Identity: identity.Settings{
		KratosAdminURL: "http://127.0.0.1:1", HydraAdminURL: "http://127.0.0.1:1",
	}}, http.DefaultClient, slog.New(slog.DiscardHandler), nil)
	names := make([]string, len(seeders))
	for i, s := range seeders {
		names[i] = s.Name()
	}
	assert.Equal(t, []string{"reference.countries", "reference.legal_forms", "reference.sectors", "reference.institution_types", "identity.team_accounts"}, names)
}

func TestDataSeedersAreTheSeedFiles(t *testing.T) {
	seeders := DataSeeders(nil)
	names := make([]string, len(seeders))
	for i, s := range seeders {
		names[i] = s.Name()
	}
	assert.Equal(t, []string{"reference.countries", "reference.legal_forms", "reference.sectors", "reference.institution_types"}, names)
}
