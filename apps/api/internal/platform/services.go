// Package platform is what the edition gives every module (C144): the platform's
// shared services and the named middleware chains that protect routes. The
// capabilities themselves are its subpackages (identity, tenancy, authorization,
// reference) and the technical building blocks are in kit (C122, C125).
package platform

import (
	"log/slog"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
)

// Services is built once by the edition and passed to every module that needs it.
// A module applies one chain per route group; the single-purpose middlewares the
// chains are built from stay available for unusual routes (such as /api/auth/me).
// The remaining chains (TenantClient, Operator) and services (audit, cache) are
// added with the first route that needs them.
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

	// Operator protects the admin console's routes: authenticate, require a person,
	// record the actor, resolve the operator tenant, require the person's active
	// membership of it, require it active, load their capabilities, and require an
	// authorization decision (C144, C178). Cerbos then requires an operator capability.
	Operator chi.Middlewares
}
