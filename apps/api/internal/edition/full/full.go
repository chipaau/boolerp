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
	"github.com/boolmv/erp/apps/api/internal/platform"
	"github.com/boolmv/erp/apps/api/internal/platform/audit"
	auditseeds "github.com/boolmv/erp/apps/api/internal/platform/audit/seeds"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	authorizationseeds "github.com/boolmv/erp/apps/api/internal/platform/authorization/seeds"
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
	{Name: "audit", FS: audit.Migrations()}, // first: every table's migration enables auditing (C164)
	{Name: "reference", FS: reference.Migrations()},
	{Name: "identity", FS: identity.Migrations()},
	{Name: "tenancy", FS: tenancy.Migrations()},
	{Name: "authorization", FS: authorization.Migrations()},
}

// Apps are the edition's apps (C165): the platform's own, then each business module's.
// The authorization.apps seed file mirrors them into the apps table.
var Apps = []authorization.App{authorization.Admin, authorization.ControlCentre}

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

	// The platform every module gets (C144): the tenant chain is built here from
	// the single-purpose middlewares of auth, tenancy, and authorization.
	tenancyModule := tenancy.New(d.Pool, d.Logger)
	services := platform.Services{
		Pool: d.Pool, Authz: authz, Logger: d.Logger,
		TenantUser: chi.Chain(authModule.Authenticate, auth.RequireUser, auth.Actor,
			tenancyModule.ResolveTenant, tenancyModule.RequireMember, tenancyModule.RequireActiveTenant,
			authorization.Enforce(d.Logger)),
	}
	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/tenant", tenancyModule.Routes(services))
	})
	return nil
}

// Principal builds who is asking for every authorization check (C154, C155,
// C157): the authenticated person (role user), a person who has not registered
// yet (role account, ID their account), or a machine client (role client); a
// person's account ID (the token's sub) as account_id; and the tenant the
// request acts in, when there is one. Inside a tenant, a person with an active
// membership there (RequireMember) also has the role member (C153); their
// capabilities there are added once roles exist.
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
		if _, ok := tenant.MembershipFrom(ctx); ok && caller.User != nil {
			p.Roles = append(p.Roles, "member")
		}
	}
	if len(attrs) > 0 {
		p.Attributes = attrs
	}
	return p, nil
}

// SeedSettings configure the seeders (from config.Seed and config.Deploy).
type SeedSettings struct {
	Identity identity.Settings
	// PlatformDomain is the deployment's domain (APP_PLATFORM_DOMAIN, C159):
	// tenants' platform workspace hosts are <slug>.<PlatformDomain>.
	PlatformDomain string
}

// DataSeeders load the seed files every database needs (C135, C137): audit_log's
// monthly partitions (C146), the reference lists, the app catalogue (C165), and the
// operator tenant (C142), in
// dependency order like Migrations. Both cmd/deploy (in
// production) and cmd/seed (in development) run them, as the migration role (db),
// which owns the tables, so production and development load the same files.
func DataSeeders(db *pgxpool.Pool, s SeedSettings) []seed.Seeder {
	return []seed.Seeder{
		auditseeds.NewPartitions(db),
		referenceseeds.NewCountries(db),
		referenceseeds.NewLegalForms(db),
		referenceseeds.NewSectors(db),
		referenceseeds.NewInstitutionTypes(db),
		authorizationseeds.NewApps(db, Apps),
		tenancyseeds.NewOperator(db, tenancyseeds.Bool, s.PlatformDomain),
	}
}

// SampleSeeders load development's sample data that must be written as the
// migration role (db), because its module has no operation to create it through
// yet (C143): the sample tenants, then their extra hosts. cmd/seed runs them after DataSeeders; each skips
// itself outside dev.
func SampleSeeders(db *pgxpool.Pool, s SeedSettings) []seed.Seeder {
	return []seed.Seeder{
		tenancyseeds.NewSamples(db, s.PlatformDomain),
		tenancyseeds.NewSampleDomains(db),
	}
}

// MembershipSeeders give people their memberships (C160), as the migration role
// (db), because tenancy has no invite operation yet: the team in the operator
// tenant, then, in dev only, the team in every sample tenant and the end-to-end
// account in male-city, the suite's workspace. They need the accounts, so cmd/seed
// runs them after Seeders.
func MembershipSeeders(db *pgxpool.Pool) []seed.Seeder {
	team := teamMembers()
	return []seed.Seeder{
		tenancyseeds.NewOperatorMembers(db, team),
		tenancyseeds.NewSampleMembers(db, team, tenancyseeds.Grant{
			Tenant: "male-city", Member: tenancyseeds.Member{Email: identityseeds.E2EEmail},
		}),
	}
}

// teamMembers are the team's accounts as members, tenancyseeds.TeamOwner the owner.
func teamMembers() []tenancyseeds.Member {
	emails := identityseeds.TeamEmails()
	members := make([]tenancyseeds.Member, len(emails))
	for i, e := range emails {
		members[i] = tenancyseeds.Member{Email: e, Owner: e == tenancyseeds.TeamOwner}
	}
	return members
}

// DeploySeeders load production's starting data (C135, C137): DataSeeders, then
// the team's accounts without passwords and their memberships of the operator
// tenant (C160). cmd/deploy runs them after applying the migrations, as the
// migration role (db). terminal is where one-time recovery codes for new accounts
// are shown, or nil for none.
func DeploySeeders(db *pgxpool.Pool, s SeedSettings, client *http.Client, logger *slog.Logger, terminal io.Writer) []seed.Seeder {
	users := identity.New(db, s.Identity, client, logger)
	return append(DataSeeders(db, s),
		identityseeds.NewTeamAccounts(users, terminal),
		tenancyseeds.NewOperatorMembers(db, teamMembers()))
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
