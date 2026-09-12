package tenancy

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/goerp/internal/auth"
	"github.com/boolmv/goerp/internal/db/sqlc"
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

// RequireTenant resolves the tenant from the Host header and requires the caller to be an active
// member. A tenant that doesn't exist, isn't active, or the caller isn't a member of, all fail the
// same way (404) — the app never confirms a tenant slug exists to a non-member.
func (m *Middleware) RequireTenant(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		slug := slugFromHost(r.Host)
		if slug == "" {
			notFound(w)
			return
		}

		q := sqlc.New(m.pool)
		tenant, err := q.GetTenantBySlug(r.Context(), slug)
		if err != nil {
			notFound(w)
			return
		}
		if tenant.Status != "active" {
			forbidden(w)
			return
		}

		p, ok := auth.PrincipalFrom(r.Context())
		if !ok {
			notFound(w)
			return
		}
		userID, err := auth.ParseUUID(p.ID)
		if err != nil {
			notFound(w)
			return
		}
		if _, err := q.GetActiveTenantMembership(r.Context(), sqlc.GetActiveTenantMembershipParams{
			TenantID: tenant.ID,
			UserID:   userID,
		}); err != nil {
			if !errors.Is(err, pgx.ErrNoRows) {
				writeErr(w, http.StatusInternalServerError, "internal")
				return
			}
			notFound(w)
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

func notFound(w http.ResponseWriter)  { writeErr(w, http.StatusNotFound, "not found") }
func forbidden(w http.ResponseWriter) { writeErr(w, http.StatusForbidden, "forbidden") }

func writeErr(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":"` + msg + `"}`))
}
