// Package full is the complete edition: every module (C93, C95). cmd/api and
// cmd/migrate both use it, so the API's modules and the tables migrate creates
// can never drift apart. A smaller edition is another package under
// internal/edition with shorter lists, and its own two mains.
package full

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"

	"github.com/boolmv/erp/apps/api/internal/bootstrap"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/auth"
	identityseeds "github.com/boolmv/erp/apps/api/internal/platform/identity/seeds"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
	"github.com/boolmv/erp/apps/api/internal/platform/reference"
	referenceseeds "github.com/boolmv/erp/apps/api/internal/platform/reference/seeds"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy"
	tenancyseeds "github.com/boolmv/erp/apps/api/internal/platform/tenancy/seeds"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

// Migrations are the edition's tables, in dependency order: a package's tables come
// after those of the packages they reference. Platform capabilities come first,
// business modules after them (C122).
var Migrations = []postgres.ModuleMigrations{
	{Name: "reference", FS: reference.Migrations()},
	{Name: "identity", FS: identity.Migrations()},
	{Name: "tenancy", FS: tenancy.Migrations()},
}

// Policies are the edition's Cerbos policies, tests, and schemas, one entry per
// module (C151): the shared authorization pieces, then each module's. cmd/policies
// assembles them into the directory Cerbos reads, so an edition ships only its own
// modules' policies.
var Policies = []authorization.ModulePolicies{
	{Name: "authorization", FS: authorization.Policies()},
	{Name: "identity", FS: identity.Policies()},
	{Name: "tenancy", FS: tenancy.Policies()},
}

// RegisterModules builds the edition's modules, connects them, and registers
// their routes (bootstrap.RegisterModules).
func RegisterModules(ctx context.Context, r chi.Router, d bootstrap.Deps) error {
	cfg := d.Config

	users := identity.New(d.Pool, identity.Settings{
		KratosAdminURL: cfg.Identity.KratosAdminURL,
		HydraAdminURL:  cfg.Identity.HydraAdminURL,
		HydraPublicURL: cfg.Auth.Issuer,
	}, d.HTTPClient, d.Logger)

	// Authorization asks Cerbos (C152, C155). The connection lives as long as the
	// process: requests still being answered during shutdown keep using it.
	cerbosClient, err := authorization.Dial(authorization.Settings{
		Addr: cfg.Cerbos.Addr, TLSCAFile: cfg.Cerbos.TLSCAFile, Timeout: cfg.Cerbos.Timeout,
	}, grpcTelemetry(d)...)
	if err != nil {
		return err
	}
	authz := authorization.NewCerbos(cerbosClient, Principal, cfg.Cerbos.Timeout)

	// Authentication finds a token's user through identity, and registers it (C157).
	authModule := auth.New(ctx, auth.Settings{Issuer: cfg.Auth.Issuer, Audience: cfg.Auth.Audience},
		d.HTTPClient, users, authz, d.Logger)

	r.Route("/api/auth", authModule.Routes)
	return nil
}

// Principal builds who is asking for every authorization check (C154, C155,
// C157): the authenticated person (role user), a person who has not registered
// yet (role account, ID their account), or a machine client (role client); a
// person's account ID (the token's sub) as account_id; and the tenant the
// request acts in, when there is one. Inside a tenant, member and the caller's
// capabilities there are added once memberships and roles exist.
func Principal(ctx context.Context) (authorization.Principal, error) {
	caller, ok := auth.FromContext(ctx)
	if !ok {
		return authorization.Principal{}, errors.New("no authenticated caller")
	}
	attrs := map[string]any{}
	p := authorization.Principal{ID: caller.Token.ClientID, Roles: []string{"client"}}
	if account := caller.Token.Subject; account != "" {
		attrs["account_id"] = account
		p = authorization.Principal{ID: account, Roles: []string{"account"}}
		if caller.User != nil {
			p = authorization.Principal{ID: caller.User.ID, Roles: []string{"user"}}
		}
	}
	if t, ok := tenant.From(ctx); ok {
		attrs["tenant_id"] = t.ID
		attrs["in_operator_tenant"] = t.IsOperator
	}
	if len(attrs) > 0 {
		p.Attributes = attrs
	}
	return p, nil
}

// SeedSettings configure the seeders (from config.Seed and config.Deploy).
type SeedSettings struct {
	Identity identity.Settings
}

// DataSeeders load the seed files every database needs (C135, C137): the
// reference lists and the operator tenant (C142), in dependency order like Migrations. Both cmd/deploy (in
// production) and cmd/seed (in development) run them, as the migration role (db),
// which owns the tables, so production and development load the same files.
func DataSeeders(db *pgxpool.Pool) []seed.Seeder {
	return []seed.Seeder{
		referenceseeds.NewCountries(db),
		referenceseeds.NewLegalForms(db),
		referenceseeds.NewSectors(db),
		referenceseeds.NewInstitutionTypes(db),
		tenancyseeds.NewOperator(db, tenancyseeds.Bool),
	}
}

// SampleSeeders load development's sample data that must be written as the
// migration role (db), because its module has no operation to create it through
// yet (C143): the sample tenants. cmd/seed runs them after DataSeeders; each skips
// itself outside dev.
func SampleSeeders(db *pgxpool.Pool) []seed.Seeder {
	return []seed.Seeder{
		tenancyseeds.NewSamples(db),
	}
}

// DeploySeeders load production's starting data (C135, C137): DataSeeders, then
// the team's accounts without passwords. cmd/deploy runs them after applying the
// migrations, as the migration role (db). terminal is where one-time recovery
// codes for new accounts are shown, or nil for none.
func DeploySeeders(db *pgxpool.Pool, s SeedSettings, client *http.Client, logger *slog.Logger, terminal io.Writer) []seed.Seeder {
	users := identity.New(db, s.Identity, client, logger)
	return append(DataSeeders(db), identityseeds.NewTeamAccounts(users, terminal))
}

// Seeders are the edition's demo data seeders (C135), one per store, in
// dependency order like Migrations: a store is seeded after the stores it
// references. cmd/seed runs them after DataSeeders (C50, C137), as the runtime
// role (db), never in production; tests never rely on them.
func Seeders(db *pgxpool.Pool, s SeedSettings, client *http.Client, logger *slog.Logger) []seed.Seeder {
	users := identity.New(db, s.Identity, client, logger)
	return []seed.Seeder{
		identityseeds.NewUsers(users),
	}
}

// grpcTelemetry instruments gRPC clients with the API's tracing and metrics, when
// bootstrap provides them.
func grpcTelemetry(d bootstrap.Deps) []otelgrpc.Option {
	var opts []otelgrpc.Option
	if d.TracerProvider != nil {
		opts = append(opts, otelgrpc.WithTracerProvider(d.TracerProvider))
	}
	if d.MeterProvider != nil {
		opts = append(opts, otelgrpc.WithMeterProvider(d.MeterProvider))
	}
	if d.Propagator != nil {
		opts = append(opts, otelgrpc.WithPropagators(d.Propagator))
	}
	return opts
}
