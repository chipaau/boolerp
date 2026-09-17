package auth

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/internal/observability"
	"github.com/boolmv/erp/internal/respond"
)

// OperatorsOnly restricts a group of routes to Bool operators: users holding a CURRENT membership in
// the one internal tenant (tenants.is_internal). The URL never decides who may call a route —
// middleware does — so an operator-only surface is expressed by wrapping it in this, not by living
// under some privileged path prefix.
//
// It resolves the authorization principal once (internal membership + the capabilities the user's
// roles grant there) and puts it in the context, so RequirePermission below and the handlers reuse
// that single lookup rather than each re-querying the same rows.
func OperatorsOnly(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Defence in depth: RequireSession already guarantees a principal on /v1.
			p, ok := PrincipalFrom(r.Context())
			if !ok {
				respond.Error(r.Context(), w, http.StatusUnauthorized, "unauthenticated")
				return
			}
			userID, err := ParseUUID(p.ID)
			if err != nil {
				respond.Error(r.Context(), w, http.StatusInternalServerError, "bad principal id")
				return
			}

			azp, err := BuildOperatorPrincipal(r.Context(), pool, userID)
			if err != nil {
				observability.LoggerFrom(r.Context()).Error("build operator principal", "err", err)
				respond.Error(r.Context(), w, http.StatusInternalServerError, "internal")
				return
			}
			if !azp.IsInternalMember {
				respond.Error(r.Context(), w, http.StatusForbidden, "forbidden")
				return
			}

			next.ServeHTTP(w, r.WithContext(WithAuthzPrincipal(r.Context(), azp)))
		})
	}
}

// RequirePermission gates one route on a live Cerbos decision for (resource, action) — the policy
// decides, not a capability string compared in Go, so permissions stay in docker/cerbos/policies and
// take effect the moment they change (auth.md: never bake permissions into anything long-lived).
//
// Must run below a middleware that resolved the authorization principal (OperatorsOnly today): a
// route wired without one is a programming error, answered 500 rather than silently allowed.
//
// This is coarse, route-level authorization. A check that depends on the specific record — "is this
// your own profile" — still belongs in the handler, where the resource is actually loaded; middleware
// can't evaluate attributes it hasn't fetched.
func RequirePermission(cerbos *Cerbos, resourceKind, action string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			azp, ok := AuthzPrincipalFrom(r.Context())
			if !ok {
				observability.LoggerFrom(r.Context()).Error("RequirePermission with no authz principal resolved",
					"resource", resourceKind, "action", action)
				respond.Error(r.Context(), w, http.StatusInternalServerError, "internal")
				return
			}

			// Cerbos requires a non-empty resource id even for collection-level actions (list,
			// provision) that name no specific instance yet; routes carrying {id} pass the real one.
			resourceID := chi.URLParam(r, "id")
			if resourceID == "" {
				resourceID = "collection"
			}

			switch err := cerbos.Authorize(r.Context(), azp, AuthzResource{Kind: resourceKind, ID: resourceID}, action); {
			case errors.Is(err, ErrForbidden):
				respond.Error(r.Context(), w, http.StatusForbidden, "forbidden")
				return
			case err != nil:
				// The policy didn't decide "no" — we failed to ask. Reporting that as 403 would tell
				// the caller they lack a permission they may well hold.
				observability.LoggerFrom(r.Context()).Error("cerbos authorize", "err", err)
				respond.Error(r.Context(), w, http.StatusBadGateway, "authz upstream")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
