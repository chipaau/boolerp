// Package full is the complete edition: every module (C93, C95). cmd/api and
// cmd/migrate both use it, so the API's modules and the tables migrate creates
// can never drift apart. A smaller edition is another package under
// internal/edition with shorter lists, and its own two mains.
package full

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/apps/api/internal/bootstrap"
	"github.com/boolmv/erp/apps/api/internal/modules/identity"
	identityseeds "github.com/boolmv/erp/apps/api/internal/modules/identity/seeds"
	"github.com/boolmv/erp/apps/api/internal/platform/auth"
	"github.com/boolmv/erp/apps/api/internal/platform/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/seed"
)

// Migrations are the edition's modules' tables, in dependency order: a module's
// tables come after those of the modules they reference.
var Migrations = []postgres.ModuleMigrations{
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

	// auth turns a token's subject into the user through identity.
	resolve := func(ctx context.Context, subject string) (auth.User, error) {
		u, err := users.Resolve(ctx, subject)
		if errors.Is(err, identity.ErrNoAccount) {
			return auth.User{}, auth.ErrUnknownUser
		}
		return auth.User{ID: u.ID, Email: u.Email, Phone: u.Phone, DisplayName: u.DisplayName}, err
	}
	authModule := auth.New(ctx, auth.Settings{Issuer: cfg.Auth.Issuer, Audience: cfg.Auth.Audience},
		d.HTTPClient, resolve, d.Logger)

	r.Route("/api/auth", authModule.Routes)
}

// SeedSettings configure the seeders (from config.Seed).
type SeedSettings struct {
	Identity identity.Settings
}

// Seeders are the edition's modules' seeders, one per store, in dependency
// order like Migrations: a store is seeded after the stores it references.
// cmd/seed runs them (C50).
func Seeders(db *pgxpool.Pool, s SeedSettings, client *http.Client, logger *slog.Logger) []seed.Seeder {
	users := identity.New(db, s.Identity, client, logger)
	return []seed.Seeder{
		identityseeds.NewUsers(users),
	}
}
