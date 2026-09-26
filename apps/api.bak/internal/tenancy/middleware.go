package tenancy

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/internal/auth"
	"github.com/boolmv/erp/internal/db/sqlc"
	"github.com/boolmv/erp/internal/observability"
	"github.com/boolmv/erp/internal/respond"
)

// Middleware resolves the tenant from the request's Host and verifies the authenticated principal
// has a CURRENT, active membership in it (UC-FND-03) — the URL only routes; membership + RLS are
// the real boundary. Must run after auth.Middleware.RequireSession (needs a resolved Principal).
type Middleware struct {
	pool *pgxpool.Pool
}

// NewMiddleware wires the tenant-resolution middleware.
func NewMiddleware(pool *pgxpool.Pool) *Middleware {
	return &Middleware{pool: pool}
}

// RequireTenant resolves the tenant from the Host header and requires the caller to be a current
// member of it. This is the boundary tenancy.md describes: the URL only routes, membership decides.
//
// Everything a NON-MEMBER can trigger answers 404 alike — unknown slug, real tenant they don't
// belong to, suspended tenant they don't belong to — so the API never confirms a slug exists to
// someone with no business knowing. That is why membership is checked BEFORE status: checking status
// first told any caller "this tenant exists and is suspended", which is exactly the disclosure the
// 404s elsewhere are there to prevent.
//
// A MEMBER of a non-active tenant is a different case: they already know it exists, so they get 403
// with a machine-readable code (tenant_suspended / tenant_archived) rather than a bare refusal. The
// SPA branches on that to offer switching tenant or signing out, instead of a dead end that looks
// like a bug. Suspension is enforced per request — sessions are per identity, not per tenant, so
// revoking them would sign a multi-tenant member out of unrelated tenants they still belong to.
func (m *Middleware) RequireTenant(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		slug := slugFromHost(r.Host)
		if slug == "" {
			notFound(r.Context(), w)
			return
		}

		q := sqlc.New(m.pool)
		tenant, err := q.GetTenantBySlug(r.Context(), slug)
		if err != nil {
			if !errors.Is(err, pgx.ErrNoRows) {
				// A database failure is ours, not a missing tenant — reporting it as 404 sends the
				// caller looking for a typo in a slug that is perfectly correct.
				observability.LoggerFrom(r.Context()).Error("resolve tenant by slug", "err", err)
				respond.Error(r.Context(), w, http.StatusInternalServerError, "internal")
				return
			}
			notFound(r.Context(), w)
			return
		}

		p, ok := auth.PrincipalFrom(r.Context())
		if !ok {
			notFound(r.Context(), w)
			return
		}
		userID, err := auth.ParseUUID(p.ID)
		if err != nil {
			notFound(r.Context(), w)
			return
		}
		if _, err := q.GetActiveTenantMembership(r.Context(), sqlc.GetActiveTenantMembershipParams{
			TenantID: tenant.ID,
			UserID:   userID,
		}); err != nil {
			if !errors.Is(err, pgx.ErrNoRows) {
				observability.LoggerFrom(r.Context()).Error("resolve tenant membership", "err", err)
				respond.Error(r.Context(), w, http.StatusInternalServerError, "internal")
				return
			}
			notFound(r.Context(), w)
			return
		}

		// Member confirmed — now the tenant's own state can be disclosed to them.
		if tenant.Status != "active" {
			respond.ErrorCode(r.Context(), w, http.StatusForbidden,
				"tenant_"+tenant.Status, "this workspace is "+tenant.Status)
			return
		}

		next.ServeHTTP(w, r.WithContext(WithTenantID(r.Context(), tenant.ID)))
	})
}

// slugFromHost extracts the tenant slug from a forwarded Host header, e.g.
// "malecouncil.bool.test:8080" -> "malecouncil". Trusts the proxy-forwarded Host — the URL is a
// router, not the security boundary (tenancy.md); membership above is what actually gates access.
func slugFromHost(host string) string {
	if h, _, ok := strings.Cut(host, ":"); ok {
		host = h
	}
	label, _, ok := strings.Cut(host, ".")
	if !ok || label == "" {
		return ""
	}
	return label
}

func notFound(ctx context.Context, w http.ResponseWriter) {
	respond.Error(ctx, w, http.StatusNotFound, "not found")
}
