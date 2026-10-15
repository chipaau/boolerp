// Package tenancy is the tenancy module (C115): the registry of tenants, the
// customer organisations that are each one data boundary, and the single
// operator tenant. Its tables are in migrations (C95, C122) and its Cerbos policies
// in policies (C151). It provides the middlewares that put a request in its tenant
// (ResolveTenant, RequireMember, RequireActiveTenant, C144), the route that answers
// which tenant a request is in, and the admin console's tenant routes: the list and
// creating a tenant (C179, C197).
package tenancy

import (
	"context"
	"embed"
	"io/fs"
	"log/slog"

	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/adapters/store"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

// DB is what the module needs from PostgreSQL: the pool, as the runtime role. The
// lookups query it directly; the tenant's own data is read in tenant.ReadTx.
type DB interface {
	store.Querier
	tenant.Beginner
}

// Lookups find a request's tenant and the caller's membership before the
// request's transaction (store.Lookups; unit tests use their own).
type Lookups interface {
	TenantByHost(ctx context.Context, host string) (store.Host, bool, error)
	ActiveMembership(ctx context.Context, tenantID, userID string) (tenant.Membership, bool, error)
	OperatorTenant(ctx context.Context) (tenant.Tenant, bool, error)
}

// Module is the tenancy module.
type Module struct {
	db        DB
	lookups   Lookups
	reference Reference
	logger    *slog.Logger
}

// New returns the module over db; ref is the reference lists creating a tenant checks
// against (the reference module).
func New(db DB, ref Reference, logger *slog.Logger) *Module {
	return &Module{db: db, lookups: store.NewLookups(db), reference: ref, logger: logger}
}

//go:embed migrations/*.sql
var migrations embed.FS

//go:embed all:policies
var policies embed.FS

// Migrations returns the module's tables, applied by cmd/migrate as "tenancy".
func Migrations() fs.FS {
	sub, err := fs.Sub(migrations, "migrations")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}

// Policies returns the module's Cerbos policies, their tests, and their schemas
// (C151), assembled as "tenancy".
func Policies() fs.FS {
	sub, err := fs.Sub(policies, "policies")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}
