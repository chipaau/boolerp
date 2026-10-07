package tenancy

import (
	"net"
	"net/http"
	"strings"

	"github.com/boolmv/erp/apps/api/internal/platform/identity/auth"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

// notFound is the one answer for an unknown host, a host that does not open a
// workspace, and a tenant the caller is not a member of (C144), so outsiders
// cannot learn which tenants exist.
const notFound = "There is no workspace here."

// ResolveTenant puts the tenant the request's host opens in its context (C144):
// the host, normalised, must be an active host of a tenant that serves the
// workspace (C158); anything else gets 404. Only the host is used for now; a
// header for clients on a shared host comes with the first client that needs it
// (C162). The host never proves access: RequireMember comes next. The tenant's
// status is not checked here (RequireActiveTenant, after RequireMember).
func (m *Module) ResolveTenant(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := normaliseHost(r.Host)
		if host == "" {
			problem.Error(w, r, http.StatusNotFound, notFound)
			return
		}
		h, ok, err := m.lookups.TenantByHost(r.Context(), host)
		if err != nil {
			m.logger.ErrorContext(r.Context(), "looking up the tenant failed", "error", err)
			problem.Error(w, r, http.StatusServiceUnavailable, "The service is unavailable right now.")
			return
		}
		if !ok || h.Serves != "workspace" {
			problem.Error(w, r, http.StatusNotFound, notFound)
			return
		}
		next.ServeHTTP(w, r.WithContext(tenant.With(r.Context(), h.Tenant)))
	})
}

// ResolveOperator puts the operator tenant in the request's context, for the admin
// console's routes (C144, C178): those act in the operator tenant whatever the host, and
// RequireMember and Cerbos then decide (operator staff with a capability). Before the
// operator is seeded, 404.
func (m *Module) ResolveOperator(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t, ok, err := m.lookups.OperatorTenant(r.Context())
		if err != nil {
			m.logger.ErrorContext(r.Context(), "looking up the operator failed", "error", err)
			problem.Error(w, r, http.StatusServiceUnavailable, "The service is unavailable right now.")
			return
		}
		if !ok {
			problem.Error(w, r, http.StatusNotFound, notFound)
			return
		}
		next.ServeHTTP(w, r.WithContext(tenant.With(r.Context(), t)))
	})
}

// RequireMember lets through only a person with an active membership in the
// request's tenant, and puts the membership in the context (C144, C160). Anyone
// else gets 404, the same answer as an unknown host. It comes after Authenticate,
// RequireUser, and ResolveTenant.
func (m *Module) RequireMember(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		caller, ok := auth.FromContext(r.Context())
		t, inTenant := tenant.From(r.Context())
		if !ok || caller.User == nil || !inTenant {
			problem.Error(w, r, http.StatusNotFound, notFound)
			return
		}
		membership, ok, err := m.lookups.ActiveMembership(r.Context(), t.ID, caller.User.ID)
		if err != nil {
			m.logger.ErrorContext(r.Context(), "looking up the membership failed", "error", err)
			problem.Error(w, r, http.StatusServiceUnavailable, "The service is unavailable right now.")
			return
		}
		if !ok {
			problem.Error(w, r, http.StatusNotFound, notFound)
			return
		}
		next.ServeHTTP(w, r.WithContext(tenant.WithMembership(r.Context(), membership)))
	})
}

// Problem types for a tenant its members cannot use (C72, C144, C162).
const (
	TypeTenantProvisioning = "https://bool.mv/problems/tenant-provisioning"
	TypeTenantSuspended    = "https://bool.mv/problems/tenant-suspended"
	TypeTenantArchived     = "https://bool.mv/problems/tenant-archived"
)

// RequireActiveTenant lets through only a request in an active tenant (C144). A
// tenant still being set up, suspended, or archived gets 403 with its own problem
// type, which members may learn (they passed RequireMember).
func (m *Module) RequireActiveTenant(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t, ok := tenant.From(r.Context())
		if !ok {
			problem.Error(w, r, http.StatusNotFound, notFound)
			return
		}
		var d problem.Details
		switch t.Status {
		case "active":
			next.ServeHTTP(w, r)
			return
		case "provisioning":
			d = problem.New(r, http.StatusForbidden, "This workspace is still being set up.")
			d.Type, d.Title = TypeTenantProvisioning, "Tenant still being set up"
		case "suspended":
			d = problem.New(r, http.StatusForbidden, "This workspace is suspended.")
			d.Type, d.Title = TypeTenantSuspended, "Tenant suspended"
		case "archived":
			d = problem.New(r, http.StatusForbidden, "This workspace is archived.")
			d.Type, d.Title = TypeTenantArchived, "Tenant archived"
		default:
			// A status this code does not know is not active.
			d = problem.New(r, http.StatusForbidden, "This workspace is not available.")
		}
		problem.Write(w, d)
	})
}

// normaliseHost returns the request's host as domains stores it (C158): lowercase,
// without a port or a trailing dot; "" when there is none. Other forms (Unicode,
// an IP address) are left to the lookup, which finds no such host.
func normaliseHost(hostport string) string {
	host := hostport
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		host = h
	}
	return strings.TrimSuffix(strings.ToLower(strings.TrimSpace(host)), ".")
}
