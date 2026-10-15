// Package platform is what the edition gives every module (C144): the platform's
// shared services and the named middleware chains that protect routes. The
// capabilities themselves are its subpackages (identity, tenancy, authorization,
// reference) and the technical building blocks are in kit (C122, C125).
package platform

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
)

// Services is built once by the edition (ChainParts.Services) and passed to every module
// that needs it. A module applies one chain per route group; the single-purpose
// middlewares the chains are built from stay available for unusual routes (such as
// /api/auth/me). The remaining chain (TenantClient) and services (audit, cache) are added
// with the first route that needs them.
type Services struct {
	Pool   *pgxpool.Pool
	Authz  authorization.Authorizer
	Logger *slog.Logger

	// TenantUser protects a route a person uses inside a tenant: authenticate,
	// require a person, record the actor for the audit, resolve the tenant from the
	// host, require the person's active membership, require an active tenant, and
	// load their capabilities there (C177), and require an authorization decision
	// before answering, in that order (C144, C155, C164).
	TenantUser chi.Middlewares

	// Authenticated protects a route any authenticated caller may use, a person or a
	// machine client, wherever they are: no tenant, membership, or capability is
	// needed (shared reference lists, C199). Authenticate, record the actor, and
	// require an authorization decision before answering.
	Authenticated chi.Middlewares

	// Operator protects the admin console's routes: authenticate, require a person,
	// record the actor, resolve the operator tenant, require the person's active
	// membership of it, require it active, load their capabilities, and require an
	// authorization decision (C144, C178). Cerbos then requires an operator capability.
	Operator chi.Middlewares
}

// ChainParts are the single-purpose middlewares the named chains are built from (C144):
// authentication's, tenancy's, and authorization's. The edition gives the real ones;
// tests give the same ones with a fake Authenticate, so both build the same chains in
// the same order.
type ChainParts struct {
	Authenticate, RequireUser, Actor                                   func(http.Handler) http.Handler
	ResolveTenant, ResolveOperator, RequireMember, RequireActiveTenant func(http.Handler) http.Handler
	Capabilities, Enforce                                              func(http.Handler) http.Handler
}

// TenantUser is the chain for a person inside a tenant (see Services.TenantUser).
func (p ChainParts) TenantUser() chi.Middlewares {
	return chi.Chain(p.Authenticate, p.RequireUser, p.Actor,
		p.ResolveTenant, p.RequireMember, p.RequireActiveTenant, p.Capabilities, p.Enforce)
}

// Operator is the chain for the admin console's staff (see Services.Operator).
func (p ChainParts) Operator() chi.Middlewares {
	return chi.Chain(p.Authenticate, p.RequireUser, p.Actor,
		p.ResolveOperator, p.RequireMember, p.RequireActiveTenant, p.Capabilities, p.Enforce)
}

// Authenticated is the chain for any authenticated caller (see Services.Authenticated).
func (p ChainParts) Authenticated() chi.Middlewares {
	return chi.Chain(p.Authenticate, p.Actor, p.Enforce)
}

// Services returns the services with every chain built from p.
func (p ChainParts) Services(pool *pgxpool.Pool, authz authorization.Authorizer, logger *slog.Logger) Services {
	return Services{Pool: pool, Authz: authz, Logger: logger,
		TenantUser: p.TenantUser(), Authenticated: p.Authenticated(), Operator: p.Operator()}
}
