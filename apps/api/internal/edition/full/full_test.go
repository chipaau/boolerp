package full

import (
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/bootstrap"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	authorizationseeds "github.com/boolmv/erp/apps/api/internal/platform/authorization/seeds"
	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/auth"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/config"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

func TestMigrationsListEveryModuleWithItsTables(t *testing.T) {
	names := make([]string, len(Migrations))
	for i, m := range Migrations {
		names[i] = m.Name
	}
	assert.Equal(t, []string{"audit", "reference", "identity", "tenancy", "authorization", "billing"}, names, "in dependency order, audit first")

	for name, file := range map[int]string{0: "00001_audit_log.sql", 1: "00001_countries.sql", 2: "00001_users.sql", 3: "00001_tenants.sql", 4: "00001_apps.sql"} {
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
	cfg.Cerbos = config.Cerbos{Addr: "127.0.0.1:1", Timeout: time.Second} // connected lazily
	require.NoError(t, RegisterModules(t.Context(), r, bootstrap.Deps{
		Config: cfg, Logger: slog.New(slog.DiscardHandler), HTTPClient: http.DefaultClient,
	}))

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
	assert.Equal(t, []string{"audit.partitions", "reference.countries", "reference.legal_forms", "reference.sectors", "reference.institution_types", "authorization.apps", "authorization.capabilities", "tenancy.operator", "authorization.operator_apps", "identity.team_accounts", "tenancy.operator_members"}, names)
}

func TestDataSeedersAreTheSeedFiles(t *testing.T) {
	seeders := DataSeeders(nil, SeedSettings{PlatformDomain: "bool.test"})
	names := make([]string, len(seeders))
	for i, s := range seeders {
		names[i] = s.Name()
	}
	assert.Equal(t, []string{"audit.partitions", "reference.countries", "reference.legal_forms", "reference.sectors", "reference.institution_types", "authorization.apps", "authorization.capabilities", "tenancy.operator", "authorization.operator_apps"}, names)
}

func TestSampleSeeders(t *testing.T) {
	seeders := SampleSeeders(nil, SeedSettings{PlatformDomain: "bool.test"})
	names := make([]string, len(seeders))
	for i, s := range seeders {
		names[i] = s.Name()
	}
	assert.Equal(t, []string{"tenancy.sample_tenants", "tenancy.sample_domains", "authorization.sample_apps"}, names)
}

func TestMembershipSeeders(t *testing.T) {
	seeders := MembershipSeeders(nil)
	names := make([]string, len(seeders))
	for i, s := range seeders {
		names[i] = s.Name()
	}
	assert.Equal(t, []string{"tenancy.operator_members", "tenancy.sample_members"}, names)
}

func TestTheTeamOwnerIsOneOfTheTeam(t *testing.T) {
	var owners []string
	for _, m := range teamMembers() {
		if m.Owner {
			owners = append(owners, m.Email)
		}
	}
	assert.Equal(t, []string{"shifau@bool.mv"}, owners)
}

func TestTheEditionsAppsAreValid(t *testing.T) {
	require.NoError(t, authorizationseeds.Check(Apps))
	require.NoError(t, authorizationseeds.CheckCapabilities(Apps))
	keys := make([]string, len(Apps))
	for i, a := range Apps {
		keys[i] = a.Key
	}
	assert.Equal(t, []string{"admin", "control-centre"}, keys)
}

func TestPrincipalForEachKindOfCaller(t *testing.T) {
	const account = "0192f6a0-0000-7000-8000-0000000ac001"
	user := &identity.User{ID: "0192f6a0-0000-7000-8000-00000000a001", KratosIdentityID: account}
	for name, c := range map[string]struct {
		caller auth.Caller
		want   authorization.Principal
	}{
		"a registered person": {
			auth.Caller{Token: auth.Token{Subject: account, ClientID: "bff-workspace"}, User: user},
			authorization.Principal{ID: user.ID, Roles: []string{"user"}, Attributes: map[string]any{"account_id": account}},
		},
		"a person who has not registered": {
			auth.Caller{Token: auth.Token{Subject: account, ClientID: "bff-workspace"}},
			authorization.Principal{ID: account, Roles: []string{"account"}, Attributes: map[string]any{"account_id": account}},
		},
		"a machine client": {
			auth.Caller{Token: auth.Token{ClientID: "hrms-sync"}},
			authorization.Principal{ID: "hrms-sync", Roles: []string{"client"}},
		},
	} {
		t.Run(name, func(t *testing.T) {
			p, err := Principal(auth.NewContext(t.Context(), c.caller))
			require.NoError(t, err)
			assert.Equal(t, c.want, p)
		})
	}
}

func TestPrincipalInATenant(t *testing.T) {
	ctx := auth.NewContext(t.Context(), auth.Caller{Token: auth.Token{ClientID: "hrms-sync"}})
	ctx = tenant.With(ctx, tenant.Tenant{ID: "0192f6a0-0000-7000-8000-0000000000aa", IsOperator: true})
	p, err := Principal(ctx)
	require.NoError(t, err)
	assert.Equal(t, map[string]any{"tenant_id": "0192f6a0-0000-7000-8000-0000000000aa", "in_operator_tenant": true}, p.Attributes)
}

func TestPrincipalOfAMemberHasTheMemberRole(t *testing.T) {
	const account = "0192f6a0-0000-7000-8000-0000000ac001"
	user := &identity.User{ID: "0192f6a0-0000-7000-8000-00000000a001", KratosIdentityID: account}
	ctx := auth.NewContext(t.Context(), auth.Caller{Token: auth.Token{Subject: account}, User: user})
	ctx = tenant.With(ctx, tenant.Tenant{ID: "0192f6a0-0000-7000-8000-0000000000aa"})

	p, err := Principal(ctx)
	require.NoError(t, err)
	assert.Equal(t, []string{"user"}, p.Roles, "in a tenant but not a member")

	p, err = Principal(tenant.WithMembership(ctx, tenant.Membership{ID: "0192f6a0-0000-7000-8000-0000000000m1"}))
	require.NoError(t, err)
	assert.Equal(t, []string{"user", "member"}, p.Roles)

	// A membership without a tenant (never set by the chain) adds nothing.
	p, err = Principal(tenant.WithMembership(auth.NewContext(t.Context(), auth.Caller{Token: auth.Token{Subject: account}, User: user}),
		tenant.Membership{ID: "0192f6a0-0000-7000-8000-0000000000m1"}))
	require.NoError(t, err)
	assert.Equal(t, []string{"user"}, p.Roles)
}

func TestRegisterModulesMountsTheTenantBehindTheTenantChain(t *testing.T) {
	r := chi.NewRouter()
	cfg := config.Config{
		Auth:     config.Auth{Issuer: "http://127.0.0.1:1/", Audience: "erp-api"},
		Identity: config.Identity{KratosAdminURL: "http://127.0.0.1:1", HydraAdminURL: "http://127.0.0.1:1"},
	}
	cfg.Cerbos = config.Cerbos{Addr: "127.0.0.1:1", Timeout: time.Second}
	require.NoError(t, RegisterModules(t.Context(), r, bootstrap.Deps{
		Config: cfg, Logger: slog.New(slog.DiscardHandler), HTTPClient: http.DefaultClient,
	}))

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/tenant", nil))
	assert.Equal(t, http.StatusUnauthorized, rec.Code, "mounted, and authentication comes first")
}

func TestPrincipalNeedsACaller(t *testing.T) {
	_, err := Principal(t.Context())
	assert.Error(t, err)
}

// The route walk C144 asks for: every route outside /api/auth (whose /me routes
// use the authentication pieces on their own, C157) has Authenticate and a
// caller-kind guard, and any route that resolves a tenant also requires
// membership. Middlewares are compared by their function's code pointer, which a
// method value shares across receivers.
func TestEveryRouteIsProtected(t *testing.T) {
	r := chi.NewRouter()
	cfg := config.Config{
		Auth:     config.Auth{Issuer: "http://127.0.0.1:1/", Audience: "erp-api"},
		Identity: config.Identity{KratosAdminURL: "http://127.0.0.1:1", HydraAdminURL: "http://127.0.0.1:1"},
	}
	cfg.Cerbos = config.Cerbos{Addr: "127.0.0.1:1", Timeout: time.Second}
	require.NoError(t, RegisterModules(t.Context(), r, bootstrap.Deps{
		Config: cfg, Logger: slog.New(slog.DiscardHandler), HTTPClient: http.DefaultClient,
	}))

	code := func(mw func(http.Handler) http.Handler) uintptr { return reflect.ValueOf(mw).Pointer() }
	var (
		authenticate  = code((&auth.Module{}).Authenticate)
		requireUser   = code(auth.RequireUser)
		recordActor   = code(auth.Actor)
		resolveTenant = code((&tenancy.Module{}).ResolveTenant)
		requireMember = code((&tenancy.Module{}).RequireMember)
		requireActive = code((&tenancy.Module{}).RequireActiveTenant)
	)
	routes := 0
	require.NoError(t, chi.Walk(r, func(method, route string, _ http.Handler, mws ...func(http.Handler) http.Handler) error {
		if strings.HasPrefix(route, "/api/auth/") {
			return nil
		}
		routes++
		has := map[uintptr]bool{}
		for _, mw := range mws {
			has[code(mw)] = true
		}
		assert.True(t, has[authenticate], "%s %s: Authenticate", method, route)
		assert.True(t, has[requireUser], "%s %s: a caller-kind guard", method, route)
		assert.True(t, has[recordActor], "%s %s: the actor for the audit", method, route)
		if has[resolveTenant] {
			assert.True(t, has[requireMember], "%s %s: ResolveTenant without RequireMember", method, route)
			assert.True(t, has[requireActive], "%s %s: RequireActiveTenant", method, route)
		}
		return nil
	}))
	assert.Positive(t, routes, "the walk saw the tenant route")
}
