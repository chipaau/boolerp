// Package full is the complete edition: every module (C93, C95). cmd/api and
// cmd/migrate both use it, so the API's modules and the tables migrate creates
// can never drift apart. A smaller edition is another package under
// internal/edition with shorter lists, and its own two mains.
package full

import (
	"context"
	"io"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/apps/api/internal/bootstrap"
	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/auth"
	identityseeds "github.com/boolmv/erp/apps/api/internal/platform/identity/seeds"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
	"github.com/boolmv/erp/apps/api/internal/platform/reference"
	referenceseeds "github.com/boolmv/erp/apps/api/internal/platform/reference/seeds"
)

// Migrations are the edition's tables, in dependency order: a package's tables come
// after those of the packages they reference. Platform capabilities come first,
// business modules after them (C122).
var Migrations = []postgres.ModuleMigrations{
	{Name: "reference", FS: reference.Migrations()},
	{Name: "identity", FS: identity.Migrations()},
}

// RegisterModules builds the edition's modules, connects them, and registers
// their routes (bootstrap.RegisterModules).
func RegisterModules(ctx context.Context, r chi.Router, d bootstrap.Deps) {
	cfg := d.Config

	users := identity.New(d.Pool, identity.Settings{
		KratosAdminURL: cfg.Identity.KratosAdminURL,
		HydraAdminURL:  cfg.Identity.HydraAdminURL,
	}, d.HTTPClient, d.Logger)

	// Authentication resolves a token's subject to its user through identity.
	authModule := auth.New(ctx, auth.Settings{Issuer: cfg.Auth.Issuer, Audience: cfg.Auth.Audience},
		d.HTTPClient, users, d.Logger)

	r.Route("/api/auth", authModule.Routes)
}

// SeedSettings configure the seeders (from config.Seed and config.Deploy).
type SeedSettings struct {
	Identity identity.Settings
}

// DeploySeeders load production's starting data (C135), in dependency order like
// Migrations. cmd/deploy runs them in every environment, after applying the
// migrations, as the migration role (db), which owns the tables. terminal is
// where one-time recovery codes for new accounts are shown, or nil for none.
func DeploySeeders(db *pgxpool.Pool, s SeedSettings, client *http.Client, logger *slog.Logger, terminal io.Writer) []seed.Seeder {
	users := identity.New(db, s.Identity, client, logger)
	return []seed.Seeder{
		referenceseeds.NewCountries(db),
		identityseeds.NewTeamAccounts(users, terminal),
	}
}

// Seeders are the edition's demo data seeders (C135), one per store, in
// dependency order like Migrations: a store is seeded after the stores it
// references. cmd/seed runs them (C50), never in production; tests never rely
// on them.
func Seeders(db *pgxpool.Pool, s SeedSettings, client *http.Client, logger *slog.Logger) []seed.Seeder {
	users := identity.New(db, s.Identity, client, logger)
	return []seed.Seeder{
		identityseeds.NewUsers(users),
	}
}
